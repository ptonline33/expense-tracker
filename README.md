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

## Data: local vs cloud

The footer shows the active backend:

- **Localhost** (no env vars): everything in `localStorage`.
- **Vercel** (env vars set): Supabase tables + `receipts` bucket.

See `SUPABASE.md` for the one-time project + schema setup.

## Deploy

```bash
git add -A && git commit -m "..." && git push
vercel --prod
```

First deploy links the folder to a Vercel project. Then add env vars
(`Vercel → Project → Settings → Environment Variables`):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

…\and redeploy. No other config needed (Vite auto-detected, `dist` output).
