import './style.css'
import { Chart, registerables } from 'chart.js'
import { db, todayStr, parseDate, startOfWeek, monthKey, money } from './store.js'
import { backend } from './supabase.js'

Chart.register(...registerables)

const state = {
  expenses: [],
  categories: [],
  settings: { currency: 'CA$', monthlyBudget: 0 },
  view: 'dashboard',
  donutRange: 'month',
  editingId: null,
  selectedCat: null,
  tempReceipt: null, // compressed JPEG dataURL staged in the add/edit modal
}

const $ = (id) => document.getElementById(id)
const catById = (id) => state.categories.find((c) => c.id === id) || { label: id, icon: '📦', color: '#8d89ab' }

// ---------- init ----------
async function init() {
  try {
    state.expenses = await db.listExpenses()
    state.categories = await db.listCategories()
    state.settings = await db.getSettings()
  } catch (err) {
    console.error(err)
    state.expenses = []
    state.categories = []
    state.settings = { currency: 'CA$', monthlyBudget: 0 }
    setTimeout(() => alert('Could not reach the Supabase database.\nCheck the URL/key and that supabase-schema.sql was run in the SQL editor.'), 300)
  }
  state.selectedCat = state.categories[0]?.id || 'other'

  $('setCurrency').value = state.settings.currency
  $('setBudget').value = state.settings.monthlyBudget || ''
  $('filterMonth').value = todayStr().slice(0, 7)
  $('backendLabel').textContent = backend === 'supabase' ? '☁ Supabase' : '💾 this browser (localStorage)'

  wireEvents()
  buildCategoryFilter()
  renderAll()
  setupInstallPrompt()
  updateMonthLabel()
}

function updateMonthLabel() {
  const now = new Date()
  $('monthLabel').textContent = now.toLocaleDateString('en-CA', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
}

// ---------- events ----------
function wireEvents() {
  document.querySelectorAll('.tabs button').forEach((b) =>
    b.addEventListener('click', () => switchView(b.dataset.view))
  )
  $('settingsBtn').addEventListener('click', () => switchView('settings'))
  $('fabBtn').addEventListener('click', () => openModal())
  $('cancelBtn').addEventListener('click', closeModal)
  $('modalBack').addEventListener('click', (e) => { if (e.target.id === 'modalBack') closeModal() })
  $('expForm').addEventListener('submit', onSaveExpense)
  $('fReceipt').addEventListener('change', onReceiptPicked)
  $('viewerClose').addEventListener('click', closeViewer)
  $('viewerBack').addEventListener('click', (e) => { if (e.target.id === 'viewerBack') closeViewer() })

  document.querySelectorAll('#donutSeg button').forEach((b) =>
    b.addEventListener('click', () => {
      state.donutRange = b.dataset.range
      document.querySelectorAll('#donutSeg button').forEach((x) => x.classList.toggle('active', x === b))
      renderDashboard()
    })
  )

  $('searchInput').addEventListener('input', renderExpenses)
  $('filterCat').addEventListener('change', renderExpenses)
  $('filterMonth').addEventListener('change', renderExpenses)

  $('saveSettings').addEventListener('click', async () => {
    state.settings = await db.saveSettings({
      currency: $('setCurrency').value.trim() || 'CA$',
      monthlyBudget: Number($('setBudget').value) || 0,
    })
    renderAll()
    alert('Settings saved ✓')
  })

  $('addCatBtn').addEventListener('click', async () => {
    const label = $('newCatLabel').value.trim()
    if (!label) return alert('Give the category a name')
    const palette = ['#FF7F41', '#04C5F0', '#FD3E6A', '#c8e967', '#9147a8', '#ffbe74', '#7cd699']
    const color = palette[state.categories.length % palette.length]
    await db.addCategory({ label, icon: $('newCatIcon').value.trim() || '📦', color })
    $('newCatLabel').value = ''
    $('newCatIcon').value = ''
    await refresh()
  })

  $('exportBtn').addEventListener('click', exportCSV)
  $('exportCsvBtn2').addEventListener('click', exportCSV)
  $('exportJsonBtn').addEventListener('click', exportJSON)
  $('importFile').addEventListener('change', importJSON)
  $('seedBtn').addEventListener('click', seedDemo)
  $('clearBtn').addEventListener('click', async () => {
    if (!confirm('Delete ALL expenses? This cannot be undone.')) return
    await db.clearAll()
    await refresh()
  })
}

function switchView(view) {
  state.view = view
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.view === view))
  for (const v of ['dashboard', 'expenses', 'settings']) $('view-' + v).hidden = v !== view
}

