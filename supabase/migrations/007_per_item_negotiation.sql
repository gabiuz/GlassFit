-- IMP-MS17: Server-owned per-item quotation negotiation.
alter table public.quotation_estimates
  add column item_price_overrides jsonb,
  add constraint quotation_item_price_overrides_object_check
    check (item_price_overrides is null or jsonb_typeof(item_price_overrides) = 'object');

do $$
declare
  quote record;
  item_count integer;
  distinct_count integer;
  calculated_total bigint;
  negotiated_total bigint;
  allocated_total bigint;
  overrides jsonb;
begin
  for quote in
    select quotation_id, quotation_document_snapshot, negotiated_amount, negotiated_by, negotiated_at
    from public.quotation_estimates
    where quotation_document_snapshot is not null and negotiated_amount is not null
  loop
    if quote.quotation_document_snapshot->>'schemaVersion' <> '1'
       or jsonb_typeof(quote.quotation_document_snapshot->'items') <> 'array'
       or jsonb_array_length(quote.quotation_document_snapshot->'items') = 0 then
      raise exception 'IMP-MS17 migration: quotation % has an invalid V1 snapshot', quote.quotation_id;
    end if;

    select count(*), count(distinct nullif(btrim(item->>'itemId'), ''))
      into item_count, distinct_count
      from jsonb_array_elements(quote.quotation_document_snapshot->'items') item;
    if item_count <> distinct_count then
      raise exception 'IMP-MS17 migration: quotation % has blank or duplicate itemId values', quote.quotation_id;
    end if;

    select coalesce(sum(round(((item->>'calculatedSubtotal')::numeric) * 100)::bigint), 0)
      into calculated_total from jsonb_array_elements(quote.quotation_document_snapshot->'items') item;
    negotiated_total := round(quote.negotiated_amount * 100)::bigint;

    if negotiated_total = calculated_total then
      update public.quotation_estimates set negotiated_amount = null, negotiated_by = null, negotiated_at = null
      where quotation_id = quote.quotation_id;
      continue;
    end if;

    with item_values as (
      select ordinality::integer as position, item->>'itemId' as item_id,
        round(((item->>'calculatedSubtotal')::numeric) * 100)::bigint as calculated_cents
      from jsonb_array_elements(quote.quotation_document_snapshot->'items') with ordinality source(item, ordinality)
    ), shares as (
      select *, case
        when item_count = 1 then negotiated_total
        when calculated_total = 0 then case when position = 1 then negotiated_total else 0 end
        else floor((negotiated_total::numeric * calculated_cents) / calculated_total)::bigint
      end as floor_cents,
      case when calculated_total = 0 then 0::numeric else ((negotiated_total::numeric * calculated_cents) / calculated_total) % 1 end as remainder
      from item_values
    ), ranked as (
      select *, row_number() over (order by remainder desc, position) as remainder_rank,
        negotiated_total - sum(floor_cents) over () as cents_remaining
      from shares
    ), allocations as (
      select *, floor_cents + case when remainder_rank <= cents_remaining then 1 else 0 end as allocated_cents
      from ranked
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'itemId', item_id,
      'negotiatedSubtotal', allocated_cents::numeric / 100,
      'negotiatedBy', quote.negotiated_by,
      'negotiatedAt', quote.negotiated_at
    ) order by position) filter (where allocated_cents <> calculated_cents), '[]'::jsonb),
    sum(allocated_cents)
    into overrides, allocated_total from allocations;

    if allocated_total <> negotiated_total then
      raise exception 'IMP-MS17 migration: allocation mismatch for quotation %', quote.quotation_id;
    end if;
    update public.quotation_estimates
      set item_price_overrides = jsonb_build_object('schemaVersion', 1, 'entries', overrides)
      where quotation_id = quote.quotation_id;
  end loop;
end $$;
