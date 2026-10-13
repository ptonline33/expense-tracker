# GO_LIVE — expense-tracker

Runbook for shipping and maintaining this app. Live resources:

- GitHub: https://github.com/ptonline33/expense-tracker (public, branch `main`)
- Vercel: https://expense-tracker-ten-alpha-40.vercel.app (project `omarchy1/expense-tracker`)
- Supabase: reuses the TRE project (`zwwpxslfpjyykpadxiuc`), separate tables.
  Anon key lives in `tre-app-cloud/static/config.js` — never paste keys into this repo.

## One-time Supabase setup (~2 min, dashboard only)

CLI/API can't run DDL without the DB password, so this step is manual:

1. Supabase dashboard → TRE project → SQL Editor → New query.
2. Paste the entire `supabase-schema.sql` → Run.
3. Creates `expenses`, `expense_categories`, `expense_settings`,
   public `receipts` bucket, open-access policies (no-login pattern,
   same as tre-app-cloud — keep the Vercel URL private).

## Env vars (Vercel → Project → Settings → Environment Variables)

| Var | Value source | Targets |
|---|---|---|
| `VITE_SUPABASE_URL` | TRE project URL | Production, Development |
| `VITE_SUPABASE_ANON_KEY` | TRE project `anon` key | Production, Development |

Backend is automatic: env present → Supabase (footer shows `☁ Supabase`),
absent → localStorage (footer shows `💾`, localhost dev).

## Deploy / update

```bash
cd ~/Projects/expense-tracker
npm run build            # sanity check (also runs the PWA precache)
git add -A && git commit -m "..." && git push
vercel deploy --prod --yes
```

Redeploy after any env-var change — Vite bakes env into the build.

Adding env vars via CLI (value piped, no newline):

```bash
printf '%s' "<value>" | vercel env add VITE_SUPABASE_URL production
```

## Verify a deploy

```bash
curl -s -o /dev/null -w "site:%{http_code}\n" https://expense-tracker-ten-alpha-40.vercel.app/
# tables exist? (200 + [] = yes; PGRST205/404 = run the schema SQL)
curl -s "https://<ref>.supabase.co/rest/v1/expenses?select=id&limit=1" \
  -H "apikey: <anon-key>" -H "Authorization: Bearer <anon-key>"
```

Then open the site: footer `☁ Supabase`, add an expense with receipt,
confirm it survives reload (categories seed themselves on first load).

## Troubleshooting

- **`PGRST205 / Could not find table 'public.expenses'`** → schema SQL not
  run yet (or PostgREST cache stale — wait ~1 min after running it).
- **App alert "Could not reach the Supabase database"** → wrong URL/key in
  Vercel env, or schema missing. Fix env → redeploy (env is build-time).
- **`vercel env add` hangs on JWT values**: the CLI detects credentials and
  shows an interactive store-as-Secret/Config prompt that fails on pipes.
  Workaround: add the var via the Vercel REST API —
  `POST /v10/projects/{projectId}/env?teamId={teamId}` with
  `{"key","value","type":"encrypted","target":["production","development"]}`,
  authenticated with the token in `~/.local/share/com.vercel.cli/auth.json`.
  IDs are in `.vercel/project.json`.
- **`preview` env asks "Git branch?"**: CLI-deployed projects have no linked
  git branches — skip `preview`, use `production` + `development` only.
- **Receipt upload fails but expenses save** → `receipts` bucket missing or
  its storage policy not applied — rerun the bucket section of the schema.
- **Dev server**: `npm run dev` → http://localhost:5173 (always localStorage
  unless a `.env` file with the two vars exists; `.env` is gitignored).
