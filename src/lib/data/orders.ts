import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";
import { getTodayRange } from "@/lib/format";
import { deriveTrackingCode } from "@/lib/tokens";
import { isTrackingCodeFormat, normalizeTrackingCode } from "@/lib/token-format";
import type {
  OrderStatus,
  OrderType,
  OrderView,
  PaymentMethod,
  SalesBucket,
} from "@/lib/types";
import {
  mapOrder,
  mapOrderDetail,
  mapOrderItems,
  type OrderDetailRow,
  type OrderItemRow,
  type OrderRow,
} from "@/lib/data/mappers";

const ORDER_SELECT =
  "id, order_code, order_type, order_status, payment_status, customer_name, customer_email, customer_phone, pickup_at, total_amount, created_at, confirmed_at, queued_at, completed_at, cancellation_reason, queue_priority, idempotency_key, tracking_code_salt, order_items(product_id, product_name, quantity, unit_price, unit_cost, subtotal), payments(amount, payment_method, paid_at, profiles(full_name))";

/**
 * `tracking_code_hash` is all that is stored, so staff views re-derive the
 * five-character code from the idempotency key and its collision salt.
 */
function mapPreorderWithTracking(row: OrderRow): OrderView {
  return {
    ...mapOrder(row),
    trackingCode: row.idempotency_key
      ? deriveTrackingCode(row.idempotency_key, Number(row.tracking_code_salt ?? 0))
      : null,
  };
}

