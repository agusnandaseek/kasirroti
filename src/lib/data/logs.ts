import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";
import { dateKeyNow, resolveDateRange, shiftDateKey } from "@/lib/ranges";

export type TimeRangeFilter = "today" | "yesterday" | "7d" | "30d" | "all";

export type TransactionHistoryEvent = {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  actionTitle: string;
  actorType: "guest" | "cashier" | "admin" | "system" | string;
  actorName: string;
  actorRole: string | null;
  notes: string | null;
  timestamp: string;
};

export type TransactionPaymentInfo = {
  id: string;
  method: "cash" | "manual_qris" | string;
  amount: number;
  paidAt: string;
  receiverName: string;
  receiverRole: string | null;
};

export type TransactionLog = {
  id: string;
  orderCode: string;
  customerName: string;
  orderType: "walk_in" | "pre_order" | string;
  currentStatus: string;
  paymentStatus: string;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
  eventsCount: number;
  history: TransactionHistoryEvent[];
  payment: TransactionPaymentInfo | null;
};

export type TransactionLogFilters = {
  q?: string;
  timeRange?: TimeRangeFilter;
  status?: string;
  page?: number;
  limit?: number;
  timezone?: string;
};

export type TransactionLogResult = {
  logs: TransactionLog[];
  totalCount: number;
  page: number;
  totalPages: number;
  limit: number;
};

function formatActionTitle(toStatus: string, fromStatus: string | null): string {
  if (!fromStatus && toStatus === "pending_confirmation") return "Pre-order Dibuat oleh Pelanggan";
  if (!fromStatus && toStatus === "queued") return "Pesanan Walk-in Dibuat di Kasir";
  if (toStatus === "confirmed") return "Pre-order Dikonfirmasi Kasir";
  if (toStatus === "rejected") return "Pre-order Ditolak";
  if (toStatus === "queued") return "Dimasukkan ke Antrean Produksi";
  if (toStatus === "preparing") return "Mulai Diproses / Dipanggang";
  if (toStatus === "ready") return "Pesanan Siap Diambil / Selesai Dipanggang";
  if (toStatus === "completed") return "Pesanan Diserahkan ke Pelanggan";
  if (toStatus === "cancelled") return "Pesanan Dibatalkan";
  return `Status diubah dari ${fromStatus ?? "awal"} ke ${toStatus}`;
}

type RawHistoryRow = {
  id: string;
  from_status: string | null;
  to_status: string;
  actor_type: string;
  notes: string | null;
  changed_at: string;
  actor: {
    id: string;
    full_name: string;
    role: string;
  } | null;
};

type RawPaymentRow = {
  id: string;
  amount?: number;
  payment_method: string;
  paid_at: string;
  receiver: {
    id: string;
    full_name: string;
    role: string;
  } | null;
};

type RawOrderRow = {
  id: string;
  order_code: string;
  customer_name: string;
  order_type: string;
  order_status: string;
  payment_status: string;
  total_amount: number;
  created_at: string;
  updated_at: string;
  history: RawHistoryRow[] | null;
  payment: RawPaymentRow | RawPaymentRow[] | null;
};

export async function listTransactionLogs(
  filters: TransactionLogFilters = {},
): Promise<TransactionLogResult> {
  const admin = getAdminClient();
  const page = Math.max(1, Number(filters.page ?? 1));
  const limit = Math.max(1, Math.min(50, Number(filters.limit ?? 10)));
  const offset = (page - 1) * limit;
  const timezone = filters.timezone ?? "Asia/Jakarta";
  const timeRange = filters.timeRange ?? "all";

  let query = admin.from("orders").select(
    `
      id,
      order_code,
      customer_name,
      order_type,
      order_status,
      payment_status,
      total_amount,
      created_at,
      updated_at,
      history:order_status_history(
        id,
        from_status,
        to_status,
        actor_type,
        notes,
        changed_at,
        actor:profiles(id, full_name, role)
      ),
      payment:payments(
        id,
        amount,
        payment_method,
        paid_at,
        receiver:profiles(id, full_name, role)
      )
    `,
    { count: "exact" },
  );

  // Time range filter
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
      .gte("created_at", range.from.toISOString())
      .lt("created_at", range.to.toISOString());
  }

  // Search filter (Order Code or Customer Name)
  if (filters.q) {
    const term = filters.q.trim().replace(/[^a-zA-Z0-9@._\-\s]/g, "");
    if (term) {
      query = query.or(`order_code.ilike.%${term}%,customer_name.ilike.%${term}%`);
    }
  }

  // Status filter
  if (filters.status && filters.status !== "all") {
    query = query.eq("order_status", filters.status);
  }

  query = query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) {
    throw new Error(`Gagal memuat log transaksi: ${error.message}`);
  }

  const rawRows = (data ?? []) as unknown as RawOrderRow[];
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  const logs: TransactionLog[] = rawRows.map((row) => {
    // Sort history chronologically (oldest first for the journey timeline)
    const sortedRawHistory = [...(row.history ?? [])].sort(
      (a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime(),
    );

    const history: TransactionHistoryEvent[] = sortedRawHistory.map((h) => {
      let actorName = "Sistem Otomatis";
      let actorRole: string | null = null;

      if (h.actor_type === "guest") {
        actorName = row.customer_name ? `${row.customer_name} (Pelanggan)` : "Pelanggan";
        actorRole = "Pelanggan";
      } else if (h.actor) {
        actorName = h.actor.full_name;
        actorRole = h.actor.role === "admin" ? "Admin" : "Kasir";
      } else if (h.actor_type === "cashier") {
        actorName = "Kasir";
        actorRole = "Kasir";
      } else if (h.actor_type === "admin") {
        actorName = "Admin";
        actorRole = "Admin";
      }

      return {
        id: h.id,
        fromStatus: h.from_status,
        toStatus: h.to_status,
        actionTitle: formatActionTitle(h.to_status, h.from_status),
        actorType: h.actor_type,
        actorName,
        actorRole,
        notes: h.notes,
        timestamp: h.changed_at,
      };
    });

    // Payment details
    let payment: TransactionPaymentInfo | null = null;
    const rawPayment = Array.isArray(row.payment) ? row.payment[0] : row.payment;
    if (rawPayment) {
      payment = {
        id: rawPayment.id,
        method: rawPayment.payment_method,
        amount: Number(rawPayment.amount ?? row.total_amount),
        paidAt: rawPayment.paid_at,
        receiverName: rawPayment.receiver?.full_name ?? "Kasir",
        receiverRole: rawPayment.receiver?.role === "admin" ? "Admin" : "Kasir",
      };
    }

    return {
      id: row.id,
      orderCode: row.order_code,
      customerName: row.customer_name,
      orderType: row.order_type,
      currentStatus: row.order_status,
      paymentStatus: row.payment_status,
      totalAmount: Number(row.total_amount),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      eventsCount: history.length,
      history,
      payment,
    };
  });

  return {
    logs,
    totalCount,
    page,
    totalPages,
    limit,
  };
}
