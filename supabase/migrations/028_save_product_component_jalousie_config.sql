-- IMP-MS81, PRD-F14, SDD-C9, ERD-E6, QAD-TC96.1
-- Rollback: re-execute migration 024 definition without jalousie_config
-- Atomic save component with materials: incorporates jalousie_config column persistence
create or replace function public.save_product_component_with_materials(
  p_template_id uuid, p_component_key text, p_component jsonb, p_bindings jsonb
) returns uuid
language plpgsql security invoker set search_path = public
as $$
declare
  v_id uuid;
  v_binding jsonb;
  v_count integer;
  v_defaults integer;
begin
  if auth.uid() is null or not public.has_admin_permission('manage_products') then
    raise exception 'manage_products permission is required';
  end if;
  if not exists (select 1 from public.product_templates where template_id = p_template_id) then
    raise exception 'Product template is unavailable';
  end if;
  if p_component_key is null or btrim(p_component_key) = '' or
     p_component is null or jsonb_typeof(p_component) <> 'object' or
     p_bindings is null or jsonb_typeof(p_bindings) <> 'array' then
    raise exception 'Invalid component save payload';
  end if;

  select count(*), count(*) filter (where (item->>'is_default')::boolean)
    into v_count, v_defaults
  from jsonb_array_elements(p_bindings) item;
  if (v_count > 0 and v_defaults <> 1) or (v_count = 0 and v_defaults <> 0) then
    raise exception 'Component bindings require exactly one default';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_bindings) item
    where jsonb_typeof(item) <> 'object'
      or nullif(item->>'raw_material_id', '') is null
      or (item->>'display_order')::integer < 0
  ) or exists (
    select 1 from jsonb_array_elements(p_bindings) item
    group by item->>'raw_material_id' having count(*) > 1
  ) then
    raise exception 'Component bindings contain invalid or duplicate materials';
  end if;

  insert into public.product_components (
    template_id, created_by, updated_by, component_key, component_name,
    component_type, base_quantity, raw_material_id, unit_price, pricing_method,
    dimension_binding, jalousie_config, span_ratio, is_removable, toggle_property_key,
    presentation_category, glb_file_url, component_data, is_accessory_slot,
    accessory_category, allowed_accessory_ids, position_options, status
  ) values (
    p_template_id, auth.uid(), auth.uid(), p_component_key,
    p_component->>'component_name', p_component->>'component_type',
    (p_component->>'base_quantity')::numeric, (p_component->>'raw_material_id')::uuid,
    (p_component->>'unit_price')::numeric, p_component->>'pricing_method',
    p_component->>'dimension_binding', p_component->'jalousie_config',
    (p_component->>'span_ratio')::numeric,
    (p_component->>'is_removable')::boolean, p_component->>'toggle_property_key',
    p_component->>'presentation_category', p_component->>'glb_file_url',
    p_component->'component_data', (p_component->>'is_accessory_slot')::boolean,
    p_component->>'accessory_category',
    case when jsonb_typeof(p_component->'allowed_accessory_ids') = 'array'
      then array(select jsonb_array_elements_text(p_component->'allowed_accessory_ids')::uuid)
      else null end,
    p_component->'position_options', 'Active'
  )
  on conflict (template_id, component_key) do update set
    updated_by = auth.uid(), component_name = excluded.component_name,
    component_type = excluded.component_type, base_quantity = excluded.base_quantity,
    raw_material_id = excluded.raw_material_id, unit_price = excluded.unit_price,
    pricing_method = excluded.pricing_method, dimension_binding = excluded.dimension_binding,
    jalousie_config = excluded.jalousie_config,
    span_ratio = excluded.span_ratio, is_removable = excluded.is_removable,
    toggle_property_key = excluded.toggle_property_key,
    presentation_category = excluded.presentation_category,
    glb_file_url = excluded.glb_file_url, component_data = excluded.component_data,
    is_accessory_slot = excluded.is_accessory_slot,
    accessory_category = excluded.accessory_category,
    allowed_accessory_ids = excluded.allowed_accessory_ids,
    position_options = excluded.position_options
  returning component_id into v_id;

  -- Replacement within this transaction avoids unique-default conflicts and is retry safe.
  delete from public.product_component_materials where product_component_id = v_id;
  for v_binding in select value from jsonb_array_elements(p_bindings) loop
    insert into public.product_component_materials (
      product_component_id, raw_material_id, is_default, display_order
    ) values (
      v_id, (v_binding->>'raw_material_id')::uuid,
      (v_binding->>'is_default')::boolean, (v_binding->>'display_order')::integer
    );
  end loop;
  if v_count = 0 then
    update public.product_components set raw_material_id = null where component_id = v_id;
  end if;
  return v_id;
end;
$$;

revoke all on function public.save_product_component_with_materials(uuid,text,jsonb,jsonb) from public, anon;
grant execute on function public.save_product_component_with_materials(uuid,text,jsonb,jsonb) to authenticated;