export async function listActiveQueue(): Promise<OrderView[]> {
  const { data, error } = await getAdminClient()
    .from("orders")
    .select(ORDER_SELECT)
    .in("order_status", ["queued", "preparing", "ready"])
    .order("queue_priority", { ascending: false })
    .order("queued_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw new Error(`Gagal memuat antrean: ${error.message}`);
  return ((data ?? []) as unknown as OrderRow[]).map(mapOrder);
}

export async function listCompletedToday(timezone: string): Promise<OrderView[]> {
  const { start, end } = getTodayRange(timezone);

  const { data, error } = await getAdminClient()
    .from("orders")
    .select(ORDER_SELECT)
    .eq("order_status", "completed")
    .gte("completed_at", start.toISOString())
    .lt("completed_at", end.toISOString())
    .order("completed_at", { ascending: false });

  if (error) throw new Error(`Gagal memuat riwayat selesai: ${error.message}`);
  return ((data ?? []) as unknown as OrderRow[]).map(mapOrder);
}

export async function getOrderDetail(id: string) {
  const { data, error } = await getAdminClient()
    .from("orders")
    .select(
      `${ORDER_SELECT}, order_status_history(id, from_status, to_status, actor_type, notes, changed_at)`,
    )
    .eq("id", id)
    .maybeSingle<OrderDetailRow>();

  if (error) throw new Error(`Gagal memuat detail pesanan: ${error.message}`);
  if (!data) return null;

  return {
    ...mapOrderDetail(data),
    trackingCode: data.idempotency_key
      ? deriveTrackingCode(data.idempotency_key, Number(data.tracking_code_salt ?? 0))
      : null,
  };
}

export async function getOrderSummary(id: string): Promise<OrderView | null> {
  const { data, error } = await getAdminClient()
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", id)
    .maybeSingle<OrderRow>();

  if (error) throw new Error(`Gagal memuat pesanan: ${error.message}`);
  return data ? mapOrder(data) : null;
}

export type CashierPreorders = {
  pending: OrderView[];
  scheduled: OrderView[];
};

export async function listCashierPreorders(): Promise<CashierPreorders> {
  const { data, error } = await getAdminClient()
    .from("orders")
    .select(ORDER_SELECT)
    .eq("order_type", "pre_order")
    .in("order_status", ["pending_confirmation", "confirmed"])
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Gagal memuat pre-order: ${error.message}`);

  const orders = ((data ?? []) as unknown as OrderRow[]).map(mapPreorderWithTracking);
  return {
    pending: orders.filter((order) => order.status === "pending_confirmation"),
    scheduled: orders
      .filter((order) => order.status === "confirmed")
      .sort((a, b) => (a.pickupAt ?? "").localeCompare(b.pickupAt ?? "")),
  };
}

export type PublicOrderView = {
  code: string;
  status: OrderStatus;
  paymentStatus: "unpaid" | "paid";
  pickupAt: string | null;
  totalAmount: number;
  createdAt: string;
  cancellationReason: string | null;
  items: OrderView["items"];
  history: { toStatus: OrderStatus; changedAt: string }[];
};

type PublicOrderRow = {
  order_code: string;
  order_status: OrderStatus;
  payment_status: "unpaid" | "paid";
  pickup_at: string | null;
  total_amount: number | string;
  created_at: string;
  cancellation_reason: string | null;
  order_items?: OrderItemRow[] | null;
  order_status_history?: { to_status: OrderStatus; changed_at: string }[] | null;
};

export async function getPublicOrderByCodeHash(
  codeHash: string,
): Promise<PublicOrderView | null> {
  const { data, error } = await getAdminClient()
    .from("orders")
    .select(
      "order_code, order_type, order_status, payment_status, pickup_at, total_amount, created_at, cancellation_reason, order_items(product_id, product_name, quantity, unit_price, subtotal), order_status_history(to_status, changed_at)",
    )
    .eq("tracking_code_hash", codeHash)
    .eq("order_type", "pre_order")
    .maybeSingle<PublicOrderRow>();

  if (error) {
    // A lookup failure must never reveal whether a code exists.
    console.error("[rotipos-tracking]", error.message);
    return null;
  }

  if (!data) return null;

  return {
    code: data.order_code,
    status: data.order_status,
    paymentStatus: data.payment_status,
    pickupAt: data.pickup_at,
    totalAmount: Number(data.total_amount),
    createdAt: data.created_at,
    cancellationReason: data.cancellation_reason,
    items: mapOrderItems(data.order_items),
    history: [...(data.order_status_history ?? [])]
      .sort((a, b) => a.changed_at.localeCompare(b.changed_at))
      .map((entry) => ({ toStatus: entry.to_status, changedAt: entry.changed_at })),
  };
}

export type SalesFilters = {
  from: Date;
  to: Date;
  status?: OrderStatus | "all";
  type?: OrderType | "all";
  q?: string;
  limit?: number;
};

const SEARCH_SAFE = /[^a-zA-Z0-9@._\-\s]/g;

export function sanitizeSearch(term: string) {
  return term.replace(SEARCH_SAFE, "").trim().slice(0, 60);
}

export async function listSales(filters: SalesFilters): Promise<OrderView[]> {
  let query = getAdminClient()
    .from("orders")
    .select(ORDER_SELECT)
    .gte("created_at", filters.from.toISOString())
    .lt("created_at", filters.to.toISOString())
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 200);

  if (filters.status && filters.status !== "all") {
    query = query.eq("order_status", filters.status);
  }

  if (filters.type && filters.type !== "all") {
    query = query.eq("order_type", filters.type);
  }

  const term = sanitizeSearch(filters.q ?? "");
  if (term) {
    query = query.or(
      `order_code.ilike.%${term}%,customer_name.ilike.%${term}%,customer_email.ilike.%${term}%,customer_phone.ilike.%${term}%`,
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(`Gagal memuat riwayat penjualan: ${error.message}`);
  return ((data ?? []) as unknown as OrderRow[]).map(mapOrder);
}

export async function listAdminPreorders(filters: {
  status?: OrderStatus | "all";
  q?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}): Promise<OrderView[]> {
  function baseQuery() {
    let query = getAdminClient()
      .from("orders")
      .select(ORDER_SELECT)
      .eq("order_type", "pre_order")
      .order("pickup_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(filters.limit ?? 200);

    if (filters.status && filters.status !== "all") {
      query = query.eq("order_status", filters.status);
    }

    if (filters.from) query = query.gte("pickup_at", filters.from.toISOString());
    if (filters.to) query = query.lt("pickup_at", filters.to.toISOString());

    return query;
  }

  const term = sanitizeSearch(filters.q ?? "");
  const trackingTerm = normalizeTrackingCode(term);
  const searchByTrackingCode = isTrackingCodeFormat(trackingTerm);

  let query = baseQuery();
  if (term) {
    query = query.or(
      `order_code.ilike.%${term}%,customer_name.ilike.%${term}%,customer_email.ilike.%${term}%,customer_phone.ilike.%${term}%`,
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(`Gagal memuat pre-order: ${error.message}`);

  const orders = ((data ?? []) as unknown as OrderRow[]).map(mapPreorderWithTracking);
  if (!searchByTrackingCode) return orders;

  // A five-character term can also be a name such as "NANDA", so merge text
  // matches with a scan of the derived tracking codes instead of treating the
  // term as a code only.
  const codeResult = await baseQuery();
  if (codeResult.error) {
    throw new Error(`Gagal memuat pre-order: ${codeResult.error.message}`);
  }

  const seen = new Set(orders.map((order) => order.id));
  const codeMatches = ((codeResult.data ?? []) as unknown as OrderRow[])
    .map(mapPreorderWithTracking)
    .filter((order) => order.trackingCode === trackingTerm && !seen.has(order.id));

  return [...orders, ...codeMatches];
}

export async function listRecentOrders(limit = 6): Promise<OrderView[]> {
  const { data, error } = await getAdminClient()
    .from("orders")
    .select(ORDER_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Gagal memuat pesanan terbaru: ${error.message}`);
  return ((data ?? []) as unknown as OrderRow[]).map(mapOrder);
}

export type DashboardData = {
  revenueToday: number;
  paidToday: number;
  activeQueue: number;
  pendingPreorders: number;
  pickupToday: number;
  bestSellers: { name: string; quantity: number; revenue: number }[];
  recentOrders: OrderView[];
};

