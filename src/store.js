// Storage layer — dual backend.
// - Localhost (no env vars): localStorage. Offline, private, zero setup.
// - Vercel (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY set): Supabase
//   tables + Storage bucket (see supabase-schema.sql). Same method names
//   either way, so the UI never cares which backend is active.

import { supabase } from './supabase.js'

const cloud = () => !!supabase

const EXPENSE_KEY = 'aetheria-expenses-v1'
const CAT_KEY = 'aetheria-categories-v1'
const SETTINGS_KEY = 'aetheria-settings-v1'

export const DEFAULT_CATEGORIES = [
  { id: 'food', label: 'Food', icon: '🍜', color: '#FF7F41' },
  { id: 'transport', label: 'Transport', icon: '🛵', color: '#04C5F0' },
  { id: 'housing', label: 'Housing', icon: '🏠', color: '#BE3F50' },
  { id: 'utilities', label: 'Utilities', icon: '💡', color: '#9147a8' },
  { id: 'health', label: 'Health', icon: '💊', color: '#7cd699' },
  { id: 'entertainment', label: 'Fun', icon: '🎮', color: '#FD3E6A' },
  { id: 'shopping', label: 'Shopping', icon: '🛍️', color: '#ffbe74' },
  { id: 'travel', label: 'Travel', icon: '✈️', color: '#14B9B5' },
  { id: 'education', label: 'Learning', icon: '📚', color: '#c8e967' },
  { id: 'other', label: 'Other', icon: '📦', color: '#8a86a3' },
]

export const DEFAULT_SETTINGS = {
  currency: 'CA$',
  monthlyBudget: 0,
  name: '',
}

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : structuredClone(fallback)
  } catch {
    return structuredClone(fallback)
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (err) {
    // localStorage is ~5MB — receipt photos can fill it. Surface a
    // catchable error so the UI can suggest a smaller photo.
    if (err?.name === 'QuotaExceededError' || err?.code === 22) throw new Error('STORAGE_FULL')
    throw err
  }
}

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2))

// ---- cloud helpers ----
function receiptUrl(path) {
  if (!path) return null
  return supabase.storage.from('receipts').getPublicUrl(path).data.publicUrl
}

function fromRow(r) {
  return {
    id: r.id,
    amount: Number(r.amount),
    category: r.category,
    date: r.date,
    note: r.note || '',
    payMethod: r.pay_method || 'Cash',
    receipt: receiptUrl(r.receipt_path), // public URL (or null) — viewer-ready
    receipt_path: r.receipt_path || null,
    created_at: r.created_at,
  }
}

async function uploadReceipt(id, dataUrl) {
  const blob = await (await fetch(dataUrl)).blob()
  const path = `${id}.jpg`
  const { error } = await supabase.storage.from('receipts').upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: true,
  })
  if (error) throw error
  return path
}