// ---------- modal ----------
function openModal(edit = null) {
  state.editingId = edit?.id || null
  $('modalTitle').textContent = edit ? 'Edit expense' : 'Add expense'
  $('fId').value = edit?.id || ''
  $('fAmount').value = edit?.amount ?? ''
  $('fDate').value = edit?.date || todayStr()
  $('fNote').value = edit?.note || ''
  $('fPay').value = edit?.payMethod || 'Cash'
  state.selectedCat = edit?.category || state.selectedCat
  state.tempReceipt = edit?.receipt || null
  $('fReceipt').value = ''
  renderChips()
  renderReceiptPreview()
  $('modalBack').classList.add('open')
  setTimeout(() => $('fAmount').focus(), 60)
}
function closeModal() { $('modalBack').classList.remove('open') }

function renderChips() {
  const box = $('fCatChips')
  box.innerHTML = ''
  for (const c of state.categories) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'chip' + (c.id === state.selectedCat ? ' active' : '')
    b.style.setProperty('--chip-c', c.color)
    b.innerHTML = `<span>${c.icon}</span> ${c.label}`
    b.addEventListener('click', () => { state.selectedCat = c.id; renderChips() })
    box.appendChild(b)
  }
}

async function onSaveExpense(e) {
  e.preventDefault()
  const amount = Number($('fAmount').value)
  if (!amount || amount <= 0) return alert('Enter a valid amount')
  if (!state.selectedCat) return alert('Pick a category')
  const payload = {
    amount,
    category: state.selectedCat,
    date: $('fDate').value || todayStr(),
    note: $('fNote').value.trim(),
    payMethod: $('fPay').value,
    receipt: state.tempReceipt,
  }
  try {
    if (state.editingId) await db.updateExpense(state.editingId, payload)
    else await db.addExpense(payload)
  } catch (err) {
    if (err?.message === 'STORAGE_FULL') {
      return alert('Browser storage is full — receipt photos use ~100–300KB each.\nTry removing the receipt or deleting old expenses with receipts.')
    }
    return alert('Could not save. Please try again.')
  }
  closeModal()
  await refresh()
}

// ---------- receipts ----------
// Photos are downscaled to max 1280px + JPEG 0.72 so each costs ~100–300KB
// of the ~5MB localStorage budget. On Supabase these become Storage objects.
function processReceipt(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const maxDim = 1280
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        URL.revokeObjectURL(url)
        resolve(canvas.toDataURL('image/jpeg', 0.72))
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('bad image'))
    }
    img.src = url
  })
}

async function onReceiptPicked(e) {
  const file = e.target.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    alert('Please pick an image file.')
    e.target.value = ''
    return
  }
  if (file.size > 20 * 1024 * 1024) {
    alert('That photo is over 20MB — please pick a smaller one.')
    e.target.value = ''
    return
  }
  try {
    state.tempReceipt = await processReceipt(file)
    renderReceiptPreview()
  } catch {
    alert('Could not read that photo.')
  }
}

function renderReceiptPreview() {
  const box = $('receiptPreview')
  box.innerHTML = ''
  if (!state.tempReceipt) return
  const wrap = document.createElement('div')
  wrap.className = 'receipt-thumb'
  const img = document.createElement('img')
  img.src = state.tempReceipt
  img.alt = 'Receipt preview'
  const label = document.createElement('span')
  label.textContent = `Attached (~${Math.round(state.tempReceipt.length / 1024)} KB)`
  const rm = document.createElement('button')
  rm.type = 'button'
  rm.className = 'mini-btn'
  rm.textContent = '✕ Remove'
  rm.addEventListener('click', () => {
    state.tempReceipt = null
    $('fReceipt').value = ''
    renderReceiptPreview()
  })
  wrap.append(img, label, rm)
  box.appendChild(wrap)
}

