-- Run this once in the Supabase SQL editor (Supabase dashboard -> SQL Editor -> New query)

create table if not exists mock_tests (
  id uuid primary key default gen_random_uuid(),
  test_date date not null,
  subject text not null,
  marks numeric not null,
  total numeric not null,
  created_at timestamptz default now()
);

create table if not exists settings (
  id text primary key,
  target numeric not null default 65
);

insert into settings (id, target) values ('main', 65)
on conflict (id) do nothing;

-- Enable Row Level Security
alter table mock_tests enable row level security;
alter table settings enable row level security;

-- Allow anyone with the anon key to read/write.
-- This is fine for a single-user personal tracker with no login.
-- If you later add real user accounts, replace these with per-user policies.
create policy "public read tests" on mock_tests for select using (true);
create policy "public insert tests" on mock_tests for insert with check (true);
create policy "public delete tests" on mock_tests for delete using (true);

create policy "public read settings" on settings for select using (true);
create policy "public update settings" on settings for update using (true);
