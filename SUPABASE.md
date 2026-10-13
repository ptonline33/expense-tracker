# Supabase setup — one-time, ~2 minutes

The app picks its backend automatically:

- **No env vars** (localhost `npm run dev`) → localStorage. Offline, private.
- **`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` set** (Vercel) → Supabase
  tables + Storage bucket. Same UI, same method names.

We reuse the existing TRE project (`zwwpxslfpjyykpadxiuc`), separate tables.

## 1. Run the schema

Supabase dashboard → the TRE project → SQL Editor → New query → paste the
entire `supabase-schema.sql` from this repo → Run.

This creates `expenses`, `expense_categories`, `expense_settings`,
the public `receipts` bucket, and open-access policies (same no-login
pattern as tre-app-cloud — anyone with the deployed URL can read/write,
so keep the URL private).

## 2. Keys (already in use)

Same project + anon key as tre-app-cloud (`static/config.js` there).
On Vercel: Project → Settings → Environment Variables:

- `VITE_SUPABASE_URL` = the project URL
- `VITE_SUPABASE_ANON_KEY` = the `anon` public key

## 4. Give them to the deploy step

- Local Supabase test: copy `.env.example` to `.env`, fill in, `npm run dev`.
- Vercel: Project → Settings → Environment Variables → add both → redeploy.

## 5. Verify

Open the deployed app → footer should read `☁ Supabase` → add an expense
with a receipt → check it appears in the dashboard table editor.
