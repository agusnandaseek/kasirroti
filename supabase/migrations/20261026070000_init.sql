-- RotiPOS MVP schema
-- 7 core tables + 1 auxiliary rate-limit table.
-- All money is integer rupiah. All timestamps are timestamptz.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('admin', 'cashier')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price bigint not null check (price >= 0),
  image_url text,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.store_settings (
  id smallint primary key default 1 check (id = 1),
  store_name text not null,
  timezone text not null default 'Asia/Jakarta',
  business_hours jsonb not null,
  slot_interval_minutes integer not null default 30 check (slot_interval_minutes > 0),
  min_preorder_minutes integer not null default 60 check (min_preorder_minutes >= 0),
  manual_qris_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  order_type text not null check (order_type in ('walk_in', 'pre_order')),
  order_status text not null check (
    order_status in (
      'pending_confirmation',
      'confirmed',
      'queued',
      'preparing',
      'ready',
      'completed',
      'rejected',
      'cancelled'
    )
  ),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid')),
  customer_email text,
  customer_phone text,
  pickup_at timestamptz,
  total_amount bigint not null default 0 check (total_amount >= 0),
  tracking_token_hash text unique,
  created_by uuid references public.profiles (id),
  confirmed_by uuid references public.profiles (id),
  confirmed_at timestamptz,
  queued_at timestamptz,
  completed_at timestamptz,
  cancellation_reason text,
  idempotency_key uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_preorder_fields_check check (
    order_type = 'walk_in'
    or (
      customer_email is not null
      and customer_phone is not null
      and pickup_at is not null
      and tracking_token_hash is not null
    )
  ),
  constraint orders_walkin_fields_check check (
    order_type = 'pre_order'
    or (pickup_at is null and tracking_token_hash is null)
  ),
  constraint orders_walkin_creator_check check (
    order_type = 'pre_order' or created_by is not null
  ),
  constraint orders_queued_at_check check (
    order_status not in ('queued', 'preparing', 'ready', 'completed')
    or queued_at is not null
  ),
  constraint orders_completed_paid_check check (
    order_status <> 'completed' or payment_status = 'paid'
  ),
  constraint orders_preorder_pickup_check check (
    order_type = 'walk_in' or pickup_at is not null
  )
);

create index orders_status_idx on public.orders (order_status);
create index orders_queued_at_idx on public.orders (queued_at);
create index orders_pickup_at_idx on public.orders (pickup_at);
create index orders_created_at_idx on public.orders (created_at);
create index orders_type_status_idx on public.orders (order_type, order_status);
create index orders_paid_at_idx on public.orders (payment_status, completed_at);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  product_name text not null,
  quantity integer not null constraint order_items_quantity_check check (quantity > 0),
  unit_price bigint not null constraint order_items_unit_price_check check (unit_price >= 0),
  subtotal bigint not null constraint order_items_subtotal_positive_check check (subtotal >= 0),
  constraint order_items_subtotal_check check (subtotal = quantity::bigint * unit_price),
  constraint order_items_unique_product unique (order_id, product_id)
);

create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete restrict,
  amount bigint not null check (amount >= 0),
  payment_method text not null check (payment_method in ('cash', 'manual_qris')),
  paid_at timestamptz not null default now(),
  received_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index payments_paid_at_idx on public.payments (paid_at);
create index payments_received_by_idx on public.payments (received_by);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references public.profiles (id),
  actor_type text not null check (actor_type in ('guest', 'cashier', 'admin', 'system')),
  notes text,
  changed_at timestamptz not null default now()
);

create index order_status_history_order_idx on public.order_status_history (order_id, changed_at);

-- Auxiliary table: distributed-ish rate limiting for public endpoints.
create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count integer not null default 0 check (count >= 0)
);

-- Order code sequences: concurrency-safe, human readable.
create sequence public.walkin_order_seq start 1;
create sequence public.preorder_order_seq start 1;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create trigger store_settings_set_updated_at
before update on public.store_settings
for each row execute function public.set_updated_at();

