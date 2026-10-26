import { Badge } from "@/components/ui/badge";
import type { OrderStatus, PaymentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_MAP: Record<
  OrderStatus,
  { label: string; tone: "ink" | "butter" | "terracotta" | "mint" | "sky" | "muted" | "outline" }
> = {
  pending_confirmation: { label: "Menunggu Konfirmasi", tone: "butter" },
  confirmed: { label: "Terkonfirmasi", tone: "sky" },
  queued: { label: "Dalam Antrean", tone: "outline" },
  preparing: { label: "Sedang Dibuat", tone: "butter" },
  ready: { label: "Siap Diambil", tone: "mint" },
  completed: { label: "Selesai", tone: "ink" },
  rejected: { label: "Ditolak", tone: "terracotta" },
  cancelled: { label: "Dibatalkan", tone: "muted" },
};

export function StatusBadge({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  const item = STATUS_MAP[status];
  return (
    <Badge tone={item.tone} className={className}>
      <span
        className={cn(
          "size-1.5 rounded-full bg-current",
          (status === "preparing" || status === "pending_confirmation") && "pulse-dot",
        )}
      />
      {item.label}
    </Badge>
  );
}

export function orderStatusLabel(status: OrderStatus) {
  return STATUS_MAP[status].label;
}

export function PaymentBadge({
  status,
  className,
}: {
  status: PaymentStatus;
  className?: string;
}) {
  return (
    <Badge tone={status === "paid" ? "mint" : "outline"} className={className}>
      {status === "paid" ? "Lunas" : "Belum Bayar"}
    </Badge>
  );
}

export function OrderTypeBadge({
  type,
  className,
}: {
  type: "walk_in" | "pre_order";
  className?: string;
}) {
  return (
    <Badge tone={type === "pre_order" ? "sky" : "muted"} className={className}>
      {type === "pre_order" ? "Pre-order" : "Langsung"}
    </Badge>
  );
}
