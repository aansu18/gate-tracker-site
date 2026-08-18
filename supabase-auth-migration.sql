-- Run this in the Supabase SQL Editor to add per-user login.
-- This REPLACES the old "anyone can read/write everything" policies
-- with policies that restrict each person to only their own rows.

-- 1. Remove the old public-access policies from the first setup script.
drop policy if exists "public read tests" on mock_tests;
drop policy if exists "public insert tests" on mock_tests;
drop policy if exists "public delete tests" on mock_tests;
drop policy if exists "public read settings" on settings;
drop policy if exists "public update settings" on settings;

-- 2. Add a user_id column to mock_tests, linked to the logged-in user.
alter table mock_tests
  add column if not exists user_id uuid references auth.users(id) default auth.uid();

-- IMPORTANT: any existing rows from before you added login have no
-- user_id (they were shared/anonymous). They won't be visible to anyone
-- once RLS is enabled below. If you don't need that old test data, clear it:
-- delete from mock_tests where user_id is null;
-- If you DO want to keep it, you can manually assign it to your account
-- after you sign up (ask me and I'll give you the exact update statement).

-- 3. Change settings so each user has their own row (was one shared row before).
alter table settings drop constraint if exists settings_pkey;
alter table settings add column if not exists user_id uuid references auth.users(id) default auth.uid();
alter table settings add primary key (user_id);
alter table settings drop column if exists id;

-- 4. New policies: users can only see/edit their own rows.
create policy "own tests select" on mock_tests
  for select using (auth.uid() = user_id);
create policy "own tests insert" on mock_tests
  for insert with check (auth.uid() = user_id);
create policy "own tests delete" on mock_tests
  for delete using (auth.uid() = user_id);

create policy "own settings select" on settings
  for select using (auth.uid() = user_id);
create policy "own settings insert" on settings
  for insert with check (auth.uid() = user_id);
create policy "own settings update" on settings
  for update using (auth.uid() = user_id);
