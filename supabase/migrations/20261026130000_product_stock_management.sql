-- ---------------------------------------------------------------------------
-- Migration: 20261026130000_product_stock_management.sql
-- Stock column, stock adjustments, and auto-decrement on walk-in sales
-- ---------------------------------------------------------------------------

-- 1. Add stock column to products
alter table public.products
  add column if not exists stock integer not null default 20 check (stock >= 0);

create index if not exists products_stock_idx on public.products (stock);

-- 2. RPC to adjust stock by delta (+1, -1, +5, etc.) for cashier & admin
create or replace function public.adjust_product_stock(
  p_product_id uuid,
  p_delta integer,
  p_actor uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_product public.products%rowtype;
  v_new_stock integer;
begin
  perform public.assert_active_staff(p_actor, array['cashier', 'admin']);

  select * into v_product
  from public.products
  where id = p_product_id
  for update;

  if v_product.id is null then
    raise exception 'PRODUK_TIDAK_DITEMUKAN';
  end if;

  v_new_stock := v_product.stock + p_delta;
  if v_new_stock < 0 then
    raise exception 'STOK_TIDAK_BOLEH_NEGATIF';
  end if;

  update public.products
  set
    stock = v_new_stock,
    is_available = (v_new_stock > 0),
    updated_at = now()
  where id = p_product_id
  returning * into v_product;

  return jsonb_build_object(
    'product_id', v_product.id,
    'product_name', v_product.name,
    'stock', v_product.stock,
    'is_available', v_product.is_available
  );
end;
$$;

-- 3. RPC to set absolute product stock
create or replace function public.set_product_stock(
  p_product_id uuid,
  p_new_stock integer,
  p_actor uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_product public.products%rowtype;
begin
  perform public.assert_active_staff(p_actor, array['cashier', 'admin']);

  if p_new_stock < 0 then
    raise exception 'STOK_TIDAK_BOLEH_NEGATIF';
  end if;

  update public.products
  set
    stock = p_new_stock,
    is_available = (p_new_stock > 0),
    updated_at = now()
  where id = p_product_id
  returning * into v_product;

  if v_product.id is null then
    raise exception 'PRODUK_TIDAK_DITEMUKAN';
  end if;

  return jsonb_build_object(
    'product_id', v_product.id,
    'product_name', v_product.name,
    'stock', v_product.stock,
    'is_available', v_product.is_available
  );
end;
$$;

-- 4. Update create_walkin_order to validate and decrement stock
create or replace function public.create_walkin_order(
  p_items jsonb,
  p_payment_method text,
  p_actor uuid,
  p_customer_name text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_total bigint;
  v_line_count integer;
  v_customer_name text;
  v_insufficient_item record;
begin
  perform public.assert_active_staff(p_actor, array['cashier', 'admin']);
  perform pg_advisory_xact_lock(hashtext('rotipos_production_queue'));

  v_customer_name := trim(coalesce(p_customer_name, ''));
  if length(v_customer_name) < 2 then
    raise exception 'NAMA_PEMESAN_WAJIB';
  end if;
  if length(v_customer_name) > 100 then
    raise exception 'NAMA_PEMESAN_TERLALU_PANJANG';
  end if;

  if p_payment_method is null or p_payment_method not in ('cash', 'manual_qris') then
    raise exception 'METODE_PEMBAYARAN_TIDAK_VALID';
  end if;

  if p_payment_method = 'manual_qris'
    and not coalesce((select manual_qris_enabled from public.store_settings where id = 1), false)
  then
    raise exception 'QRIS_TIDAK_AKTIF';
  end if;

  select coalesce(sum(subtotal), 0), count(*)
  into v_total, v_line_count
  from public.resolve_order_items(p_items);

  if v_line_count = 0 then
    raise exception 'ITEM_KOSONG';
  end if;

  -- Check stock sufficiency
  select r.product_name, p.stock, r.quantity
  into v_insufficient_item
  from public.resolve_order_items(p_items) r
  join public.products p on p.id = r.product_id
  where p.stock < r.quantity
  limit 1;

  if v_insufficient_item.product_name is not null then
    raise exception 'STOK_TIDAK_CUKUP: Stok % hanya tersisa % (diminta %)',
      v_insufficient_item.product_name,
      v_insufficient_item.stock,
      v_insufficient_item.quantity;
  end if;

  insert into public.orders (
    order_code,
    order_type,
    order_status,
    payment_status,
    customer_name,
    total_amount,
    created_by,
    queued_at,
    idempotency_key
  )
  values (
    public.next_order_code('walk_in'),
    'walk_in',
    'queued',
    'paid',
    v_customer_name,
    v_total,
    p_actor,
    now(),
    p_idempotency_key
  )
  on conflict (idempotency_key) do nothing
  returning * into v_order;

  if v_order.id is null then
    if p_idempotency_key is not null then
      select * into v_order from public.orders where idempotency_key = p_idempotency_key;
    end if;

    if v_order.id is not null then
      perform public.promote_next_queued(p_actor);
      select * into v_order from public.orders where id = v_order.id;

      return jsonb_build_object(
        'order_id', v_order.id,
        'order_code', v_order.order_code,
        'order_status', v_order.order_status,
        'customer_name', v_order.customer_name,
        'total_amount', v_order.total_amount,
        'already_exists', true
      );
    end if;

    raise exception 'GAGAL_MEMBUAT_PESANAN';
  end if;

  -- Insert order items
  insert into public.order_items (
    order_id,
    product_id,
    product_name,
    quantity,
    unit_price,
    unit_cost,
    subtotal
  )
  select
    v_order.id,
    r.product_id,
    r.product_name,
    r.quantity,
    r.unit_price,
    p.cost_price,
    r.subtotal
  from public.resolve_order_items(p_items) r
  join public.products p on p.id = r.product_id;

  -- Decrement stock and update is_available if 0
  update public.products p
  set
    stock = p.stock - r.quantity,
    is_available = case when (p.stock - r.quantity) <= 0 then false else p.is_available end,
    updated_at = now()
  from public.resolve_order_items(p_items) r
  where p.id = r.product_id;

  -- Record payment
  insert into public.payments (order_id, amount, payment_method, paid_at, received_by)
  values (v_order.id, v_total, p_payment_method, now(), p_actor);

  -- Record status history
  insert into public.order_status_history (order_id, from_status, to_status, changed_by, actor_type, notes)
  values (v_order.id, null, 'queued', p_actor, 'cashier', 'Pesanan walk-in dibuat dari kasir');

  -- Promote fairly in queue
  perform public.promote_next_queued(p_actor);
  select * into v_order from public.orders where id = v_order.id;

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_code', v_order.order_code,
    'order_status', v_order.order_status,
    'customer_name', v_order.customer_name,
    'total_amount', v_order.total_amount,
    'already_exists', false
  );
end;
$$;
