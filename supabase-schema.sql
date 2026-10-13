-- Aetheria Expenses — Supabase schema.
-- Run this ONCE in your new project's SQL editor
-- (Supabase dashboard → SQL Editor → New query → paste → Run).

-- ---------- expenses ----------
create table if not exists public.expenses (
  id            uuid primary key default gen_random_uuid(),
  amount        numeric not null check (amount > 0),
  category      text not null,
  date          date not null,
  note          text not null default '',
  pay_method    text not null default 'Cash',
  receipt_path  text,              -- storage path in the receipts bucket (null = none)
  created_at    timestamptz not null default now()
);

create index if not exists expenses_date_idx on public.expenses (date desc);
create index if not exists expenses_category_idx on public.expenses (category);

alter table public.expenses enable row level security;

-- Open-access pattern (same as tre-app-cloud): no login, anyone with the
-- deployed URL can read/write. Only enable this on a private/unshared URL.
drop policy if exists "allow anon access" on public.expenses;
create policy "allow anon access" on public.expenses
  for all to anon using (true) with check (true);

-- ---------- categories ----------
create table if not exists public.expense_categories (
  id     text primary key,
  label  text not null,
  icon   text not null default '📦',
  color  text not null default '#14B9B5'
);

alter table public.expense_categories enable row level security;

drop policy if exists "allow anon access" on public.expense_categories;
create policy "allow anon access" on public.expense_categories
  for all to anon using (true) with check (true);

-- ---------- settings (single row, id = 'main') ----------
create table if not exists public.expense_settings (
  id              text primary key,
  currency        text not null default 'CA$',
  monthly_budget  numeric not null default 0
);

alter table public.expense_settings enable row level security;

drop policy if exists "allow anon access" on public.expense_settings;
create policy "allow anon access" on public.expense_settings
  for all to anon using (true) with check (true);

-- ---------- receipts bucket (public, so the viewer can load images directly) ----------
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do update set public = true;

drop policy if exists "allow anon receipts" on storage.objects;
create policy "allow anon receipts" on storage.objects
  for all to anon using (bucket_id = 'receipts')
  with check (bucket_id = 'receipts');