function openViewer(src) {
  $('viewerImg').src = src
  $('viewerBack').classList.add('open')
}
function closeViewer() {
  $('viewerBack').classList.remove('open')
  $('viewerImg').removeAttribute('src')
}

// ---------- refresh + render ----------
async function refresh() {
  try {
    state.expenses = await db.listExpenses()
    state.categories = await db.listCategories()
    state.settings = await db.getSettings()
  } catch (err) {
    console.error(err)
    alert('Could not reach the Supabase database.\nCheck the URL/key and that supabase-schema.sql was run in the SQL editor.')
    return
  }
  buildCategoryFilter()
  renderAll()
}

function renderAll() {
  renderDashboard()
  renderExpenses()
  renderSettings()
}

// ----- dashboard -----
let weekChart, donutChart, monthsChart

function sumIn(from, to) {
  return state.expenses
    .filter((e) => { const t = parseDate(e.date).getTime(); return t >= from.getTime() && t <= to.getTime() })
    .reduce((s, e) => s + Number(e.amount), 0)
}

function renderDashboard() {
  const cur = state.settings.currency
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const sow = startOfWeek(new Date())
  const eow = new Date(sow); eow.setDate(eow.getDate() + 6); eow.setHours(23, 59, 59)
  const som = new Date(now.getFullYear(), now.getMonth(), 1)
  const eom = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const todayTotal = sumIn(now, new Date(now.getTime() + 86399999))
  const weekTotal = sumIn(sow, eow)
  const monthTotal = sumIn(som, eom)
  const ago30 = new Date(now); ago30.setDate(ago30.getDate() - 29)
  const avg = sumIn(ago30, new Date()) / 30

  $('statToday').textContent = money(todayTotal, cur)
  $('statWeek').textContent = money(weekTotal, cur)
  $('statMonth').textContent = money(monthTotal, cur)
  $('statAvg').textContent = money(avg, cur)
  $('statTodaySub').textContent = state.expenses.filter((e) => e.date === todayStr()).length + ' transactions today'
  $('statWeekSub').textContent = 'Mon – Sun · ' + sow.toLocaleDateString('en-CA', { day: 'numeric', month: 'short' }) + ' onwards'
  $('statMonthSub').textContent = now.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })

  // budget
  const budget = Number(state.settings.monthlyBudget) || 0
  if (budget > 0) {
    const pct = Math.min(100, (monthTotal / budget) * 100)
    $('budgetBig').textContent = `${money(monthTotal, cur)} of ${money(budget, cur)}`
    $('budgetBar').style.width = pct + '%'
    $('budgetBar').style.background = pct > 90 ? 'linear-gradient(90deg,#E20342,#FD3E6A)' : 'linear-gradient(90deg,#c8e967,#14B9B5)'
    $('budgetText').textContent = pct >= 100 ? '⚠ Budget exceeded!' : `${money(budget - monthTotal, cur)} left · ${pct.toFixed(0)}% used`
    $('budgetSub').textContent = `Budget: ${money(budget, cur)}/mo`
  } else {
    $('budgetBig').textContent = 'No budget set'
    $('budgetBar').style.width = '0%'
    $('budgetText').textContent = 'Set one in Settings → Preferences.'
    $('budgetSub').textContent = 'Set a budget in Settings'
  }

  renderWeekChart(cur)
  renderDonutChart(cur)
  renderMonthsChart(cur)
  renderTopCats(cur, som, eom, monthTotal)
  renderRecent(cur)
}

function chartDefaults() {
  Chart.defaults.color = '#8d89ab'
  Chart.defaults.borderColor = 'rgba(141,137,171,.15)'
  Chart.defaults.font.family = 'Inter, system-ui, sans-serif'
}