create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------

create or replace function public.assert_active_staff(
  p_actor uuid,
  p_roles text[] default array['cashier', 'admin']
)
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if p_actor is null then
    raise exception 'AKUN_TIDAK_DITEMUKAN';
  end if;

  select * into v_profile from public.profiles where id = p_actor;
  if not found then
    raise exception 'AKUN_TIDAK_DITEMUKAN';
  end if;
  if not v_profile.is_active then
    raise exception 'AKUN_NONAKTIF';
  end if;
  if not (v_profile.role = any (p_roles)) then
    raise exception 'AKSES_DITOLAK';
  end if;

  return v_profile;
end;
$$;

create or replace function public.next_order_code(p_type text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_seq bigint;
begin
  if p_type = 'walk_in' then
    v_seq := nextval('public.walkin_order_seq');
    return 'W-' || lpad(v_seq::text, 6, '0');
  elsif p_type = 'pre_order' then
    v_seq := nextval('public.preorder_order_seq');
    return 'PO-' || lpad(v_seq::text, 6, '0');
  end if;

  raise exception 'TIPE_ORDER_TIDAK_VALID';
end;
$$;

-- Resolve product IDs from the client into trusted price snapshots.
create or replace function public.resolve_order_items(p_items jsonb)
returns table (
  product_id uuid,
  product_name text,
  quantity integer,
  unit_price bigint,
  subtotal bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
  v_valid integer;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'ITEM_TIDAK_VALID';
  end if;

  v_count := jsonb_array_length(p_items);
  if v_count = 0 then
    raise exception 'ITEM_KOSONG';
  end if;
  if v_count > 50 then
    raise exception 'ITEM_TERLALU_BANYAK';
  end if;

  select count(*) into v_valid
  from jsonb_array_elements(p_items) as elem
  join public.products p on p.id = (elem ->> 'product_id')::uuid
  where p.is_available = true
    and coalesce((elem ->> 'quantity')::integer, 0) between 1 and 999;

  if v_valid <> v_count then
    raise exception 'PRODUK_TIDAK_VALID';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as elem
    group by (elem ->> 'product_id')
    having sum((elem ->> 'quantity')::integer) > 999
  ) then
    raise exception 'KUANTITAS_TERLALU_BESAR';
  end if;

  return query
  with raw as (
    select
      (elem ->> 'product_id')::uuid as pid,
      (elem ->> 'quantity')::integer as qty
    from jsonb_array_elements(p_items) as elem
  ),
  grouped as (
    select pid, sum(qty)::integer as qty
    from raw
    group by pid
  )
  select p.id, p.name, g.qty, p.price, g.qty::bigint * p.price
  from grouped g
  join public.products p on p.id = g.pid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public / cashier mutations
-- ---------------------------------------------------------------------------

create or replace function public.create_walkin_order(
  p_items jsonb,
  p_payment_method text,
  p_actor uuid,
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
begin
  perform public.assert_active_staff(p_actor, array['cashier', 'admin']);

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
      return jsonb_build_object(
        'order_id', v_order.id,
        'order_code', v_order.order_code,
        'total_amount', v_order.total_amount,
        'already_exists', true
      );
    end if;

    raise exception 'GAGAL_MEMBUAT_PESANAN';
  end if;

  insert into public.order_items (order_id, product_id, product_name, quantity, unit_price, subtotal)
  select v_order.id, product_id, product_name, quantity, unit_price, subtotal
  from public.resolve_order_items(p_items);

  insert into public.payments (order_id, amount, payment_method, paid_at, received_by)
  values (v_order.id, v_total, p_payment_method, now(), p_actor);

  insert into public.order_status_history (order_id, from_status, to_status, changed_by, actor_type, notes)
  values (v_order.id, null, 'queued', p_actor, 'cashier', 'Pesanan walk-in dibayar di kasir');

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_code', v_order.order_code,
    'total_amount', v_total,
    'already_exists', false
  );
end;
$$;

create or replace function public.create_preorder(
  p_items jsonb,
  p_email text,
  p_phone text,
  p_pickup_at timestamptz,
  p_token_hash text,
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
begin
  if p_email is null or length(trim(p_email)) < 5 or position('@' in p_email) < 2 then
    raise exception 'EMAIL_TIDAK_VALID';
  end if;
  if p_phone is null or length(regexp_replace(p_phone, '[^0-9]', '', 'g')) < 8 then
    raise exception 'TELEPON_TIDAK_VALID';
  end if;
  if p_pickup_at is null then
    raise exception 'JADWAL_TIDAK_VALID';
  end if;
  if p_token_hash is null or length(p_token_hash) <> 64 then
    raise exception 'TOKEN_TIDAK_VALID';
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
    customer_email,
    customer_phone,
    pickup_at,
    total_amount,
    tracking_token_hash,
    idempotency_key
  )
  values (
    public.next_order_code('pre_order'),
    'pre_order',
    'pending_confirmation',
    'unpaid',
    trim(p_email),
    trim(p_phone),
    p_pickup_at,
    v_total,
    p_token_hash,
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
        'total_amount', v_order.total_amount,
        'pickup_at', v_order.pickup_at,
        'already_exists', true
      );
    end if;

    raise exception 'GAGAL_MEMBUAT_PESANAN';
  end if;

  insert into public.order_items (order_id, product_id, product_name, quantity, unit_price, subtotal)
  select v_order.id, product_id, product_name, quantity, unit_price, subtotal
  from public.resolve_order_items(p_items);

  insert into public.order_status_history (order_id, from_status, to_status, changed_by, actor_type, notes)
  values (v_order.id, null, 'pending_confirmation', null, 'guest', 'Pre-order dibuat dari web publik');

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_code', v_order.order_code,
    'total_amount', v_total,
    'pickup_at', v_order.pickup_at,
    'already_exists', false
  );
