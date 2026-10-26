-- RotiPOS: product cost prices and profit reporting.
--
-- Products may optionally store a cost price. The cost is snapshotted into
-- order_items at checkout/pre-order time so historical profit does not change
-- when the product master data is edited later.
--
-- Profit is always derived from recorded payments:
--   profit = payment amount - sum(coalesce(unit_cost, 0) * quantity)
-- Orders whose products have no cost price therefore count as zero cost. The
-- admin UI marks those products as "modal belum diisi" so the number is not
-- mistaken for an exact accounting figure.

-- ---------------------------------------------------------------------------
-- Cost columns
-- ---------------------------------------------------------------------------

alter table public.products add column cost_price bigint;

alter table public.products
  add constraint products_cost_price_check
  check (cost_price is null or cost_price >= 0);

comment on column public.products.cost_price is
  'Optional cost/modal price per unit in IDR. Snapshot into order_items at checkout.';

alter table public.order_items add column unit_cost bigint;

alter table public.order_items
  add constraint order_items_unit_cost_check
  check (unit_cost is null or unit_cost >= 0);

comment on column public.order_items.unit_cost is
  'Cost snapshot at order creation. Null means the product had no cost price.';

-- ---------------------------------------------------------------------------
-- Snapshot cost when orders are created
-- ---------------------------------------------------------------------------

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
      -- Heal a queue left behind by an interrupted/legacy write.
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

  insert into public.payments (order_id, amount, payment_method, paid_at, received_by)
  values (v_order.id, v_total, p_payment_method, now(), p_actor);

  insert into public.order_status_history (order_id, from_status, to_status, changed_by, actor_type, notes)
  values (v_order.id, null, 'queued', p_actor, 'cashier', 'Pesanan walk-in dibuat dari kasir');

  -- Promote fairly: if an older queued order exists, it goes first and this
  -- new order remains queued behind it.
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