function renderWeekChart(cur) {
  chartDefaults()
  const labels = [], data = []
  const sow = startOfWeek(new Date())
  for (let i = 0; i < 7; i++) {
    const d = new Date(sow); d.setDate(d.getDate() + i)
    labels.push(d.toLocaleDateString('en-CA', { weekday: 'short' }))
    const key = d.toISOString().slice(0, 10)
    data.push(state.expenses.filter((e) => e.date === key).reduce((s, e) => s + Number(e.amount), 0))
  }
  if (weekChart) weekChart.destroy()
  weekChart = new Chart($('chartWeek'), {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: ['#FF7F41', '#04C5F0', '#BE3F50', '#9147a8', '#7cd699', '#FD3E6A', '#14B9B5'], borderRadius: 8, borderSkipped: false }] },
    options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => money(c.raw, cur) } } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true } } },
  })
}

function donutWindow() {
  const now = new Date()
  if (state.donutRange === 'week') { const s = startOfWeek(now); const e = new Date(s); e.setDate(e.getDate() + 6); e.setHours(23, 59, 59); return [s, e] }
  if (state.donutRange === 'year') return [new Date(now.getFullYear(), 0, 1), new Date(now.getFullYear(), 11, 31, 23, 59, 59)]
  return [new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)]
}

function renderDonutChart(cur) {
  const [from, to] = donutWindow()
  const byCat = {}
  for (const e of state.expenses) {
    const t = parseDate(e.date).getTime()
    if (t >= from.getTime() && t <= to.getTime()) byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount)
  }
  const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1])
  if (donutChart) donutChart.destroy()
  if (!entries.length) {
    donutChart = new Chart($('chartDonut'), { type: 'doughnut', data: { labels: ['No data'], datasets: [{ data: [1], backgroundColor: ['#2c2150'] }] }, options: { plugins: { legend: { display: false } } } })
    return
  }
  donutChart = new Chart($('chartDonut'), {
    type: 'doughnut',
    data: {
      labels: entries.map(([id]) => `${catById(id).icon} ${catById(id).label}`),
      datasets: [{ data: entries.map(([, v]) => v), backgroundColor: entries.map(([id]) => catById(id).color), borderColor: '#0e091d', borderWidth: 3 }],
    },
    options: { cutout: '62%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14 } }, tooltip: { callbacks: { label: (c) => ' ' + money(c.raw, cur) } } } },
  })
}

function renderMonthsChart(cur) {
  const now = new Date()
  const labels = [], data = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    labels.push(d.toLocaleDateString('en-CA', { month: 'short' }))
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    data.push(state.expenses.filter((e) => monthKey(e.date) === key).reduce((s, e) => s + Number(e.amount), 0))
  }
  if (monthsChart) monthsChart.destroy()
  monthsChart = new Chart($('chartMonths'), {
    type: 'line',
    data: { labels, datasets: [{ data, borderColor: '#14B9B5', backgroundColor: 'rgba(20,185,181,.2)', fill: true, tension: 0.4, pointBackgroundColor: '#FF7F41', pointRadius: 4 }] },
    options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => money(c.raw, cur) } } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true } } },
  })
}

function renderTopCats(cur, from, to, monthTotal) {
  const byCat = {}
  for (const e of state.expenses) {
    const t = parseDate(e.date).getTime()
    if (t >= from.getTime() && t <= to.getTime()) byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount)
  }
  const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const box = $('topCats')
  box.innerHTML = ''
  if (!entries.length) { box.innerHTML = '<div class="empty">No spending this month yet.<br>Tap ＋ to add your first expense.</div>'; return }
  for (const [id, total] of entries) {
    const c = catById(id)
    const pct = monthTotal ? (total / monthTotal) * 100 : 0
    const row = document.createElement('div')
    row.className = 'cat-row'
    row.innerHTML = `<div class="cat-dot" style="background:${c.color}22;border:1px solid ${c.color}">${c.icon}</div>
      <div class="cat-meta"><b>${c.label} · ${pct.toFixed(0)}%</b><div class="cat-bar"><div style="width:${pct}%;background:${c.color}"></div></div></div>
      <div class="cat-amt">${money(total, cur)}</div>`
    box.appendChild(row)
  }
}