end;
$$;

create or replace function public.confirm_preorder(
  p_order_id uuid,
  p_actor uuid,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
begin
  perform public.assert_active_staff(p_actor);

  update public.orders
  set
    order_status = 'confirmed',
    confirmed_by = p_actor,
    confirmed_at = now(),
    updated_at = now()
  where id = p_order_id
    and order_type = 'pre_order'
    and order_status = 'pending_confirmation'
  returning * into v_order;

  if v_order.id is null then
    select * into v_order from public.orders where id = p_order_id;
    if v_order.id is null then
      raise exception 'PESANAN_TIDAK_DITEMUKAN';
    end if;
    if v_order.order_status = 'confirmed' then
      return jsonb_build_object('order_id', v_order.id, 'order_status', v_order.order_status, 'already_exists', true);
    end if;
    raise exception 'STATUS_TIDAK_VALID';
  end if;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by, actor_type, notes)
  values (v_order.id, 'pending_confirmation', 'confirmed', p_actor, 'cashier', p_notes);

  return jsonb_build_object('order_id', v_order.id, 'order_status', v_order.order_status, 'already_exists', false);
end;
$$;

create or replace function public.reject_preorder(
  p_order_id uuid,
  p_actor uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_reason text;
begin
  perform public.assert_active_staff(p_actor);

  v_reason := trim(coalesce(p_reason, ''));
  if length(v_reason) < 3 then
    raise exception 'ALASAN_WAJIB';
  end if;

  update public.orders
  set
    order_status = 'rejected',
    cancellation_reason = v_reason,
    updated_at = now()
  where id = p_order_id
    and order_type = 'pre_order'
    and order_status = 'pending_confirmation'
  returning * into v_order;

  if v_order.id is null then
    select * into v_order from public.orders where id = p_order_id;
    if v_order.id is null then
      raise exception 'PESANAN_TIDAK_DITEMUKAN';
    end if;
    raise exception 'STATUS_TIDAK_VALID';
  end if;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by, actor_type, notes)
  values (v_order.id, 'pending_confirmation', 'rejected', p_actor, 'cashier', v_reason);

  return jsonb_build_object('order_id', v_order.id, 'order_status', v_order.order_status, 'already_exists', false);
