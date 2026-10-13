// Storage layer — localStorage for localhost.
// Designed to swap to Supabase later: all data access goes through `db`
// which exposes async methods with the same shapes the Supabase version will use.
// See SUPABASE.md for the future table schema.

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

export const db = {
  async listExpenses() {
    return load(EXPENSE_KEY, [])
  },
  async addExpense({ amount, category, date, note = '', payMethod = 'Cash', receipt = null }) {
    const all = load(EXPENSE_KEY, [])
    const row = {
      id: uid(),
      amount: Number(amount),
      category,
      date, // YYYY-MM-DD
      note,
      payMethod,
      receipt, // compressed JPEG dataURL or null (Supabase: storage path, see SUPABASE.md)
      created_at: new Date().toISOString(),
    }
    all.push(row)
    save(EXPENSE_KEY, all)
    return row
  },
  async updateExpense(id, patch) {
    const all = load(EXPENSE_KEY, [])
    const i = all.findIndex((e) => e.id === id)
    if (i === -1) return null
    all[i] = { ...all[i], ...patch, amount: patch.amount !== undefined ? Number(patch.amount) : all[i].amount }
    save(EXPENSE_KEY, all)
    return all[i]
  },
  async deleteExpense(id) {
    save(EXPENSE_KEY, load(EXPENSE_KEY, []).filter((e) => e.id !== id))
  },
  async replaceAll(expenses) {
    save(EXPENSE_KEY, expenses)
  },
  async clearAll() {
    save(EXPENSE_KEY, [])
  },

  async listCategories() {
    const cats = load(CAT_KEY, null)
    if (!cats) {
      save(CAT_KEY, DEFAULT_CATEGORIES)
      return structuredClone(DEFAULT_CATEGORIES)
    }
    return cats
  },
  async addCategory({ label, icon = '📦', color = '#14B9B5' }) {
    const cats = await this.listCategories()
    const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24) + '-' + Date.now().toString(36)
    const row = { id, label, icon, color }
    cats.push(row)
    save(CAT_KEY, cats)
    return row
  },
  async deleteCategory(id) {
    if (DEFAULT_CATEGORIES.some((c) => c.id === id)) {
      // allow deleting defaults too, but reassign their expenses to 'other'
    }
    save(CAT_KEY, (await this.listCategories()).filter((c) => c.id !== id))
    const all = load(EXPENSE_KEY, []).map((e) => (e.category === id ? { ...e, category: 'other' } : e))
    save(EXPENSE_KEY, all)
  },

  async getSettings() {
    return { ...DEFAULT_SETTINGS, ...load(SETTINGS_KEY, {}) }
  },
  async saveSettings(patch) {
    const next = { ...(await this.getSettings()), ...patch }
    save(SETTINGS_KEY, next)
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
