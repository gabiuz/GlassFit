-- IMP-MS16: Canonical quotation document and negotiated final price.
alter table public.quotation_estimates
  add column quotation_document_snapshot jsonb,
  add column negotiated_amount numeric(12,2),
  add column negotiated_by uuid references public.profiles(profile_id) on delete set null,
  add column negotiated_at timestamptz,
  add constraint quotation_document_snapshot_object_check
    check (quotation_document_snapshot is null or jsonb_typeof(quotation_document_snapshot) = 'object'),
  add constraint quotation_negotiated_amount_range_check
    check (negotiated_amount is null or negotiated_amount between 0 and 9999999999.99),
  add constraint quotation_negotiation_audit_check
    check (
      (negotiated_amount is null and negotiated_by is null and negotiated_at is null)
      or (negotiated_amount is not null and negotiated_by is not null and negotiated_at is not null)
    );

drop policy if exists quotations_admin_write on public.quotation_estimates;

create policy quotations_admin_insert
on public.quotation_estimates for insert to authenticated
with check (public.is_admin());

create policy quotations_admin_delete
on public.quotation_estimates for delete to authenticated
using (public.is_admin());

create policy quotations_manage_bookings_update
on public.quotation_estimates for update to authenticated
using (public.has_admin_permission('manage_bookings'))
with check (public.has_admin_permission('manage_bookings'));