create or replace function public.create_preorder(
  p_items jsonb,
  p_customer_name text,
  p_email text,
  p_phone text,
  p_pickup_at timestamptz,
  p_tracking_code_hash text,
  p_tracking_code_salt integer,
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
  v_minutes integer;
  v_customer_name text;
  v_salt integer;
begin
  v_customer_name := trim(coalesce(p_customer_name, ''));
  if length(v_customer_name) < 2 then
    raise exception 'NAMA_PEMESAN_WAJIB';
  end if;
  if length(v_customer_name) > 100 then
    raise exception 'NAMA_PEMESAN_TERLALU_PANJANG';
  end if;

  if p_email is null or length(trim(p_email)) < 5 or position('@' in p_email) < 2 then
    raise exception 'EMAIL_TIDAK_VALID';
  end if;
  if p_phone is null or length(regexp_replace(p_phone, '[^0-9]', '', 'g')) < 8 then
    raise exception 'TELEPON_TIDAK_VALID';
  end if;
  if p_pickup_at is null then
    raise exception 'JADWAL_TIDAK_VALID';
  end if;
  if p_tracking_code_hash is null or length(p_tracking_code_hash) <> 64 then
    raise exception 'KODE_LACAK_TIDAK_VALID';
  end if;

  v_salt := coalesce(p_tracking_code_salt, 0);
  if v_salt < 0 or v_salt > 1000000 then
    raise exception 'KODE_LACAK_TIDAK_VALID';
  end if;

  select min_preorder_minutes into v_minutes from public.store_settings where id = 1;
  if v_minutes is null then
    v_minutes := 60;
  end if;

  if p_pickup_at < now() + make_interval(mins => v_minutes) then
    raise exception 'JADWAL_TIDAK_VALID';
  end if;

  select coalesce(sum(subtotal), 0), count(*)
  into v_total, v_line_count
  from public.resolve_order_items(p_items);

  if v_line_count = 0 then
    raise exception 'ITEM_KOSONG';
  end if;

  insert into public.orders (
    order_code,
    order_type,
    order_status,
    payment_status,
    customer_name,
    customer_email,
    customer_phone,
    pickup_at,
    total_amount,
    tracking_code_hash,
    tracking_code_salt,
    idempotency_key
  )
  values (
    public.next_order_code('pre_order'),
    'pre_order',
    'pending_confirmation',
    'unpaid',
    v_customer_name,
    trim(p_email),
    trim(p_phone),
    p_pickup_at,
    v_total,
    p_tracking_code_hash,
    v_salt,
    p_idempotency_key
  )
  on conflict (idempotency_key) do nothing
  returning * into v_order;

  if v_order.id is null then
    if p_idempotency_key is not null then
      select * into v_order from public.orders where idempotency_key = p_idempotency_key;
    end if;

    if v_order.id is not null then
      return jsonb_build_object(
        'order_id', v_order.id,
        'order_code', v_order.order_code,
        'customer_name', v_order.customer_name,
        'total_amount', v_order.total_amount,
        'pickup_at', v_order.pickup_at,
        'tracking_code_salt', v_order.tracking_code_salt,
        'already_exists', true
      );
    end if;

    raise exception 'GAGAL_MEMBUAT_PESANAN';
  end if;

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

  insert into public.order_status_history (order_id, from_status, to_status, changed_by, actor_type, notes)
  values (v_order.id, null, 'pending_confirmation', null, 'guest', 'Pre-order dibuat dari web publik');

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_code', v_order.order_code,
    'customer_name', v_order.customer_name,
    'total_amount', v_total,
    'pickup_at', v_order.pickup_at,
    'tracking_code_salt', v_order.tracking_code_salt,
    'already_exists', false
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Reporting: revenue + profit
-- ---------------------------------------------------------------------------

drop function if exists public.report_sales(timestamptz, timestamptz, text);

create function public.report_sales(
  p_from timestamptz,
  p_to timestamptz,
  p_group text default 'day'
)
returns table (
  bucket text,
  revenue bigint,
  profit bigint,
  transactions bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tz text;
  v_format text;
begin
  select timezone into v_tz from public.store_settings where id = 1;
  v_tz := coalesce(v_tz, 'Asia/Jakarta');
  v_format := case when p_group = 'month' then 'YYYY-MM' else 'YYYY-MM-DD' end;

  return query
  select
    to_char(p.paid_at at time zone v_tz, v_format) as bucket,
    sum(p.amount)::bigint as revenue,
    sum(p.amount - coalesce(c.cost, 0))::bigint as profit,
    count(*)::bigint as transactions
  from public.payments p
  left join (
    select
      oi.order_id,
      sum(coalesce(oi.unit_cost, 0) * oi.quantity)::bigint as cost
    from public.order_items oi
    group by oi.order_id
  ) c on c.order_id = p.order_id
  where p.paid_at >= p_from and p.paid_at < p_to
  group by 1
  order by 1;
end;
$$;

drop function if exists public.report_cashiers(timestamptz, timestamptz);

create function public.report_cashiers(
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  cashier_id uuid,
  cashier_name text,
  transactions bigint,
  revenue bigint,
  profit bigint,
  cash_transactions bigint,
  qris_transactions bigint
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    pr.id as cashier_id,
    pr.full_name as cashier_name,
    count(*)::bigint as transactions,
    coalesce(sum(p.amount), 0)::bigint as revenue,
    coalesce(sum(p.amount - coalesce(c.cost, 0)), 0)::bigint as profit,
    count(*) filter (where p.payment_method = 'cash')::bigint as cash_transactions,
    count(*) filter (where p.payment_method = 'manual_qris')::bigint as qris_transactions
  from public.payments p
  join public.profiles pr on pr.id = p.received_by
  left join (
    select
      oi.order_id,
      sum(coalesce(oi.unit_cost, 0) * oi.quantity)::bigint as cost
    from public.order_items oi
    group by oi.order_id
  ) c on c.order_id = p.order_id
  where p.paid_at >= p_from
    and p.paid_at < p_to
  group by pr.id, pr.full_name
  order by profit desc, revenue desc, pr.full_name asc;
$$;

drop function if exists public.report_transactions(timestamptz, timestamptz);

create function public.report_transactions(
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  order_code text,
  order_type text,
  customer_name text,
  cashier_id uuid,
  cashier_name text,
  payment_method text,
  amount bigint,
  profit bigint,
  paid_at timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    o.order_code,
    o.order_type,
    o.customer_name,
    pr.id as cashier_id,
    pr.full_name as cashier_name,
    p.payment_method,
    p.amount::bigint as amount,
    (p.amount - coalesce(c.cost, 0))::bigint as profit,
    p.paid_at
  from public.payments p
  join public.orders o on o.id = p.order_id
  join public.profiles pr on pr.id = p.received_by
  left join (
    select
      oi.order_id,
      sum(coalesce(oi.unit_cost, 0) * oi.quantity)::bigint as cost
    from public.order_items oi
    group by oi.order_id
  ) c on c.order_id = p.order_id
  where p.paid_at >= p_from
    and p.paid_at < p_to
  order by p.paid_at asc, o.order_code asc;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges: browser roles never call these RPCs directly.
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
