begin;

update public.product_templates as template
set
  status = 'Active',
  updated_at = now()
from public.products as product
where product.product_id = template.product_id
  and product.status = 'Active'
  and template.status <> 'Active';

commit;