function renderRecent(cur) {
  const box = $('recentList')
  const items = [...state.expenses].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5)
  box.innerHTML = ''
  if (!items.length) { box.innerHTML = '<div class="empty">Nothing here yet.</div>'; return }
  for (const e of items) {
    const c = catById(e.category)
    const div = document.createElement('div')
    div.className = 'exp'
    div.innerHTML = `<div class="cat-dot" style="background:${c.color}22;border:1px solid ${c.color}">${c.icon}</div>
      <div class="info"><b>${escapeHtml(e.note) || c.label}</b><small>${e.date} · ${c.label}${e.receipt ? ' · 🧾' : ''}</small></div>
      <div class="amt">${money(e.amount, cur)}</div>
      ${e.receipt ? '<button class="rcpt-badge" title="View receipt">🧾</button>' : ''}`
    const viewBtn = div.querySelector('.rcpt-badge')
    if (viewBtn) viewBtn.addEventListener('click', () => openViewer(e.receipt))
    box.appendChild(div)
  }
}

// ----- expenses list -----
function buildCategoryFilter() {
  const sel = $('filterCat')
  sel.innerHTML = '<option value="">All categories</option>'
  for (const c of state.categories) {
    const o = document.createElement('option')
    o.value = c.id; o.textContent = `${c.icon} ${c.label}`
    sel.appendChild(o)
  }
}

function renderExpenses() {
  const cur = state.settings.currency
  const q = ($('searchInput').value || '').toLowerCase()
  const cat = $('filterCat').value
  const mk = $('filterMonth').value
  let items = [...state.expenses].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  if (cat) items = items.filter((e) => e.category === cat)
  if (mk) items = items.filter((e) => monthKey(e.date) === mk)
  if (q) items = items.filter((e) => (e.note || '').toLowerCase().includes(q) || catById(e.category).label.toLowerCase().includes(q))

  const total = items.reduce((s, e) => s + Number(e.amount), 0)
  $('expTotal').textContent = `${items.length} transactions · Total ${money(total, cur)}${mk ? ' · ' + mk : ''}`

  const box = $('expList')
  box.innerHTML = ''
  if (!items.length) { box.innerHTML = '<div class="empty">No expenses match. Try clearing filters, or tap ＋ to add one.</div>'; return }
  let lastDay = null
  for (const e of items) {
    if (e.date !== lastDay) {
      lastDay = e.date
      const h = document.createElement('div')
      h.className = 'list-day'
      h.textContent = parseDate(e.date).toLocaleDateString('en-CA', { weekday: 'short', day: 'numeric', month: 'short' })
      box.appendChild(h)
    }
    const c = catById(e.category)
    const div = document.createElement('div')
    div.className = 'exp'
    div.innerHTML = `<div class="cat-dot" style="background:${c.color}22;border:1px solid ${c.color}">${c.icon}</div>
      <div class="info"><b>${escapeHtml(e.note) || c.label}</b><small>${c.label} · ${escapeHtml(e.payMethod || '')}${e.receipt ? ' · 🧾' : ''}</small></div>
      <div class="amt">${money(e.amount, cur)}</div>
      <div class="actions">${e.receipt ? '<button class="rcpt-badge" data-act="view" title="View receipt">🧾</button>' : ''}<button class="mini-btn" data-act="edit">✎</button><button class="mini-btn" data-act="del">🗑</button></div>`
    const viewBtn = div.querySelector('[data-act="view"]')
    if (viewBtn) viewBtn.addEventListener('click', () => openViewer(e.receipt))
    div.querySelector('[data-act="edit"]').addEventListener('click', () => openModal(e))
    div.querySelector('[data-act="del"]').addEventListener('click', async () => {
      if (!confirm(`Delete ${money(e.amount, cur)} — ${e.note || c.label}?`)) return
      await db.deleteExpense(e.id)
      await refresh()
    })
    box.appendChild(div)
  }
}

