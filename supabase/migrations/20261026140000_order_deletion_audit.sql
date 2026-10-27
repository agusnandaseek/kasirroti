-- ---------------------------------------------------------------------------
-- Migration: 20261026140000_order_deletion_audit.sql
-- Permanent transaction deletion for cashier/admin with:
--   * mandatory reason code (plus optional note),
--   * stock restoration for walk-in orders (stock is deducted on walk-in sale),
--   * immutable audit snapshot that survives the order deletion.
-- ---------------------------------------------------------------------------

create table public.order_deletions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  order_code text not null,
  order_type text not null check (order_type in ('walk_in', 'pre_order')),
  order_status text not null,
  payment_status text not null check (payment_status in ('unpaid', 'paid')),
  customer_name text not null,
  customer_email text,
  customer_phone text,
  total_amount bigint not null default 0 check (total_amount >= 0),
  payment_method text check (payment_method in ('cash', 'manual_qris')),
  payment_amount bigint check (payment_amount >= 0),
  payment_received_by uuid references public.profiles (id) on delete set null,
  payment_received_by_name text,
  payment_paid_at timestamptz,
  reason_code text not null check (
    reason_code in (
      'wrong_input',
      'duplicate',
      'customer_cancelled',
      'stock_mismatch',
      'other'
    )
  ),
  reason_note text,
  items jsonb not null default '[]'::jsonb,
  stock_restored boolean not null default false,
  units_restored integer not null default 0 check (units_restored >= 0),
  deleted_by uuid references public.profiles (id) on delete set null,
  deleted_by_name text not null,
  deleted_by_role text not null check (deleted_by_role in ('admin', 'cashier')),
  deleted_at timestamptz not null default now()
);

create index order_deletions_deleted_at_idx
  on public.order_deletions (deleted_at desc);

create index order_deletions_order_code_idx
  on public.order_deletions (order_code);

-- ---------------------------------------------------------------------------
-- Permanently delete an order and keep an audit snapshot.
-- ---------------------------------------------------------------------------
create or replace function public.delete_order_with_audit(
  p_order_id uuid,
  p_actor uuid,
  p_reason_code text,
  p_reason_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_profile public.profiles%rowtype;
  v_payment public.payments%rowtype;
  v_receiver_name text;
  v_reason_note text;
  v_items jsonb;
  v_units integer := 0;
  v_restore_stock boolean;
begin
  v_profile := public.assert_active_staff(p_actor, array['cashier', 'admin']);

  if p_reason_code is null
    or p_reason_code not in (
      'wrong_input',
      'duplicate',
      'customer_cancelled',
      'stock_mismatch',
      'other'
    )
  then
    raise exception 'ALASAN_HAPUS_TIDAK_VALID';
  end if;

  v_reason_note := nullif(trim(coalesce(p_reason_note, '')), '');
  if v_reason_note is not null and length(v_reason_note) > 500 then
    raise exception 'CATATAN_ALASAN_TERLALU_PANJANG';
  end if;
  if p_reason_code = 'other' and (v_reason_note is null or length(v_reason_note) < 5) then
    raise exception 'CATATAN_ALASAN_WAJIB';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'PESANAN_TIDAK_DITEMUKAN';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'product_id', oi.product_id,
        'product_name', oi.product_name,
        'quantity', oi.quantity,
        'unit_price', oi.unit_price,
        'unit_cost', oi.unit_cost,
        'subtotal', oi.subtotal
      )
      order by oi.product_name asc
    ),
    '[]'::jsonb
  )
  into v_items
  from public.order_items oi
  where oi.order_id = v_order.id;

  select coalesce(sum(oi.quantity), 0)
  into v_units
  from public.order_items oi
  where oi.order_id = v_order.id;

  select * into v_payment
  from public.payments
  where order_id = v_order.id;

  if v_payment.id is not null then
    select full_name into v_receiver_name
    from public.profiles
    where id = v_payment.received_by;
  end if;

  -- Stock is only deducted when a walk-in sale is created. Pre-orders never
  -- touch stock, so restoring it would inflate inventory.
  v_restore_stock := v_order.order_type = 'walk_in';

  if v_restore_stock then
    update public.products p
    set
      stock = p.stock + sold.quantity,
      is_available = true,
      updated_at = now()
    from (
      select product_id, sum(quantity)::integer as quantity
      from public.order_items
      where order_id = v_order.id
      group by product_id
    ) sold
    where p.id = sold.product_id;
  else
    v_units := 0;
  end if;

  insert into public.order_deletions (
    order_id,
    order_code,
    order_type,
    order_status,
    payment_status,
    customer_name,
    customer_email,
    customer_phone,
    total_amount,
    payment_method,
    payment_amount,
    payment_received_by,
    payment_received_by_name,
    payment_paid_at,
    reason_code,
    reason_note,
    items,
    stock_restored,
    units_restored,
    deleted_by,
    deleted_by_name,
    deleted_by_role
  )
  values (
    v_order.id,
    v_order.order_code,
    v_order.order_type,
    v_order.order_status,
    v_order.payment_status,
    v_order.customer_name,
    v_order.customer_email,
    v_order.customer_phone,
    v_order.total_amount,
    v_payment.payment_method,
    v_payment.amount,
    v_payment.received_by,
    v_receiver_name,
    v_payment.paid_at,
    p_reason_code,
    v_reason_note,
    v_items,
    v_restore_stock,
    v_units,
    v_profile.id,
    v_profile.full_name,
    v_profile.role
  );

  -- payments has ON DELETE RESTRICT, so remove it before the parent order.
  delete from public.payments where order_id = v_order.id;
  delete from public.orders where id = v_order.id;

  -- If an active queue entry was removed, keep production moving.
  if v_order.order_status in ('queued', 'preparing', 'ready') then
    perform public.promote_next_queued(p_actor);
  end if;

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_code', v_order.order_code,
    'reason_code', p_reason_code,
    'stock_restored', v_restore_stock,
    'units_restored', v_units,
    'items', v_items
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Security: default deny, service role only (same posture as the rest of the DB)
-- ---------------------------------------------------------------------------
alter table public.order_deletions enable row level security;

revoke all on table public.order_deletions from anon, authenticated;
grant all on table public.order_deletions to service_role;

revoke execute on function public.delete_order_with_audit(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.delete_order_with_audit(uuid, uuid, text, text)
  to service_role;