end;
$$;

create or replace function public.enqueue_preorder(
  p_order_id uuid,
  p_actor uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
begin
  perform public.assert_active_staff(p_actor);

  update public.orders
  set
    order_status = 'queued',
    queued_at = coalesce(queued_at, now()),
    updated_at = now()
  where id = p_order_id
    and order_type = 'pre_order'
    and order_status = 'confirmed'
  returning * into v_order;

  if v_order.id is null then
    select * into v_order from public.orders where id = p_order_id;
    if v_order.id is null then
      raise exception 'PESANAN_TIDAK_DITEMUKAN';
    end if;
    if v_order.order_status = 'queued' and v_order.queued_at is not null then
      return jsonb_build_object(
        'order_id', v_order.id,
        'order_status', v_order.order_status,
        'queued_at', v_order.queued_at,
        'already_exists', true
      );
    end if;
    raise exception 'STATUS_TIDAK_VALID';
  end if;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by, actor_type, notes)
  values (v_order.id, 'confirmed', 'queued', p_actor, 'cashier', 'Dimasukkan ke antrean produksi');

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_status', v_order.order_status,
    'queued_at', v_order.queued_at,
    'already_exists', false
  );
end;
$$;

create or replace function public.start_preparing(
  p_order_id uuid,
  p_actor uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
begin
  perform public.assert_active_staff(p_actor);

  update public.orders
  set order_status = 'preparing', updated_at = now()
  where id = p_order_id
    and order_status = 'queued'
  returning * into v_order;

  if v_order.id is null then
    select * into v_order from public.orders where id = p_order_id;
    if v_order.id is null then
      raise exception 'PESANAN_TIDAK_DITEMUKAN';
    end if;
    if v_order.order_status = 'preparing' then
      return jsonb_build_object('order_id', v_order.id, 'order_status', v_order.order_status, 'already_exists', true);
    end if;
    raise exception 'STATUS_TIDAK_VALID';
  end if;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by, actor_type, notes)
  values (v_order.id, 'queued', 'preparing', p_actor, 'cashier', 'Produksi dimulai');

  return jsonb_build_object('order_id', v_order.id, 'order_status', v_order.order_status, 'already_exists', false);
end;
$$;

create or replace function public.mark_ready(
  p_order_id uuid,
  p_actor uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
begin
  perform public.assert_active_staff(p_actor);

  update public.orders
  set order_status = 'ready', updated_at = now()
  where id = p_order_id
    and order_status = 'preparing'
  returning * into v_order;

  if v_order.id is null then
    select * into v_order from public.orders where id = p_order_id;
    if v_order.id is null then
      raise exception 'PESANAN_TIDAK_DITEMUKAN';
    end if;
    if v_order.order_status = 'ready' then
      return jsonb_build_object('order_id', v_order.id, 'order_status', v_order.order_status, 'already_exists', true);
    end if;
    raise exception 'STATUS_TIDAK_VALID';
  end if;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by, actor_type, notes)
  values (v_order.id, 'preparing', 'ready', p_actor, 'cashier', 'Pesanan siap diambil');

  return jsonb_build_object('order_id', v_order.id, 'order_status', v_order.order_status, 'already_exists', false);
end;
$$;

