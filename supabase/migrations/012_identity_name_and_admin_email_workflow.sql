-- IMP-MS30, PRD-F12, PRD-F14, ERD-E2, ERD-E20

begin;

alter table public.profiles alter column last_name set default '';
alter table public.profiles drop constraint if exists profiles_last_name_not_blank;

create table if not exists public.admin_email_change_events (
  event_id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(profile_id) on delete set null,
  target_user_id uuid not null,
  actor_full_name text not null,
  actor_role text not null check (actor_role in ('Owner', 'Manager', 'Staff')),
  previous_email varchar(254) not null,
  proposed_email varchar(254) not null,
  change_mode text not null check (change_mode in ('StaffApproval', 'PrivilegedImmediate')),
  status text not null check (status in ('Initiated', 'PendingApproval', 'Processing', 'Rejected', 'Cancelled', 'Expired', 'Completed', 'Failed')),
  approval_token_hash char(64) unique check (approval_token_hash is null or approval_token_hash ~ '^[0-9a-f]{64}$'),
  approval_expires_at timestamptz,
  delivery_status text not null default 'Pending' check (delivery_status in ('Pending', 'NotRequired', 'Delivered', 'Partial', 'Failed')),
  approval_deliveries jsonb not null default '[]'::jsonb check (jsonb_typeof(approval_deliveries) = 'array'),
  delivery_attempts integer not null default 0 check (delivery_attempts >= 0),
  processing_by uuid references public.profiles(profile_id) on delete set null,
  processing_started_at timestamptz,
  decided_by uuid references public.profiles(profile_id) on delete set null,
  decided_at timestamptz,
  last_error text,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint admin_email_change_staff_approval_fields check (
    (change_mode = 'StaffApproval' and approval_token_hash is not null and approval_expires_at is not null)
    or (change_mode = 'PrivilegedImmediate' and approval_token_hash is null and approval_expires_at is null)
  )
);

alter table public.admin_email_change_events enable row level security;
create index if not exists admin_email_events_profile_idx on public.admin_email_change_events(profile_id);
create index if not exists admin_email_events_target_idx on public.admin_email_change_events(target_user_id);
create index if not exists admin_email_events_status_idx on public.admin_email_change_events(status);
create index if not exists admin_email_events_delivery_idx on public.admin_email_change_events(delivery_status);
create index if not exists admin_email_events_expiry_idx on public.admin_email_change_events(approval_expires_at);
create index if not exists admin_email_events_requested_idx on public.admin_email_change_events(requested_at desc);
create unique index if not exists admin_email_events_one_pending_staff_idx
  on public.admin_email_change_events(profile_id) where status = 'PendingApproval';

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := coalesce(new.email, new.raw_user_meta_data->>'email', '');
  v_provider text;
  v_first_name text;
  v_last_name text;
  v_phone text;
  v_google_name text;
  v_space integer;
begin
  if (new.raw_app_meta_data->'providers') @> '["google"]'::jsonb then
    v_provider := 'Google';
    v_google_name := nullif(regexp_replace(trim(normalize(new.raw_user_meta_data->>'name', NFC)), '\s+', ' ', 'g'), '');
    v_space := position(' ' in coalesce(v_google_name, ''));
    if v_space > 0 then
      v_first_name := left(v_google_name, v_space - 1);
      v_last_name := trim(substring(v_google_name from v_space + 1));
    else
      v_first_name := coalesce(v_google_name, split_part(v_email, '@', 1));
      v_last_name := '';
    end if;
    v_phone := null;
  else
    v_provider := 'Email';
    v_first_name := coalesce(nullif(regexp_replace(trim(normalize(new.raw_user_meta_data->>'first_name', NFC)), '\s+', ' ', 'g'), ''), split_part(v_email, '@', 1));
    v_last_name := coalesce(regexp_replace(trim(normalize(new.raw_user_meta_data->>'last_name', NFC)), '\s+', ' ', 'g'), '');
    v_phone := nullif(trim(new.raw_user_meta_data->>'phone'), '');
  end if;

  insert into public.profiles (profile_id, first_name, last_name, email, contact_number, auth_provider, account_type, status)
  values (new.id, left(v_first_name, 50), left(v_last_name, 50), v_email, v_phone, v_provider, 'Customer', 'Active')
  on conflict (profile_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();
grant execute on function public.handle_new_user() to supabase_auth_admin;

create or replace function public.sync_profile_email_from_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is not null then
    update public.profiles set email = lower(new.email) where profile_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
after update of email on auth.users
for each row when (old.email is distinct from new.email)
execute function public.sync_profile_email_from_auth();

commit;
