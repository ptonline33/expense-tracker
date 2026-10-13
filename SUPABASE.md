# Supabase migration (for later — not needed on localhost)

When you're ready for GitHub → Vercel → Supabase, do this:

## 1. SQL — run in Supabase SQL editor

```sql
create table expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  amount numeric not null check (amount > 0),
  category text not null,
  date date not null,
  note text default '',
  pay_method text default 'Cash',
  created_at timestamptz default now()
);
alter table expenses enable row level security;

create policy "own rows" on expenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table categories (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  label text not null,
  icon text default '📦',
  color text default '#14B9B5'
);
alter table categories enable row level security;

create policy "own cats" on categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

## 2. Swap `src/store.js`

```bash
npm install @supabase/supabase-js
```

Create `src/supabase.js`:

```js
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

Then replace each `db.*` method body with the Supabase equivalent,
keeping the same function names/signatures — the UI (`app.js`) needs
zero changes. Example:

```js
async listExpenses() {
  const { data: { user } } = await supabase.auth.getUser()
  const { data } = await supabase.from('expenses')
    .select('*').eq('user_id', user.id).order('date', { ascending: false })
  return data
},
```

## 3. Vercel env vars

Add `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in
Vercel → Project → Settings → Environment Variables.

## 4. Migrate local data

Settings → Export JSON, then import it once via a small script or
directly into the tables. Local data stays as offline fallback.

## 5. Receipts

Locally, receipts are compressed JPEG dataURLs stored on the expense row
(~100–300KB each). Don't put dataURLs in Postgres — use a Storage bucket:

```sql
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false);
create policy "own receipts" on storage.objects
  for all using (bucket_id = 'receipts' and auth.uid() = owner)
  with check (bucket_id = 'receipts' and auth.uid() = owner);
```

On save: upload the dataURL as `{user_id}/{expense_id}.jpg`, store the
path in a new `expenses.receipt_path text` column, and set the local
`receipt` field to null. On read: `supabase.storage.from('receipts').createSignedUrl(path, 3600)`
for the viewer.