// ----- settings -----
function renderSettings() {
  const box = $('catList')
  box.innerHTML = ''
  for (const c of state.categories) {
    const row = document.createElement('div')
    row.className = 'cat-row'
    row.innerHTML = `<div class="cat-dot" style="background:${c.color}22;border:1px solid ${c.color}">${c.icon}</div>
      <div class="cat-meta"><b>${escapeHtml(c.label)}</b></div>
      <button class="mini-btn">Delete</button>`
    row.querySelector('button').addEventListener('click', async () => {
      if (!confirm(`Delete category "${c.label}"? Its expenses move to Other.`)) return
      await db.deleteCategory(c.id)
      await refresh()
    })
    box.appendChild(row)
  }
}

// ----- import/export -----
function download(name, content, type) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([content], { type }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

function exportCSV() {
  const rows = [['date', 'category', 'amount', 'note', 'payMethod']]
  for (const e of state.expenses) rows.push([e.date, catById(e.category).label, e.amount, `"${(e.note || '').replace(/"/g, '""')}"`, e.payMethod || ''])
  download(`expenses-${todayStr()}.csv`, rows.map((r) => r.join(',')).join('\n'), 'text/csv')
}

function exportJSON() {
  download(`expenses-backup-${todayStr()}.json`, JSON.stringify({ expenses: state.expenses, categories: state.categories, settings: state.settings }, null, 2), 'application/json')
}

async function importJSON(e) {
  const file = e.target.files?.[0]
  if (!file) return
  try {
    const data = JSON.parse(await file.text())
    const expenses = Array.isArray(data) ? data : data.expenses
    if (!Array.isArray(expenses)) throw new Error('bad file')
    await db.replaceAll(expenses.filter((x) => x.amount && x.date))
    if (data.categories) localStorage.setItem('aetheria-categories-v1', JSON.stringify(data.categories))
    await refresh()
    alert('Import done ✓')
  } catch { alert('Could not import that file.') }
  e.target.value = ''
}

async function seedDemo() {
  if (state.expenses.length && !confirm('Add demo data on top of your existing expenses?')) return
  const cats = state.categories.map((c) => c.id)
  const pick = (i) => cats[i % cats.length]
  const notes = ['Lunch', 'Metro', 'Groceries', 'Movie', 'Coffee', 'Fuel', 'Books', 'Dinner', 'Pharmacy', 'Shoes']
  const rows = []
  const now = new Date()
  for (let d = 29; d >= 0; d--) {
    const dt = new Date(now); dt.setDate(dt.getDate() - d)
    const n = 1 + Math.floor(Math.random() * 3)
    for (let k = 0; k < n; k++) {
      rows.push({
        id: crypto.randomUUID ? crypto.randomUUID() : 'seed-' + d + '-' + k + '-' + Date.now(),
        amount: Math.round((80 + Math.random() * 900) * 100) / 100,
        category: pick(d + k),
        date: dt.toISOString().slice(0, 10),
        note: notes[(d + k) % notes.length],
        payMethod: ['Cash', 'UPI', 'Card'][k % 3],
        created_at: new Date().toISOString(),
      })
    }
  }
  await db.replaceAll([...state.expenses, ...rows])
  await refresh()
  switchView('dashboard')
}

// ----- pwa install -----
function setupInstallPrompt() {
  let deferred = null
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e
    $('installBanner').classList.add('show')
  })
  $('installBtn').addEventListener('click', async () => {
    if (!deferred) return alert('Open this page in Chrome/Edge on your phone or desktop and use the browser menu → Install / Add to Home Screen.')
    deferred.prompt()
    await deferred.userChoice
    deferred = null
    $('installBanner').classList.remove('show')
  })
  if (window.matchMedia('(display-mode: standalone)').matches) $('installBanner').classList.remove('show')
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]))
}

init()
