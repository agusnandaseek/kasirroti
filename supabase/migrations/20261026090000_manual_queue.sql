-- RotiPOS: optional manual queue control on top of the automatic FIFO flow.
--
-- Default behavior stays exactly the same:
--   * New orders join the queue with no manual position and are promoted in
--     queued_at / created_at / id order.
--   * When no order is preparing or ready, the first eligible queued order is
--     promoted automatically.
--
-- The cashier can also:
--   * reorder waiting orders (queue_position), which only changes the explicit
--     order of the waiting queue; untouched queues remain FIFO;
--   * hold an order (queue_held), keeping it queued but skipping it during
--     automatic promotion until it is released.
--
-- All queue mutations take the same transaction-scoped advisory lock and the
-- partial unique index still guarantees at most one active production order.

-- ---------------------------------------------------------------------------
-- Queue state
-- ---------------------------------------------------------------------------

alter table public.orders add column queue_position integer;
alter table public.orders add column queue_held boolean not null default false;

alter table public.orders
  add constraint orders_queue_position_check
  check (queue_position is null or queue_position > 0);

-- Used by promote_next_queued and the cashier queue listing. The partial index
-- also documents that only waiting, non-held orders participate in FIFO.
create index orders_production_queue_idx
  on public.orders (
    queue_position asc nulls last,
    queued_at asc nulls last,
    created_at asc,
    id asc
  )
  where order_status = 'queued' and queue_held = false;

-- ---------------------------------------------------------------------------
-- Automatic promotion helper (manual order first, FIFO as the fallback)
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
    and queue_held = false
  order by
    queue_position asc nulls last,
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

  update public.orders
  set
    order_status = 'preparing',
    queue_position = null,
    queue_held = false,
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
-- Manual reorder: move one waiting order up or down one position
-- ---------------------------------------------------------------------------

create or replace function public.reorder_queue_order(
  p_order_id uuid,
  p_direction text,
  p_actor uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_ids uuid[];
  v_index integer;
  v_target integer;
  v_swap uuid;
  v_moved boolean := false;
  v_next jsonb;
begin
  perform public.assert_active_staff(p_actor);
  perform pg_advisory_xact_lock(hashtext('rotipos_production_queue'));

  if p_direction is null or p_direction not in ('up', 'down') then
    raise exception 'ARAH_ANTREAN_TIDAK_VALID';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'PESANAN_TIDAK_DITEMUKAN';
  end if;

  if v_order.order_status <> 'queued' then
    raise exception 'STATUS_TIDAK_VALID';
  end if;

  if v_order.queue_held then
    raise exception 'ANTREAN_DITAHAN';
  end if;

  -- Effective order of all waiting, non-held orders.
  select array_agg(
    id
    order by
      queue_position asc nulls last,
      queued_at asc nulls last,
      created_at asc,
      id asc
  )
  into v_ids
  from public.orders
  where order_status = 'queued'
    and queue_held = false;

  v_index := array_position(v_ids, v_order.id);
  if v_index is null then
    raise exception 'STATUS_TIDAK_VALID';
  end if;

  if (p_direction = 'up' and v_index > 1)
    or (p_direction = 'down' and v_index < array_length(v_ids, 1))
  then
    v_target := case when p_direction = 'up' then v_index - 1 else v_index + 1 end;
    v_swap := v_ids[v_index];
    v_ids[v_index] := v_ids[v_target];
    v_ids[v_target] := v_swap;
    v_moved := true;

    -- Persist the complete visible order so a later manual move is always
    -- relative to what the cashier sees. New orders still join with a NULL
    -- position and therefore land after explicitly ordered tickets.
    update public.orders o
    set queue_position = (u.ord * 10)::integer
    from unnest(v_ids) with ordinality as u(id, ord)
    where o.id = u.id;
  end if;

  -- Heal a queue left behind by a legacy/interrupted write, and report the
  -- automatic promotion to the caller.
  v_next := public.promote_next_queued(p_actor);
  select * into v_order from public.orders where id = p_order_id;

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_status', v_order.order_status,
    'queue_position', v_order.queue_position,
    'queue_held', v_order.queue_held,
    'moved', v_moved,
    'promoted_order_id', v_next ->> 'promoted_order_id',
    'promoted_order_code', v_next ->> 'promoted_order_code',
    'promoted_order_status', v_next ->> 'promoted_order_status'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Hold / release one waiting order
-- ---------------------------------------------------------------------------

create or replace function public.set_queue_hold(
  p_order_id uuid,
  p_held boolean,
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
  v_next jsonb;
begin
  perform public.assert_active_staff(p_actor);
  perform pg_advisory_xact_lock(hashtext('rotipos_production_queue'));

  if p_held is null then
    raise exception 'STATUS_TAHAN_TIDAK_VALID';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'PESANAN_TIDAK_DITEMUKAN';
  end if;

  if v_order.order_status <> 'queued' then
    raise exception 'STATUS_TIDAK_VALID';
  end if;

  if p_held then
    if v_order.queue_held then
      v_already := true;
    else
      -- Remove it from the explicit order. Releasing later puts it at the end
      -- of the queue, which is predictable for the cashier.
      update public.orders
      set queue_held = true, queue_position = null, updated_at = now()
      where id = v_order.id;
    end if;
  else
    if not v_order.queue_held then
      v_already := true;
    else
      update public.orders
      set queue_held = false, queue_position = null, updated_at = now()
      where id = v_order.id;

      -- Keep the existing relative order of the other waiting orders, then
      -- place the released order last.
      with ordered as (
        select
          id,
          row_number() over (
            order by
              case when id = v_order.id then 1 else 0 end,
              queue_position asc nulls last,
              queued_at asc nulls last,
              created_at asc,
              id asc
          ) as rn
        from public.orders
        where order_status = 'queued'
          and queue_held = false
      )
      update public.orders o
      set queue_position = (ordered.rn * 10)::integer
      from ordered
      where o.id = ordered.id
        and o.queue_position is distinct from (ordered.rn * 10)::integer;
    end if;
  end if;

  v_next := public.promote_next_queued(p_actor);
  select * into v_order from public.orders where id = p_order_id;

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_status', v_order.order_status,
    'queue_position', v_order.queue_position,
    'queue_held', v_order.queue_held,
    'already_exists', v_already,
    'promoted_order_id', v_next ->> 'promoted_order_id',
    'promoted_order_code', v_next ->> 'promoted_order_code',
    'promoted_order_status', v_next ->> 'promoted_order_status'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- A manually started order must also respect a hold request.
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

  if v_order.queue_held then
    raise exception 'ANTREAN_DITAHAN';
  end if;

  if exists (
    select 1 from public.orders where order_status in ('preparing', 'ready')
  ) then
    raise exception 'ADA_PESANAN_AKTIF';
  end if;

  update public.orders
  set
    order_status = 'preparing',
    queue_position = null,
    queue_held = false,
    updated_at = now()
  where id = v_order.id
  returning * into v_order;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by, actor_type, notes)
  values (v_order.id, 'queued', 'preparing', p_actor, 'cashier', 'Produksi dimulai');

  return jsonb_build_object('order_id', v_order.id, 'order_status', v_order.order_status, 'already_exists', false);
end;
$$;

-- ---------------------------------------------------------------------------
-- Cancellation clears queue-only state.
-- ---------------------------------------------------------------------------

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
    queue_held = false,
    queue_position = null,
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

-- ---------------------------------------------------------------------------
-- Function privileges: browser roles never call these RPCs directly.
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
