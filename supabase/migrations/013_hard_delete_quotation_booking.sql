-- IMP-MS31: Admin Booking Discard-to-Hard-Delete Workflow and Bidirectional Quotation Purge
-- Traceability: PRD-F10, PRD-F12, PRD-F13, PRD-F14, SDD-C7, SDD-C8, SDD-C9, SDD-C10, ERD-E13, ERD-E14, ERD-E15, ERD-E16, QAD-TC46

-- 1. Update foreign key constraints for cascade support
alter table public.booking_requests
  drop constraint if exists booking_requests_link_fk;

alter table public.booking_requests
  add constraint booking_requests_link_fk
  foreign key (link_id) references public.signed_booking_links(link_id) on delete cascade;

alter table public.signed_booking_links
  drop constraint if exists signed_booking_links_quotation_fk;

alter table public.signed_booking_links
  add constraint signed_booking_links_quotation_fk
  foreign key (quotation_id) references public.quotation_estimates(quotation_id) on delete cascade;

alter table public.signed_booking_links
  drop constraint if exists signed_booking_links_snapshot_fk;

alter table public.signed_booking_links
  add constraint signed_booking_links_snapshot_fk
  foreign key (snapshot_id) references public.visualization_snapshots(snapshot_id) on delete set null;

-- 2. Add explicit DELETE policies for booking requests, signed links, and quotation estimates
drop policy if exists booking_requests_admin_delete on public.booking_requests;
create policy booking_requests_admin_delete on public.booking_requests
  for delete to authenticated
  using (
    public.has_admin_permission('manage_bookings')
    or public.is_admin()
  );

drop policy if exists booking_links_admin_delete on public.signed_booking_links;
create policy booking_links_admin_delete on public.signed_booking_links
  for delete to authenticated
  using (
    public.has_admin_permission('manage_bookings')
    or public.is_admin()
  );

drop policy if exists quotations_admin_delete on public.quotation_estimates;
create policy quotations_admin_delete on public.quotation_estimates
  for delete to authenticated
  using (
    public.has_admin_permission('manage_bookings')
    or public.is_admin()
  );

-- 3. Create atomic stored procedure for administrative hard deletion
create or replace function public.hard_delete_booking_quotation(
  p_booking_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid;
  v_link_id uuid;
  v_quotation_id uuid;
  v_snapshot_id uuid;
  v_pdf_r2_key text;
  v_image_r2_key text;
  v_quotation_number text;
  v_other_links_count int;
begin
  -- Assert authentication and admin permissions
  v_admin_id := auth.uid();
  if v_admin_id is null then
    raise exception 'UNAUTHENTICATED: Caller must be authenticated.';
  end if;

  if not (public.has_admin_permission('manage_bookings') or public.is_admin()) then
    raise exception 'UNAUTHORIZED: Insufficient permissions to delete booking consultations.';
  end if;

  -- Locate booking request and associated keys
  select
    br.link_id,
    sbl.quotation_id,
    qe.snapshot_id,
    qe.pdf_r2_object_key,
    qe.quotation_number
  into
    v_link_id,
    v_quotation_id,
    v_snapshot_id,
    v_pdf_r2_key,
    v_quotation_number
  from public.booking_requests br
  left join public.signed_booking_links sbl on sbl.link_id = br.link_id
  left join public.quotation_estimates qe on qe.quotation_id = sbl.quotation_id
  where br.booking_request_id = p_booking_request_id;

  if not found then
    raise exception 'NOT_FOUND: Booking request % does not exist.', p_booking_request_id;
  end if;

  -- Delete booking request
  delete from public.booking_requests
  where booking_request_id = p_booking_request_id;

  -- Delete signed booking link if present
  if v_link_id is not null then
    delete from public.signed_booking_links
    where link_id = v_link_id;
  end if;

  -- Delete quotation items and quotation estimate if present
  if v_quotation_id is not null then
    delete from public.quotation_items
    where quotation_id = v_quotation_id;

    delete from public.quotation_estimates
    where quotation_id = v_quotation_id;
  end if;

  -- Evaluate snapshot cleanup: check if snapshot is referenced by any other quotation
  if v_snapshot_id is not null then
    select count(*) into v_other_links_count
    from public.quotation_estimates
    where snapshot_id = v_snapshot_id;

    if v_other_links_count = 0 then
      select final_image_r2_key into v_image_r2_key
      from public.visualization_snapshots
      where snapshot_id = v_snapshot_id;

      delete from public.visualization_snapshots
      where snapshot_id = v_snapshot_id;
    end if;
  end if;

  -- Return summary payload containing storage keys for external purge
  return jsonb_build_object(
    'success', true,
    'booking_request_id', p_booking_request_id,
    'quotation_id', v_quotation_id,
    'quotation_number', v_quotation_number,
    'pdf_r2_object_key', v_pdf_r2_key,
    'image_r2_key', v_image_r2_key
  );
end;
$$;

revoke all on function public.hard_delete_booking_quotation(uuid) from public;
grant execute on function public.hard_delete_booking_quotation(uuid) to authenticated;
