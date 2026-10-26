-- RotiPOS: customer names + automatic one-at-a-time production sequencing.
--
-- Rules introduced here:
--   * Every order stores the customer's name so the cashier queue is usable.
--   * A newly checked-out order first joins the FIFO queue. If no order is
--     currently preparing/ready, the earliest queued order is promoted to
--     preparing immediately.
--   * Completing or cancelling the active order promotes the next FIFO order
--     automatically. At most one order may be preparing or ready.
--
-- All production mutations take the same transaction-scoped advisory lock so
-- two cashiers cannot create/promote two active orders at the same time. The
-- partial unique index is the database backstop for that invariant.

-- ---------------------------------------------------------------------------
-- Customer name
-- ---------------------------------------------------------------------------

alter table public.orders add column customer_name text;

-- Backfill old demo data. New writes are validated by the RPCs below.
update public.orders
set customer_name = coalesce(
  nullif(trim(split_part(coalesce(customer_email, ''), '@', 1)), ''),
  'Pelanggan'
)
where customer_name is null;

alter table public.orders alter column customer_name set not null;

alter table public.orders
  add constraint orders_customer_name_check
  check (length(trim(customer_name)) between 1 and 100);

create index orders_customer_name_idx on public.orders (customer_name);

-- ---------------------------------------------------------------------------
-- One active production order
-- ---------------------------------------------------------------------------

-- Repair any legacy rows before adding the hard constraint. Keep the oldest
-- ready/preparing order active and move the rest back to the queue.
with ranked as (
  select
    id,
    row_number() over (
      order by
        case when order_status = 'ready' then 0 else 1 end,
        queued_at asc nulls last,
        created_at asc,
        id asc
    ) as rn
  from public.orders
  where order_status in ('preparing', 'ready')
)
update public.orders o
set order_status = 'queued', updated_at = now()
from ranked r
where o.id = r.id
  and r.rn > 1;

create unique index orders_one_active_production_idx
  on public.orders ((true))
  where order_status in ('preparing', 'ready');

-- ---------------------------------------------------------------------------
-- FIFO promotion helper
-- ---------------------------------------------------------------------------

