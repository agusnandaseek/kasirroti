"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  CreditCard,
  PackageCheck,
  ShieldAlert,
  Trash2,
  UserCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatIDR } from "@/lib/format";
import type { DeletionLog } from "@/lib/data/deletion-logs";
import { cn } from "@/lib/utils";

function roleLabel(role: string) {
  if (role === "admin") return "Admin";
  if (role === "cashier") return "Kasir";
  return role;
}

function orderTypeLabel(type: string) {
  return type === "pre_order" ? "Pre-order" : "Walk-in";
}

function paymentMethodLabel(method: string) {
  return method === "cash" ? "Tunai" : "QRIS manual";
}

export function DeletionLogCard({
  log,
  timezone,
  defaultExpanded = false,
}: {
  log: DeletionLog;
  timezone: string;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <article
      className={cn(
        "border-[3px] border-ink bg-paper transition-shadow",
        expanded ? "shadow-hard-md" : "shadow-hard-sm hover:shadow-hard-md",
      )}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((previous) => !previous)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setExpanded((previous) => !previous);
          }
        }}
        className="flex cursor-pointer flex-col gap-3 p-4 transition hover:bg-cream/40 sm:p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-base font-bold text-terracotta sm:text-lg">
                {log.orderCode}
              </span>
              <Badge tone="terracotta" className="text-[9px]">
                <Trash2 className="size-3" strokeWidth={3} />
                Dihapus
              </Badge>
              <Badge tone="outline" className="text-[9px]">
                {orderTypeLabel(log.orderType)}
              </Badge>
            </div>

            <p className="text-xs font-bold text-ink">
              Pemesan: <span className="font-semibold">{log.customerName}</span>
            </p>
            <p className="text-[11px] text-ink-soft">
              Alasan: <span className="font-semibold text-ink">{log.reasonLabel}</span>
            </p>

            <p className="flex flex-wrap items-center gap-1.5 pt-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-muted">
              <UserCheck className="size-3" strokeWidth={3} />
              <span className="font-bold text-ink">{log.deletedByName}</span>
              <span>({roleLabel(log.deletedByRole)})</span>
              <span>·</span>
              <span>{formatDateTime(log.deletedAt, timezone)} WIB</span>
            </p>
          </div>

          <div className="flex flex-col items-end gap-2 text-right">
            <span className="font-mono text-sm font-bold">{formatIDR(log.totalAmount)}</span>
            <div
              className={cn(
                "inline-flex items-center gap-1 border-2 border-ink px-2.5 py-1 font-mono text-[10px] font-bold uppercase transition",
                expanded ? "bg-ink text-cream" : "bg-paper text-ink hover:bg-cream-deep",
              )}
            >
              <span>{expanded ? "Tutup" : "Detail"}</span>
              {expanded ? (
                <ChevronUp className="size-3.5" strokeWidth={3} />
              ) : (
                <ChevronDown className="size-3.5" strokeWidth={3} />
              )}
            </div>
          </div>
        </div>
      </div>

      {expanded ? (
        <div className="border-t-[3px] border-dashed border-ink/40 bg-cream/30 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="border-2 border-ink bg-paper p-3">
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-muted">
                Dihapus oleh
              </p>
              <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm font-bold">
                {log.deletedByName}
                <Badge
                  tone={log.deletedByRole === "admin" ? "butter" : "mint"}
                  className="px-1.5 py-0 text-[8px]"
                >
                  {roleLabel(log.deletedByRole)}
                </Badge>
              </p>
              <p className="mt-1 font-mono text-[10px] text-muted">
                {formatDateTime(log.deletedAt, timezone)} WIB
              </p>
            </div>

            <div className="border-2 border-ink bg-[#fdeae6] p-3">
              <p className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-danger">
                <ShieldAlert className="size-3" strokeWidth={3} />
                Alasan penghapusan
              </p>
              <p className="mt-1.5 text-sm font-bold">{log.reasonLabel}</p>
              {log.reasonNote ? (
                <p className="mt-1 border-l-2 border-ink/20 pl-2 text-[11px] leading-relaxed text-ink-soft">
                  {log.reasonNote}
                </p>
              ) : null}
            </div>
          </div>

          <p className="mt-4 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-muted">
            Rincian item ({log.items.reduce((sum, item) => sum + item.quantity, 0)} item)
          </p>
          {log.items.length === 0 ? (
            <p className="mt-1 text-[11px] text-muted">Tidak ada rincian item tersimpan.</p>
          ) : (
            <ul className="mt-1.5 divide-y-2 divide-dotted divide-ink/20 border-y-2 border-ink/20">
              {log.items.map((item) => (
                <li
                  key={`${item.productId}-${item.productName}`}
                  className="flex items-baseline justify-between gap-3 py-1.5 text-xs"
                >
                  <span className="min-w-0">
                    <span className="font-mono text-[11px] font-bold">{item.quantity}×</span>{" "}
                    {item.productName}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-muted">
                    {formatIDR(item.subtotal)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="border-2 border-ink bg-paper p-3">
              <p className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-muted">
                <CreditCard className="size-3" strokeWidth={3} />
                Pembayaran
              </p>
              {log.paymentMethod ? (
                <>
                  <p className="mt-1.5 text-xs font-bold">
                    {formatIDR(log.paymentAmount ?? log.totalAmount)} ·{" "}
                    {paymentMethodLabel(log.paymentMethod)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-soft">
                    Diterima oleh {log.paymentReceiverName ?? "Kasir"}
                    {log.paymentPaidAt
                      ? ` · ${formatDateTime(log.paymentPaidAt, timezone)} WIB`
                      : ""}
                  </p>
                </>
              ) : (
                <p className="mt-1.5 text-xs text-muted">Belum ada pembayaran tercatat.</p>
              )}
            </div>

            <div
              className={cn(
                "border-2 border-ink p-3",
                log.stockRestored ? "bg-mint-soft" : "bg-paper",
              )}
            >
              <p className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-muted">
                <PackageCheck className="size-3" strokeWidth={3} />
                Pengembalian stok
              </p>
              <p className="mt-1.5 text-xs font-bold">
                {log.stockRestored
                  ? `${log.unitsRestored} item dikembalikan ke stok`
                  : "Tidak ada stok yang dikembalikan"}
              </p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-muted">
                {log.stockRestored
                  ? "Persediaan produk sudah ditambah kembali sesuai transaksi ini."
                  : "Pre-order tidak memotong stok, jadi tidak ada yang perlu dikembalikan."}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}
