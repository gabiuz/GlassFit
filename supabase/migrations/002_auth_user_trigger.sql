-- ============================================================================
-- 002_auth_user_trigger.sql
-- Creates (or replaces) the trigger that auto-creates a profiles row whenever
-- a new user is added to auth.users, handling both Email and OAuth sign-ups.
--
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- ============================================================================

-- Drop existing trigger + function if they exist from a manual setup
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- --------------------------------------------------------------------------
-- Function: public.handle_new_user
-- Fires AFTER INSERT on auth.users (via Supabase Auth) and inserts a
-- matching row into public.profiles.
--
-- Supports both flows:
--   • Email/password – RegisterForm sets:
--       raw_user_meta_data->>'first_name'
--       raw_user_meta_data->>'last_name'
--       raw_user_meta_data->>'phone'
--   • Google OAuth – metadata provided by Google:
--       raw_user_meta_data->>'name'  (e.g. "Juan Dela Cruz")
--       contact_number will be NULL (allowed, column is nullable)
--
-- full_name is stored as first_name || ' ' || last_name.
-- --------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first_name   text;
  v_last_name    text;
  v_full_name    text;
  v_email        text;
  v_provider     text;
  v_phone        text;
  v_google_name  text;
begin
  -- Determine auth provider from Supabase identity providers list.
  if (new.app_metadata->'providers') @> '["google"]'::jsonb then
    v_provider := 'Google';
  else
    v_provider := 'Email';
  end if;

  -- Resolve email (auth.users always has one).
  v_email := coalesce(new.email, new.raw_user_meta_data->>'email');

  if v_provider = 'Google' then
    -- Google sends a single display name in 'name' (e.g. "Juan Dela Cruz").
    -- Split on the FIRST space: everything before → first_name,
    --                           everything after  → last_name.
    v_google_name := nullif(trim(new.raw_user_meta_data->>'name'), '');

    if v_google_name is not null and position(' ' in v_google_name) > 0 then
      v_first_name := split_part(v_google_name, ' ', 1);
      -- last_name = everything after the first space (handles multi-word last names)
      v_last_name  := trim(substring(v_google_name from position(' ' in v_google_name) + 1));
    else
      -- Single-word name or no name at all — use it as first_name
      v_first_name := coalesce(v_google_name, split_part(v_email, '@', 1));
      v_last_name  := '';
    end if;

    v_phone := null;  -- Google OAuth never provides a phone number

  else
    -- Email registration — RegisterForm explicitly passes first_name / last_name
    v_first_name := coalesce(
      nullif(trim(new.raw_user_meta_data->>'first_name'), ''),
      split_part(v_email, '@', 1)
    );
    v_last_name  := coalesce(
      nullif(trim(new.raw_user_meta_data->>'last_name'), ''),
      ''
    );
    v_phone := nullif(trim(new.raw_user_meta_data->>'phone'), '');
  end if;

  -- Build full_name from the resolved parts
  v_full_name := trim(v_first_name || ' ' || v_last_name);

  insert into public.profiles (
    profile_id,
    first_name,
    last_name,
    full_name,
    email,
    contact_number,
    auth_provider,
    account_type,
    status
  ) values (
    new.id,
    v_first_name,
    v_last_name,
    v_full_name,
    v_email,
    v_phone,
    v_provider,
    'Customer',
    'Active'
  )
  on conflict (profile_id) do nothing;  -- idempotent: safe to re-run

  return new;
end;
$$;

-- The trigger runs in the auth schema (where Supabase manages users).
-- SECURITY DEFINER on the function means it runs as the function owner
-- (postgres / supabase_admin) and can bypass RLS on public.profiles.
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Grant execute so Supabase's auth module can invoke it.
grant execute on function public.handle_new_user() to supabase_auth_admin;
