-- RotiPOS: priority queue, 5-character tracking codes, cashier reports.
--
-- Queue model
--   * FIFO remains the default.
--   * A cashier can mark any waiting order as "Proses". If no order is active,
--     it starts immediately. If another order is already preparing/ready, the
--     chosen order becomes the single next-priority order:
--       waiting 2,3,4 + priority 4  ->  active 1, then 4, 2, 3.
--   * At most one order may be preparing/ready. Every queue mutation takes the
--     rotipos_production_queue advisory lock.
--
-- Tracking
--   * The public tracking credential is now a 5-character code.
--   * Only HMAC-SHA256(code) is stored. The salt is stored so an idempotent
--     retry can derive the exact same code again.
--
-- Reports
--   * Per-cashier totals and transaction-level rows for exports.

-- ---------------------------------------------------------------------------
-- Queue state
-- ---------------------------------------------------------------------------

alter table public.orders add column queue_priority boolean not null default false;

-- The old manual reorder/hold API is replaced by the priority flow.
drop function if exists public.reorder_queue_order(uuid, text, uuid);
drop function if exists public.set_queue_hold(uuid, boolean, uuid);

-- Replace queue-aware functions before dropping the old columns.
create or replace function public.promote_next_queued(p_actor uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_was_priority boolean;
begin
  perform pg_advisory_xact_lock(hashtext('rotipos_production_queue'));

  if exists (
    select 1 from public.orders where order_status in ('preparing', 'ready')
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
  order by
    queue_priority desc,
    queued_at asc nulls last,
    created_at asc,
    id asc
  limit 1
  for update skip locked;

  if v_order.id is null then
    return jsonb_build_object(
      'promoted_order_id', null,
      'promoted_order_code', null,
      'promoted_order_status', null
    );
  end if;

  v_was_priority := v_order.queue_priority;

  update public.orders
  set
    order_status = 'preparing',
    queue_priority = false,
    updated_at = now()
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
    case
      when v_was_priority then 'Prioritas manual mulai diproses'
      else 'Otomatis mulai diproses karena tidak ada pesanan aktif'
    end
  );

  return jsonb_build_object(
    'promoted_order_id', v_order.id,
    'promoted_order_code', v_order.order_code,
    'promoted_order_status', v_order.order_status
  );
end;
$$;

create or replace function public.prioritize_queue_order(
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
  v_active public.orders%rowtype;
  v_already boolean := false;
begin
  perform public.assert_active_staff(p_actor);
  perform pg_advisory_xact_lock(hashtext('rotipos_production_queue'));

  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'PESANAN_TIDAK_DITEMUKAN';
  end if;

  if v_order.order_status = 'preparing' then
    return jsonb_build_object(
      'order_id', v_order.id,
      'order_status', v_order.order_status,
      'queue_priority', false,
      'already_exists', true,
      'active_order_code', v_order.order_code,
      'active_order_status', v_order.order_status
    );
  end if;

  if v_order.order_status <> 'queued' then
    raise exception 'STATUS_TIDAK_VALID';
  end if;

  select *
  into v_active
  from public.orders
  where order_status in ('preparing', 'ready')
  limit 1;

  if v_active.id is null then
    update public.orders
    set
      order_status = 'preparing',
      queue_priority = false,
      updated_at = now()
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
      'cashier',
      'Produksi dimulai manual oleh kasir'
    );

    return jsonb_build_object(
      'order_id', v_order.id,
      'order_status', v_order.order_status,
      'queue_priority', false,
      'already_exists', false,
      'active_order_code', null,
      'active_order_status', null
    );
  end if;

  if v_order.queue_priority then
    v_already := true;
  else
    update public.orders
    set queue_priority = false, updated_at = now()
    where order_status = 'queued'
      and queue_priority = true
      and id <> v_order.id;

    update public.orders
    set queue_priority = true, updated_at = now()
    where id = v_order.id
    returning * into v_order;
  end if;

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_status', v_order.order_status,
    'queue_priority', v_order.queue_priority,
    'already_exists', v_already,
    'active_order_code', v_active.order_code,
    'active_order_status', v_active.order_status
  );
end;
$$;

create or replace function public.clear_queue_priority(
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
  v_already boolean := false;
begin
  perform public.assert_active_staff(p_actor);
  perform pg_advisory_xact_lock(hashtext('rotipos_production_queue'));

  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'PESANAN_TIDAK_DITEMUKAN';
  end if;

  if v_order.order_status <> 'queued' then
    raise exception 'STATUS_TIDAK_VALID';
  end if;

  if not v_order.queue_priority then
    v_already := true;
  else
    update public.orders
    set queue_priority = false, updated_at = now()
    where id = v_order.id
    returning * into v_order;
  end if;

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_status', v_order.order_status,
    'queue_priority', v_order.queue_priority,
    'already_exists', v_already
  );
end;
$$;

-- Keep the old manual-start RPC, but clear the new priority marker.
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
  set
    order_status = 'preparing',
    queue_priority = false,
    updated_at = now()
  where id = v_order.id
  returning * into v_order;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by, actor_type, notes)
  values (v_order.id, 'queued', 'preparing', p_actor, 'cashier', 'Produksi dimulai');

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
  set
    order_status = 'cancelled',
    cancellation_reason = v_reason,
    queue_priority = false,
    updated_at = now()
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

drop index if exists public.orders_production_queue_idx;

alter table public.orders drop constraint if exists orders_queue_position_check;
alter table public.orders drop column if exists queue_position;
alter table public.orders drop column if exists queue_held;

create index if not exists orders_priority_queue_idx
  on public.orders (
    queue_priority desc,
    queued_at asc nulls last,
    created_at asc,
    id asc
  )
  where order_status = 'queued';

-- ---------------------------------------------------------------------------
-- Tracking code
-- ---------------------------------------------------------------------------

alter table public.orders rename column tracking_token_hash to tracking_code_hash;
alter table public.orders add column tracking_code_salt integer not null default 0;

alter table public.orders
  add constraint orders_tracking_code_salt_check
  check (tracking_code_salt >= 0 and tracking_code_salt <= 1000000);

drop function if exists public.create_preorder(jsonb, text, text, text, timestamptz, text, uuid);

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
    'tracking_code_salt', v_order.tracking_code_salt,
    'already_exists', false
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Reporting
-- ---------------------------------------------------------------------------

create or replace function public.report_cashiers(
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  cashier_id uuid,
  cashier_name text,
  transactions bigint,
  revenue bigint,
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
    count(*) filter (where p.payment_method = 'cash')::bigint as cash_transactions,
    count(*) filter (where p.payment_method = 'manual_qris')::bigint as qris_transactions
  from public.payments p
  join public.profiles pr on pr.id = p.received_by
  where p.paid_at >= p_from
    and p.paid_at < p_to
  group by pr.id, pr.full_name
  order by revenue desc, transactions desc, pr.full_name asc;
$$;

create or replace function public.report_transactions(
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  order_code text,
  order_type text,
  customer_name text,
  cashier_name text,
  payment_method text,
  amount bigint,
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
    pr.full_name as cashier_name,
    p.payment_method,
    p.amount::bigint,
    p.paid_at
  from public.payments p
  join public.orders o on o.id = p.order_id
  join public.profiles pr on pr.id = p.received_by
  where p.paid_at >= p_from
    and p.paid_at < p_to
  order by p.paid_at asc, o.order_code asc;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges: browser roles never call these RPCs directly.
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