create or replace function public.promote_next_queued(p_actor uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
begin
  -- Re-entrant within a transaction; all callers also take this lock before
  -- inspecting or mutating production state.
  perform pg_advisory_xact_lock(hashtext('rotipos_production_queue'));

  if exists (
    select 1
    from public.orders
    where order_status in ('preparing', 'ready')
  ) then
    return jsonb_build_object(
      'promoted_order_id', null,
      'promoted_order_code', null,
      'promoted_order_status', null
    );
  end if;

  select *
  into v_order
  from public.orders
  where order_status = 'queued'
  order by queued_at asc nulls last, created_at asc, id asc
  limit 1
  for update skip locked;

  if v_order.id is null then
    return jsonb_build_object(
      'promoted_order_id', null,
      'promoted_order_code', null,
      'promoted_order_status', null
    );
  end if;

  update public.orders
  set order_status = 'preparing', updated_at = now()
  where id = v_order.id
  returning * into v_order;

  insert into public.order_status_history (
    order_id,
    from_status,
    to_status,
    changed_by,
    actor_type,
    notes
  )
  values (
    v_order.id,
    'queued',
    'preparing',
    p_actor,
    'system',
    'Otomatis mulai diproses karena tidak ada pesanan aktif'
  );

  return jsonb_build_object(
    'promoted_order_id', v_order.id,
    'promoted_order_code', v_order.order_code,
    'promoted_order_status', v_order.order_status
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Walk-in checkout
-- ---------------------------------------------------------------------------

drop function if exists public.create_walkin_order(jsonb, text, uuid, uuid);

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

  insert into public.order_items (order_id, product_id, product_name, quantity, unit_price, subtotal)
  select v_order.id, product_id, product_name, quantity, unit_price, subtotal
  from public.resolve_order_items(p_items);

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

-- ---------------------------------------------------------------------------
-- Public pre-order creation
-- ---------------------------------------------------------------------------

drop function if exists public.create_preorder(jsonb, text, text, timestamptz, text, uuid);

create or replace function public.create_preorder(
  p_items jsonb,
  p_customer_name text,
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
  v_customer_name text;
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
    customer_name,
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
    v_customer_name,
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
        'customer_name', v_order.customer_name,
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
    'customer_name', v_order.customer_name,
    'total_amount', v_total,
    'pickup_at', v_order.pickup_at,
    'already_exists', false
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Pre-order enqueue
-- ---------------------------------------------------------------------------

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
  perform pg_advisory_xact_lock(hashtext('rotipos_production_queue'));

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
    if v_order.order_status in ('queued', 'preparing', 'ready')
      and v_order.queued_at is not null
    then
      perform public.promote_next_queued(p_actor);
      select * into v_order from public.orders where id = v_order.id;
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

  perform public.promote_next_queued(p_actor);
  select * into v_order from public.orders where id = v_order.id;

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_status', v_order.order_status,
    'queued_at', v_order.queued_at,
    'already_exists', false
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Manual start (fallback; normally promotion is automatic)
-- ---------------------------------------------------------------------------

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
  perform pg_advisory_xact_lock(hashtext('rotipos_production_queue'));

  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'PESANAN_TIDAK_DITEMUKAN';
  end if;

  if v_order.order_status = 'preparing' then
    return jsonb_build_object('order_id', v_order.id, 'order_status', v_order.order_status, 'already_exists', true);
  end if;

  if v_order.order_status <> 'queued' then
    raise exception 'STATUS_TIDAK_VALID';
  end if;

  if exists (
    select 1 from public.orders where order_status in ('preparing', 'ready')
  ) then
    raise exception 'ADA_PESANAN_AKTIF';
  end if;

  update public.orders
  set order_status = 'preparing', updated_at = now()
  where id = v_order.id
  returning * into v_order;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by, actor_type, notes)
  values (v_order.id, 'queued', 'preparing', p_actor, 'cashier', 'Produksi dimulai');

  return jsonb_build_object('order_id', v_order.id, 'order_status', v_order.order_status, 'already_exists', false);
end;
$$;

-- ---------------------------------------------------------------------------
-- Completion & cancellation promote the next FIFO order
-- ---------------------------------------------------------------------------

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
  v_next jsonb;
begin
  perform public.assert_active_staff(p_actor);
  perform pg_advisory_xact_lock(hashtext('rotipos_production_queue'));

  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'PESANAN_TIDAK_DITEMUKAN';
  end if;

  if v_order.order_status = 'completed' then
    v_next := public.promote_next_queued(p_actor);
    return jsonb_build_object(
      'order_id', v_order.id,
      'order_status', v_order.order_status,
      'already_exists', true,
      'promoted_order_id', v_next ->> 'promoted_order_id',
      'promoted_order_code', v_next ->> 'promoted_order_code',
      'promoted_order_status', v_next ->> 'promoted_order_status'
    );
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

  v_next := public.promote_next_queued(p_actor);

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_status', v_order.order_status,
    'already_exists', false,
    'promoted_order_id', v_next ->> 'promoted_order_id',
    'promoted_order_code', v_next ->> 'promoted_order_code',
    'promoted_order_status', v_next ->> 'promoted_order_status'
  );
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
  v_next jsonb;
begin
  perform public.assert_active_staff(p_actor, array['admin']);
  perform pg_advisory_xact_lock(hashtext('rotipos_production_queue'));

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

  v_next := public.promote_next_queued(p_actor);

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_status', v_order.order_status,
    'already_exists', false,
    'promoted_order_id', v_next ->> 'promoted_order_id',
    'promoted_order_code', v_next ->> 'promoted_order_code',
    'promoted_order_status', v_next ->> 'promoted_order_status'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges: browser roles never call these RPCs directly.
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
