# CHANGELOG — expense-tracker

## 2026-10-13 — Receipt photo attachments
- Add/edit modal has a receipt photo picker (`accept="image/*"`, phone
  camera supported). Photos are downscaled to max 1280px JPEG (~100–300KB)
  and stored on the expense row; preview with size + remove button.
- Expenses list + dashboard recent show a 🧾 badge; tap opens a full-size viewer.
- `save()` in `src/store.js` throws catchable `STORAGE_FULL` on quota errors;
  UI alerts suggest removing the receipt or old expenses (~5MB localStorage budget).
- `SUPABASE.md` gained section 5: receipts move to a Storage bucket later.
- Verified: `npm run build` succeeds, receipt elements present in served page.

## 2026-10-13 — Currency changed to Canadian dollars
- Default currency `₹` → `CA$`; number/date formatting locale `en-IN` → `en-CA`.
- App icon (`icon.svg` + regenerated 192/512 PNGs) now shows `$` instead of `₹`.
- Verified: `npm run build` succeeds, dev server returns 200.
  Note: browsers that already saved settings keep the old symbol until
  changed in Settings → Preferences.

## 2026-10-13 — Initial PWA expense tracker (localhost)
- Scaffolded Vite + Chart.js + vite-plugin-pwa app in `~/Projects/expense-tracker`.
- Features: add/edit/delete expenses, 10 default + custom categories,
  dashboard (Today/Week/Month/30-day avg), 7-day bar, category doughnut
  (Week/Month/Year), 6-month trend, top categories, monthly budget bar,
  search/category/month filters, CSV+JSON export, JSON import, demo data.
- Offline-first PWA: manifest, maskable icons, auto-update service worker.
- Data in localStorage now; `SUPABASE.md` documents the later migration.
- Aetheria theme (#0e091d bg, #14B9B5 teal, #FF7F41 orange, #BE3F50 rose).
- Verified: `npm run build` succeeds (PWA precache 11 entries),
  `npm run dev` serves 200 on http://localhost:5173, headless screenshot OK.
