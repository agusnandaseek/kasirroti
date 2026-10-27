import "server-only";
import { dateKeyNow, resolveDateRange, shiftDateKey } from "@/lib/ranges";
import { getAdminClient } from "@/lib/supabase/admin";
import { deleteReasonLabel } from "@/lib/order-deletion";

export type DeletionTimeRange = "today" | "yesterday" | "7d" | "30d" | "all";

export type DeletionLogItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  unitCost: number | null;
  subtotal: number;
};

export type DeletionLog = {
  id: string;
  orderId: string;
  orderCode: string;
  orderType: "walk_in" | "pre_order" | string;
  orderStatus: string;
  paymentStatus: "unpaid" | "paid" | string;
  customerName: string;
  totalAmount: number;
  paymentMethod: "cash" | "manual_qris" | string | null;
  paymentAmount: number | null;
  paymentReceiverName: string | null;
  paymentPaidAt: string | null;
  reasonCode: string;
  reasonLabel: string;
  reasonNote: string | null;
  items: DeletionLogItem[];
  stockRestored: boolean;
  unitsRestored: number;
  deletedByName: string;
  deletedByRole: "admin" | "cashier" | string;
  deletedAt: string;
};

export type DeletionLogFilters = {
  q?: string;
  timeRange?: DeletionTimeRange;
  reason?: string;
  page?: number;
  limit?: number;
  timezone?: string;
};

export type DeletionLogResult = {
  logs: DeletionLog[];
  totalCount: number;
  page: number;
  totalPages: number;
  limit: number;
};

type RawDeletionRow = {
  id: string;
  order_id: string;
  order_code: string;
  order_type: string;
  order_status: string;
  payment_status: string;
  customer_name: string;
  total_amount: number | string;
  payment_method: string | null;
  payment_amount: number | string | null;
  payment_received_by_name: string | null;
  payment_paid_at: string | null;
  reason_code: string;
  reason_note: string | null;
  items: unknown;
  stock_restored: boolean;
  units_restored: number;
  deleted_by_name: string;
  deleted_by_role: string;
  deleted_at: string;
};

function mapItems(value: unknown): DeletionLogItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const item = raw as Record<string, unknown>;
      const quantity = Number(item.quantity ?? 0);
      if (!item.product_name || quantity <= 0) return null;

      return {
        productId: String(item.product_id ?? ""),
        productName: String(item.product_name),
        quantity,
        unitPrice: Number(item.unit_price ?? 0),
        unitCost: item.unit_cost == null ? null : Number(item.unit_cost),
        subtotal: Number(item.subtotal ?? 0),
      } satisfies DeletionLogItem;
    })
    .filter((item): item is DeletionLogItem => item !== null)
    .sort((a, b) => a.productName.localeCompare(b.productName, "id"));
}

export async function listOrderDeletions(
  filters: DeletionLogFilters = {},
): Promise<DeletionLogResult> {
  const admin = getAdminClient();
  const page = Math.max(1, Number(filters.page ?? 1));
  const limit = Math.max(1, Math.min(50, Number(filters.limit ?? 10)));
  const offset = (page - 1) * limit;
  const timezone = filters.timezone ?? "Asia/Jakarta";
  const timeRange = filters.timeRange ?? "all";

  let query = admin.from("order_deletions").select("*", { count: "exact" });

  if (timeRange !== "all") {
    const today = dateKeyNow(timezone);
    let fromKey = today;
    let toKey = today;

    if (timeRange === "yesterday") {
      fromKey = shiftDateKey(today, -1);
      toKey = fromKey;
    } else if (timeRange === "7d") {
      fromKey = shiftDateKey(today, -6);
      toKey = today;
    } else if (timeRange === "30d") {
      fromKey = shiftDateKey(today, -29);
      toKey = today;
    }

    const range = resolveDateRange({ from: fromKey, to: toKey, timezone });
    query = query
      .gte("deleted_at", range.from.toISOString())
      .lt("deleted_at", range.to.toISOString());
  }

  if (filters.q) {
    const term = filters.q.trim().replace(/[^a-zA-Z0-9@._\-\s]/g, "");
    if (term) {
      query = query.or(`order_code.ilike.%${term}%,customer_name.ilike.%${term}%`);
    }
  }

  if (filters.reason && filters.reason !== "all") {
    query = query.eq("reason_code", filters.reason);
  }

  query = query
    .order("deleted_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) {
    throw new Error(`Gagal memuat log penghapusan: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as RawDeletionRow[];
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  return {
    logs: rows.map((row) => ({
      id: row.id,
      orderId: row.order_id,
      orderCode: row.order_code,
      orderType: row.order_type,
      orderStatus: row.order_status,
      paymentStatus: row.payment_status,
      customerName: row.customer_name,
      totalAmount: Number(row.total_amount),
      paymentMethod: row.payment_method,
      paymentAmount: row.payment_amount == null ? null : Number(row.payment_amount),
      paymentReceiverName: row.payment_received_by_name,
      paymentPaidAt: row.payment_paid_at,
      reasonCode: row.reason_code,
      reasonLabel: deleteReasonLabel(row.reason_code),
      reasonNote: row.reason_note,
      items: mapItems(row.items),
      stockRestored: Boolean(row.stock_restored),
      unitsRestored: Number(row.units_restored ?? 0),
      deletedByName: row.deleted_by_name,
      deletedByRole: row.deleted_by_role,
      deletedAt: row.deleted_at,
    })),
    totalCount,
    page,
    totalPages,
    limit,
  };
}
