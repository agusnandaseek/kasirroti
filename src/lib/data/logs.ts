import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";

export type ActivityLog = {
  id: string;
  orderId: string;
  orderCode: string;
  customerName: string;
  orderType: string;
  actionTitle: string;
  fromStatus: string | null;
  toStatus: string;
  actorType: "guest" | "cashier" | "admin" | "system" | string;
  actorName: string;
  actorRole: string | null;
  notes: string | null;
  timestamp: string;
};

function formatActionTitle(toStatus: string, fromStatus: string | null, actorType: string): string {
  if (!fromStatus && toStatus === "pending_confirmation") return "Pre-order Dibuat";
  if (!fromStatus && toStatus === "queued") return "Pesanan Walk-in Dibuat";
  if (toStatus === "confirmed") return "Pre-order Dikonfirmasi";
  if (toStatus === "rejected") return "Pre-order Ditolak";
  if (toStatus === "queued") return "Dimasukkan ke Antrean";
  if (toStatus === "preparing") return "Mulai Diproses / Dipanggang";
  if (toStatus === "ready") return "Pesanan Siap Diambil";
  if (toStatus === "completed") return "Pesanan Selesai";
  if (toStatus === "cancelled") return "Pesanan Dibatalkan";
  return `Status diubah ke ${toStatus}`;
}

export async function listActivityLogs(options: {
  limit?: number;
  q?: string;
  status?: string;
} = {}): Promise<ActivityLog[]> {
  const admin = getAdminClient();

  const query = admin
    .from("order_status_history")
    .select(
      `id, from_status, to_status, actor_type, notes, changed_at, 
       order:orders(id, order_code, customer_name, order_type), 
       profile:profiles(id, full_name, role)`
    )
    .order("changed_at", { ascending: false })
    .limit(options.limit ?? 150);

  const { data, error } = await query;
  if (error) {
    throw new Error(`Gagal memuat log aktivitas: ${error.message}`);
  }

  type RawRow = {
    id: string;
    from_status: string | null;
    to_status: string;
    actor_type: string;
    notes: string | null;
    changed_at: string;
    order: {
      id: string;
      order_code: string;
      customer_name: string;
      order_type: string;
    } | null;
    profile: {
      id: string;
      full_name: string;
      role: string;
    } | null;
  };

  const rows = (data ?? []) as unknown as RawRow[];

  let logs: ActivityLog[] = rows.map((r) => {
    let actorName = "Sistem Otomatis";
    let actorRole: string | null = null;

    if (r.actor_type === "guest") {
      actorName = r.order?.customer_name ? `${r.order.customer_name} (Pelanggan Web)` : "Pelanggan Web";
      actorRole = "Tamu";
    } else if (r.profile) {
      actorName = r.profile.full_name;
      actorRole = r.profile.role === "admin" ? "Admin" : "Kasir";
    } else if (r.actor_type === "cashier") {
      actorName = "Kasir";
      actorRole = "Kasir";
    } else if (r.actor_type === "admin") {
      actorName = "Admin";
      actorRole = "Admin";
    }

    return {
      id: r.id,
      orderId: r.order?.id ?? "",
      orderCode: r.order?.order_code ?? "—",
      customerName: r.order?.customer_name ?? "—",
      orderType: r.order?.order_type === "pre_order" ? "Pre-order" : "Langsung (Walk-in)",
      actionTitle: formatActionTitle(r.to_status, r.from_status, r.actor_type),
      fromStatus: r.from_status,
      toStatus: r.to_status,
      actorType: r.actor_type,
      actorName,
      actorRole,
      notes: r.notes,
      timestamp: r.changed_at,
    };
  });

  if (options.q) {
    const term = options.q.toLowerCase().trim();
    logs = logs.filter(
      (l) =>
        l.orderCode.toLowerCase().includes(term) ||
        l.customerName.toLowerCase().includes(term) ||
        l.actorName.toLowerCase().includes(term) ||
        (l.notes && l.notes.toLowerCase().includes(term)) ||
        l.actionTitle.toLowerCase().includes(term),
    );
  }

  if (options.status && options.status !== "all") {
    logs = logs.filter((l) => l.toStatus === options.status);
  }

  return logs;
}