export const db = {
  async listExpenses() {
    if (!cloud()) return load(EXPENSE_KEY, [])
    const { data, error } = await supabase.from('expenses').select('*').order('date', { ascending: false })
    if (error) throw error
    return data.map(fromRow)
  },

  async addExpense({ amount, category, date, note = '', payMethod = 'Cash', receipt = null }) {
    if (!cloud()) {
      const all = load(EXPENSE_KEY, [])
      const row = {
        id: uid(),
        amount: Number(amount),
        category,
        date, // YYYY-MM-DD
        note,
        payMethod,
        receipt, // compressed JPEG dataURL or null
        created_at: new Date().toISOString(),
      }
      all.push(row)
      save(EXPENSE_KEY, all)
      return row
    }
    const id = crypto.randomUUID()
    let receipt_path = null
    if (typeof receipt === 'string' && receipt.startsWith('data:')) {
      receipt_path = await uploadReceipt(id, receipt)
    }
    const { data, error } = await supabase
      .from('expenses')
      .insert({ id, amount: Number(amount), category, date, note, pay_method: payMethod, receipt_path })
      .select()
      .single()
    if (error) throw error
    return fromRow(data)
  },

  async updateExpense(id, patch) {
    if (!cloud()) {
      const all = load(EXPENSE_KEY, [])
      const i = all.findIndex((e) => e.id === id)
      if (i === -1) return null
      all[i] = { ...all[i], ...patch, amount: patch.amount !== undefined ? Number(patch.amount) : all[i].amount }
      save(EXPENSE_KEY, all)
      return all[i]
    }
    const { data: existing } = await supabase.from('expenses').select('receipt_path').eq('id', id).single()
    let receipt_path = existing?.receipt_path || null
    if (patch.receipt == null && receipt_path) {
      await supabase.storage.from('receipts').remove([receipt_path])
      receipt_path = null
    } else if (typeof patch.receipt === 'string' && patch.receipt.startsWith('data:')) {
      receipt_path = await uploadReceipt(id, patch.receipt)
    }
    // a public-URL receipt means "unchanged" — keep the stored path
    const { data, error } = await supabase
      .from('expenses')
      .update({
        amount: Number(patch.amount),
        category: patch.category,
        date: patch.date,
        note: patch.note || '',
        pay_method: patch.payMethod || 'Cash',
        receipt_path,
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return fromRow(data)
  },

  async deleteExpense(id) {
    if (!cloud()) {
      save(EXPENSE_KEY, load(EXPENSE_KEY, []).filter((e) => e.id !== id))
      return
    }
    const { data: existing } = await supabase.from('expenses').select('receipt_path').eq('id', id).single()
    await supabase.from('expenses').delete().eq('id', id)
    if (existing?.receipt_path) {
      await supabase.storage.from('receipts').remove([existing.receipt_path])
    }
  },

  async replaceAll(expenses) {
    if (!cloud()) {
      save(EXPENSE_KEY, expenses)
      return
    }
    await supabase.from('expenses').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    const rows = []
    for (const e of expenses.filter((x) => x.amount && x.date)) {
      const id = crypto.randomUUID()
      let receipt_path = null
      if (typeof e.receipt === 'string' && e.receipt.startsWith('data:')) {
        try {
          receipt_path = await uploadReceipt(id, e.receipt)
        } catch {
          receipt_path = null
        }
      }
      rows.push({
        id,
        amount: Number(e.amount),
        category: e.category || 'other',
        date: e.date,
        note: e.note || '',
        pay_method: e.payMethod || e.pay_method || 'Cash',
        receipt_path,
      })
    }
    if (rows.length) {
      const { error } = await supabase.from('expenses').insert(rows)
      if (error) throw error
    }
  },

  async clearAll() {
    if (!cloud()) {
      save(EXPENSE_KEY, [])
      return
    }
    await supabase.from('expenses').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    const { data: files } = await supabase.storage.from('receipts').list()
    if (files?.length) {
      await supabase.storage.from('receipts').remove(files.map((f) => f.name))
    }
  },

  async listCategories() {
    if (!cloud()) {
      const cats = load(CAT_KEY, null)
      if (!cats) {
        save(CAT_KEY, DEFAULT_CATEGORIES)
        return structuredClone(DEFAULT_CATEGORIES)
      }
      return cats
    }
    const { data, error } = await supabase.from('expense_categories').select('*').order('label')
    if (error) throw error
    if (!data.length) {
      // first run after schema: seed the defaults
      await supabase.from('expense_categories').insert(DEFAULT_CATEGORIES)
      return structuredClone(DEFAULT_CATEGORIES)
    }
    return data
  },

  async addCategory({ label, icon = '📦', color = '#14B9B5' }) {
    const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24) + '-' + Date.now().toString(36)
    const row = { id, label, icon, color }
    if (!cloud()) {
      const cats = await this.listCategories()
      cats.push(row)
      save(CAT_KEY, cats)
      return row
    }
    const { error } = await supabase.from('expense_categories').insert(row)
    if (error) throw error
    return row
  },

  async deleteCategory(id) {
    if (!cloud()) {
      save(CAT_KEY, (await this.listCategories()).filter((c) => c.id !== id))
      const all = load(EXPENSE_KEY, []).map((e) => (e.category === id ? { ...e, category: 'other' } : e))
      save(EXPENSE_KEY, all)
      return
    }
    await supabase.from('expense_categories').delete().eq('id', id)
    await supabase.from('expenses').update({ category: 'other' }).eq('category', id)
  },

  async getSettings() {
    if (!cloud()) return { ...DEFAULT_SETTINGS, ...load(SETTINGS_KEY, {}) }
    const { data } = await supabase.from('expense_settings').select('*').eq('id', 'main').single()
    if (!data) {
      await supabase.from('expense_settings').insert({ id: 'main', currency: 'CA$', monthly_budget: 0 })
      return { ...DEFAULT_SETTINGS }
    }
    return { currency: data.currency || 'CA$', monthlyBudget: Number(data.monthly_budget) || 0, name: '' }
  },

  async saveSettings(patch) {
    const next = { ...(await this.getSettings()), ...patch }
    if (!cloud()) {
      save(SETTINGS_KEY, next)
      return next
    }
    const { error } = await supabase
      .from('expense_settings')
      .upsert({ id: 'main', currency: next.currency, monthly_budget: Number(next.monthlyBudget) || 0 })
    if (error) throw error
    return next
  },
}

// ---- date helpers ----
export const fmtDate = (d) => d.toISOString().slice(0, 10)
export const todayStr = () => fmtDate(new Date())
export const parseDate = (s) => new Date(s + 'T12:00:00')

export function startOfWeek(date = new Date()) {
  const d = new Date(date)
  const day = (d.getDay() + 6) % 7 // Monday-first
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

export function inRange(dateStr, from, to) {
  const t = parseDate(dateStr).getTime()
  return t >= from.getTime() && t <= to.getTime()
}

export function monthKey(dateStr) {
  return dateStr.slice(0, 7) // YYYY-MM
}

export function money(n, currency) {
  const v = Number(n || 0)
  return currency + v.toLocaleString('en-CA', { maximumFractionDigits: 2, minimumFractionDigits: v % 1 ? 2 : 0 })
}