create or replace function public.record_manual_payment(
  p_order_id uuid,
  p_payment_method text,
  p_actor uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
begin
  perform public.assert_active_staff(p_actor);

  if p_payment_method is null or p_payment_method not in ('cash', 'manual_qris') then
    raise exception 'METODE_PEMBAYARAN_TIDAK_VALID';
  end if;

  if p_payment_method = 'manual_qris'
    and not coalesce((select manual_qris_enabled from public.store_settings where id = 1), false)
  then
    raise exception 'QRIS_TIDAK_AKTIF';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'PESANAN_TIDAK_DITEMUKAN';
  end if;

  select * into v_payment from public.payments where order_id = p_order_id;
  if v_payment.id is not null then
    return jsonb_build_object(
      'order_id', v_order.id,
      'payment_status', v_order.payment_status,
      'payment_method', v_payment.payment_method,
      'already_exists', true
    );
  end if;

  if v_order.payment_status = 'paid' then
    raise exception 'DATA_PEMBAYARAN_TIDAK_KONSISTEN';
  end if;

  if v_order.order_status not in ('confirmed', 'queued', 'preparing', 'ready') then
    raise exception 'STATUS_TIDAK_VALID';
  end if;

  insert into public.payments (order_id, amount, payment_method, paid_at, received_by)
  values (v_order.id, v_order.total_amount, p_payment_method, now(), p_actor)
  returning * into v_payment;

  update public.orders
  set payment_status = 'paid', updated_at = now()
  where id = v_order.id;

  return jsonb_build_object(
    'order_id', v_order.id,
    'payment_status', 'paid',
    'payment_method', v_payment.payment_method,
    'already_exists', false
  );
end;
$$;

create or replace function public.complete_order(
  p_order_id uuid,
  p_actor uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
begin
  perform public.assert_active_staff(p_actor);

  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'PESANAN_TIDAK_DITEMUKAN';
  end if;

  if v_order.order_status = 'completed' then
    return jsonb_build_object('order_id', v_order.id, 'order_status', v_order.order_status, 'already_exists', true);
  end if;

  if v_order.order_status <> 'ready' then
    raise exception 'STATUS_TIDAK_VALID';
  end if;

  if v_order.payment_status <> 'paid' then
    raise exception 'BELUM_DIBAYAR';
  end if;

  update public.orders
  set order_status = 'completed', completed_at = now(), updated_at = now()
  where id = v_order.id
  returning * into v_order;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by, actor_type, notes)
  values (v_order.id, 'ready', 'completed', p_actor, 'cashier', 'Pesanan diserahkan');

  return jsonb_build_object('order_id', v_order.id, 'order_status', v_order.order_status, 'already_exists', false);
end;
$$;

create or replace function public.cancel_order(
  p_order_id uuid,
  p_actor uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_previous text;
  v_reason text;
begin
  perform public.assert_active_staff(p_actor, array['admin']);

  v_reason := trim(coalesce(p_reason, ''));
  if length(v_reason) < 3 then
    raise exception 'ALASAN_WAJIB';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'PESANAN_TIDAK_DITEMUKAN';
  end if;

  if v_order.order_status not in ('pending_confirmation', 'confirmed', 'queued', 'preparing', 'ready') then
    raise exception 'STATUS_TIDAK_VALID';
  end if;

  v_previous := v_order.order_status;

  update public.orders
  set order_status = 'cancelled', cancellation_reason = v_reason, updated_at = now()
  where id = v_order.id
  returning * into v_order;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by, actor_type, notes)
  values (v_order.id, v_previous, 'cancelled', p_actor, 'admin', v_reason);

  return jsonb_build_object('order_id', v_order.id, 'order_status', v_order.order_status, 'already_exists', false);
end;
$$;

-- ---------------------------------------------------------------------------
-- Rate limiting
-- ---------------------------------------------------------------------------

create or replace function public.check_rate_limit(
  p_key text,
  p_window_seconds integer,
  p_max integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
  v_start timestamptz;
begin
  if p_key is null or p_window_seconds <= 0 or p_max <= 0 then
    return true;
  end if;

  insert into public.rate_limits (key, window_start, count)
  values (p_key, now(), 0)
  on conflict (key) do nothing;

  select count, window_start into v_count, v_start
  from public.rate_limits
  where key = p_key
  for update;

  if v_start < now() - make_interval(secs => p_window_seconds) then
    update public.rate_limits
    set count = 1, window_start = now()
    where key = p_key;
    return true;
  end if;

  update public.rate_limits
  set count = count + 1
  where key = p_key
  returning count into v_count;

  return v_count <= p_max;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reporting
-- ---------------------------------------------------------------------------

create or replace function public.dashboard_metrics()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tz text;
  v_start timestamptz;
  v_end timestamptz;
  v_revenue bigint;
  v_paid bigint;
  v_queue bigint;
  v_pending bigint;
  v_pickup_today bigint;
begin
  select timezone into v_tz from public.store_settings where id = 1;
  v_tz := coalesce(v_tz, 'Asia/Jakarta');
  v_start := date_trunc('day', now() at time zone v_tz) at time zone v_tz;
  v_end := v_start + interval '1 day';

  select coalesce(sum(amount), 0), count(*)
  into v_revenue, v_paid
  from public.payments
  where paid_at >= v_start and paid_at < v_end;

  select count(*) into v_queue
  from public.orders
  where order_status in ('queued', 'preparing', 'ready');

  select count(*) into v_pending
  from public.orders
  where order_type = 'pre_order' and order_status = 'pending_confirmation';

  select count(*) into v_pickup_today
  from public.orders
  where order_type = 'pre_order'
    and order_status in ('confirmed', 'queued', 'preparing', 'ready')
    and pickup_at >= v_start
    and pickup_at < v_end;

  return jsonb_build_object(
    'revenue_today', v_revenue,
    'paid_today', v_paid,
    'active_queue', v_queue,
    'pending_preorders', v_pending,
    'pickup_today', v_pickup_today
  );
end;
$$;

create or replace function public.report_sales(
  p_from timestamptz,
  p_to timestamptz,
  p_group text default 'day'
)
returns table (
  bucket text,
  revenue bigint,
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
    to_char(paid_at at time zone v_tz, v_format) as bucket,
    sum(amount)::bigint as revenue,
    count(*)::bigint as transactions
  from public.payments
  where paid_at >= p_from and paid_at < p_to
  group by 1
  order by 1;
end;
$$;

create or replace function public.report_best_sellers(
  p_from timestamptz,
  p_to timestamptz,
  p_limit integer default 5
)
returns table (
  product_name text,
  quantity bigint,
  revenue bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  select
    oi.product_name,
    sum(oi.quantity)::bigint as quantity,
    sum(oi.subtotal)::bigint as revenue
  from public.payments p
  join public.orders o on o.id = p.order_id
  join public.order_items oi on oi.order_id = o.id
  where p.paid_at >= p_from and p.paid_at < p_to
  group by oi.product_name
  order by quantity desc, revenue desc
  limit greatest(p_limit, 1);
end;
$$;

-- ---------------------------------------------------------------------------
-- Security: default deny for public/authenticated roles.
-- The Next.js server uses the service role; the browser never queries tables.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.order_status_history enable row level security;
alter table public.store_settings enable row level security;
alter table public.rate_limits enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.products from anon, authenticated;
revoke all on table public.orders from anon, authenticated;
revoke all on table public.order_items from anon, authenticated;
revoke all on table public.payments from anon, authenticated;
revoke all on table public.order_status_history from anon, authenticated;
revoke all on table public.store_settings from anon, authenticated;
revoke all on table public.rate_limits from anon, authenticated;

revoke all on sequence public.walkin_order_seq from anon, authenticated;
revoke all on sequence public.preorder_order_seq from anon, authenticated;

grant all on table public.profiles to service_role;
grant all on table public.products to service_role;
grant all on table public.orders to service_role;
grant all on table public.order_items to service_role;
grant all on table public.payments to service_role;
grant all on table public.order_status_history to service_role;
grant all on table public.store_settings to service_role;
grant all on table public.rate_limits to service_role;

grant all on sequence public.walkin_order_seq to service_role;
grant all on sequence public.preorder_order_seq to service_role;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
