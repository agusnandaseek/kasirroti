import type { OrderItemView, OrderStatus, OrderType, OrderView, PaymentStatus } from "@/lib/types";

export type OrderItemRow = {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number | string;
  unit_cost?: number | string | null;
  subtotal: number | string;
};

export type CashierProfileRow = {
  full_name: string;
};

export type OrderPaymentRow = {
  amount?: number | string;
  payment_method?: "cash" | "manual_qris";
  paid_at?: string;
  profiles?: CashierProfileRow | CashierProfileRow[] | null;
};

export type OrderRow = {
  id: string;
  order_code: string;
  order_type: OrderType;
  order_status: OrderStatus;
  payment_status: PaymentStatus;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  pickup_at: string | null;
  total_amount: number | string;
  created_at: string;
  confirmed_at: string | null;
  queued_at: string | null;
  completed_at: string | null;
  cancellation_reason: string | null;
  queue_priority: boolean;
  idempotency_key?: string | null;
  tracking_code_salt?: number | null;
  order_items?: OrderItemRow[] | null;
  payments?: OrderPaymentRow[] | OrderPaymentRow | null;
};

function paymentCashierName(payment: OrderPaymentRow | null | undefined) {
  if (!payment) return null;
  const profile = Array.isArray(payment.profiles) ? payment.profiles[0] : payment.profiles;
  return profile?.full_name ?? null;
}

export function mapOrderItems(rows: OrderItemRow[] | null | undefined): OrderItemView[] {
  return [...(rows ?? [])]
    .sort((a, b) => a.product_name.localeCompare(b.product_name, "id"))
    .map((item) => ({
      productId: item.product_id,
      productName: item.product_name,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unit_price),
      unitCost: item.unit_cost == null ? null : Number(item.unit_cost),
      subtotal: Number(item.subtotal),
    }));
}

export function mapOrder(row: OrderRow): OrderView {
  const payment = Array.isArray(row.payments) ? (row.payments[0] ?? null) : (row.payments ?? null);

  return {
    id: row.id,
    code: row.order_code,
    trackingCode: null,
    type: row.order_type,
    status: row.order_status,
    paymentStatus: row.payment_status,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    pickupAt: row.pickup_at,
    totalAmount: Number(row.total_amount),
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at,
    queuedAt: row.queued_at,
    completedAt: row.completed_at,
    cancellationReason: row.cancellation_reason,
    queuePriority: row.queue_priority,
    cashierName: paymentCashierName(payment),
    items: mapOrderItems(row.order_items),
  };
}

export type OrderHistoryRow = {
  id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  actor_type: "guest" | "cashier" | "admin" | "system";
  notes: string | null;
  changed_at: string;
};

export type PaymentRow = {
  amount: number | string;
  payment_method: "cash" | "manual_qris";
  paid_at: string;
  profiles?: CashierProfileRow | CashierProfileRow[] | null;
};

export type OrderDetailRow = Omit<OrderRow, "payments"> & {
  order_status_history?: OrderHistoryRow[] | null;
  payments?: PaymentRow[] | PaymentRow | null;
};

export type PaymentView = {
  amount: number;
  payment_method: "cash" | "manual_qris";
  paid_at: string;
};

export type OrderDetailView = OrderView & {
  history: OrderHistoryRow[];
  payment: PaymentView | null;
};

export function mapOrderDetail(row: OrderDetailRow): OrderDetailView {
  const payment = Array.isArray(row.payments) ? (row.payments[0] ?? null) : (row.payments ?? null);

  return {
    ...mapOrder(row),
    history: [...(row.order_status_history ?? [])].sort((a, b) =>
      a.changed_at.localeCompare(b.changed_at),
    ),
    payment: payment
      ? {
          amount: Number(payment.amount),
          payment_method: payment.payment_method,
          paid_at: payment.paid_at,
        }
      : null,
  };
}
