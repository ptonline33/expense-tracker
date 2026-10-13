# Aetheria Expenses ◈

Offline-first expense tracker PWA, themed on your Omarchy **Aetheria** theme
(`#0e091d` bg, `#14B9B5` teal, `#FF7F41` orange, `#BE3F50` rose).

## Run on localhost

```bash
cd ~/Projects/expense-tracker
npm install
npm run dev
# → http://localhost:5173
```

Installable: open the URL in Chrome/Edge → Install icon in the address bar
(or the in-app Install banner). Service worker makes it work offline.

## Features

- ➕ Add / edit / delete expenses (amount, category, date, note, pay method, receipt photo)
- 🗂 10 default categories + custom categories (own emoji + auto color)
- ◈ Dashboard: Today / Week / Month / 30-day average
- 📊 Charts (Chart.js, bundled → works offline):
  - last-7-days bar, category doughnut (Week/Month/Year toggle),
  - last-6-months trend, top-categories bars, recent list
- 💰 Monthly budget with progress bar + warnings
- 🔍 Expenses page: search, category filter, month picker, grouped list
- ⤓ Export CSV / JSON, ⤒ import JSON backup, ✨ demo data, 🗑 clear
- 📲 PWA: manifest, maskable icons, auto-update service worker

## Data now → later

- **Now (localhost):** everything in `localStorage`
  (`aetheria-expenses-v1`, `aetheria-categories-v1`, `aetheria-settings-v1`).
- **Later:** GitHub → Vercel → Supabase. See `SUPABASE.md` for the exact
  table schema + the 20-line swap in `src/store.js`.

## Deploy (when ready)

```bash
git init && git add . && git commit -m "expense tracker"
gh repo create expense-tracker --public --source=. --push
vercel   # or `vercel --prod`
```

No env vars needed until Supabase is wired.