export async function getDashboardData(timezone: string): Promise<DashboardData> {
  const { start, end } = getTodayRange(timezone);
  const admin = getAdminClient();

  const [metricsResult, sellersResult, recentOrders] = await Promise.all([
    admin.rpc("dashboard_metrics"),
    admin.rpc("report_best_sellers", {
      p_from: start.toISOString(),
      p_to: end.toISOString(),
      p_limit: 5,
    }),
    listRecentOrders(6),
  ]);

  if (metricsResult.error) {
    throw new Error(`Gagal memuat metrik: ${metricsResult.error.message}`);
  }

  const metrics = (metricsResult.data ?? {}) as Record<string, number | string>;

  return {
    revenueToday: Number(metrics.revenue_today ?? 0),
    paidToday: Number(metrics.paid_today ?? 0),
    activeQueue: Number(metrics.active_queue ?? 0),
    pendingPreorders: Number(metrics.pending_preorders ?? 0),
    pickupToday: Number(metrics.pickup_today ?? 0),
    bestSellers: ((sellersResult.data ?? []) as {
      product_name: string;
      quantity: number | string;
      revenue: number | string;
    }[]).map((row) => ({
      name: row.product_name,
      quantity: Number(row.quantity),
      revenue: Number(row.revenue),
    })),
    recentOrders,
  };
}

export type CashierSalesRow = {
  id: string;
  name: string;
  transactions: number;
  revenue: number;
  profit: number;
  cashTransactions: number;
  qrisTransactions: number;
};

export type SalesTransactionRow = {
  orderCode: string;
  orderType: OrderType;
  customerName: string;
  cashierId: string;
  cashierName: string;
  method: PaymentMethod;
  amount: number;
  profit: number;
  paidAt: string;
};

export type SalesReport = {
  buckets: SalesBucket[];
  bestSellers: { name: string; quantity: number; revenue: number }[];
  cashiers: CashierSalesRow[];
  transactions: SalesTransactionRow[];
};

export async function getSalesReport(
  from: Date,
  to: Date,
  group: "day" | "month",
): Promise<SalesReport> {
  const admin = getAdminClient();
  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  const [bucketsResult, sellers, cashiersResult, transactionsResult] = await Promise.all([
    admin.rpc("report_sales", {
      p_from: fromIso,
      p_to: toIso,
      p_group: group,
    }),
    admin.rpc("report_best_sellers", {
      p_from: fromIso,
      p_to: toIso,
      p_limit: 8,
    }),
    admin.rpc("report_cashiers", {
      p_from: fromIso,
      p_to: toIso,
    }),
    admin.rpc("report_transactions", {
      p_from: fromIso,
      p_to: toIso,
    }),
  ]);

  if (bucketsResult.error) {
    throw new Error(`Gagal memuat laporan: ${bucketsResult.error.message}`);
  }
  if (cashiersResult.error) {
    throw new Error(`Gagal memuat laporan kasir: ${cashiersResult.error.message}`);
  }
  if (transactionsResult.error) {
    throw new Error(`Gagal memuat transaksi: ${transactionsResult.error.message}`);
  }

  return {
    buckets: ((bucketsResult.data ?? []) as {
      bucket: string;
      revenue: number | string;
      profit: number | string;
      transactions: number | string;
    }[]).map((row) => ({
      bucket: row.bucket,
      revenue: Number(row.revenue),
      profit: Number(row.profit),
      transactions: Number(row.transactions),
    })),
    bestSellers: ((sellers.data ?? []) as {
      product_name: string;
      quantity: number | string;
      revenue: number | string;
    }[]).map((row) => ({
      name: row.product_name,
      quantity: Number(row.quantity),
      revenue: Number(row.revenue),
    })),
    cashiers: ((cashiersResult.data ?? []) as {
      cashier_id: string;
      cashier_name: string;
      transactions: number | string;
      revenue: number | string;
      profit: number | string;
      cash_transactions: number | string;
      qris_transactions: number | string;
    }[]).map((row) => ({
      id: row.cashier_id,
      name: row.cashier_name,
      transactions: Number(row.transactions),
      revenue: Number(row.revenue),
      profit: Number(row.profit),
      cashTransactions: Number(row.cash_transactions),
      qrisTransactions: Number(row.qris_transactions),
    })),
    transactions: ((transactionsResult.data ?? []) as {
      order_code: string;
      order_type: OrderType;
      customer_name: string;
      cashier_id: string;
      cashier_name: string;
      payment_method: PaymentMethod;
      amount: number | string;
      profit: number | string;
      paid_at: string;
    }[]).map((row) => ({
      orderCode: row.order_code,
      orderType: row.order_type,
      customerName: row.customer_name,
      cashierId: row.cashier_id,
      cashierName: row.cashier_name,
      method: row.payment_method,
      amount: Number(row.amount),
      profit: Number(row.profit),
      paidAt: row.paid_at,
    })),
  };
}

export async function recordPaymentViaRpc(
  orderId: string,
  method: PaymentMethod,
  actorId: string,
) {
  const { data, error } = await getAdminClient().rpc("record_manual_payment", {
    p_order_id: orderId,
    p_payment_method: method,
    p_actor: actorId,
  });

  if (error) throw error;
  return data;
}
