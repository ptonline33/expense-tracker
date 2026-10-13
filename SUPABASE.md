# Supabase setup — one-time, ~5 minutes

The app picks its backend automatically:

- **No env vars** (localhost `npm run dev`) → localStorage. Offline, private.
- **`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` set** (Vercel) → Supabase
  tables + Storage bucket. Same UI, same method names.

## 1. Create a new project

Supabase dashboard → New project → name it `expense-tracker` (or anything) →
note the database password (you won't need it after this) → wait ~2 min.

## 2. Run the schema

Project → SQL Editor → New query → paste the entire
`supabase-schema.sql` from this repo → Run.

This creates `expenses`, `expense_categories`, `expense_settings`,
the public `receipts` bucket, and open-access policies (same no-login
pattern as tre-app-cloud — anyone with the deployed URL can read/write,
so keep the URL private).

## 3. Get the keys

Project → Settings → API → copy:

- Project URL → `VITE_SUPABASE_URL`
- `anon` / `public` key → `VITE_SUPABASE_ANON_KEY`

## 4. Give them to the deploy step

- Local Supabase test: copy `.env.example` to `.env`, fill in, `npm run dev`.
- Vercel: Project → Settings → Environment Variables → add both → redeploy.

## 5. Verify

Open the deployed app → footer should read `☁ Supabase` → add an expense
with a receipt → check it appears in the dashboard table editor.
