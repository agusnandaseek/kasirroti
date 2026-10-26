"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  CreditCard,
  ShieldCheck,
  User,
  UserCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateTime, formatIDR } from "@/lib/format";
import type { TransactionLog } from "@/lib/data/logs";
import type { OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TransactionLogCard({
  log,
  timezone,
  defaultExpanded = false,
}: {
  log: TransactionLog;
  timezone: string;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div
      className={cn(
        "border-[3px] border-ink bg-paper transition-shadow",
        expanded ? "shadow-hard-md" : "shadow-hard-sm hover:shadow-hard-md",
      )}
    >
      {/* Transaction Summary Header (Clickable) */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded((prev) => !prev);
          }
        }}
        className="flex cursor-pointer flex-col gap-3 p-4 transition hover:bg-cream/40 sm:p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          {/* Left: Code, Name, Type */}
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-base font-bold text-terracotta sm:text-lg">
                {log.orderCode}
              </span>
              <Badge tone="outline" className="text-[9px]">
                {log.orderType === "pre_order" ? "Pre-order" : "Langsung (Walk-in)"}
              </Badge>
              <StatusBadge status={log.currentStatus as OrderStatus} />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold text-ink">
                Pemesan: <span className="font-semibold">{log.customerName}</span>
              </span>
              <span className="text-muted">·</span>
              <span className="font-mono font-bold text-ink">{formatIDR(log.totalAmount)}</span>
            </div>
          </div>

          {/* Right: Date, Payment, and Toggle */}
          <div className="flex flex-col items-end gap-2 text-right">
            <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted">
              <Clock3 className="size-3" strokeWidth={2.5} />
              <span>{formatDateTime(log.createdAt, timezone)} WIB</span>
            </div>

            <div className="flex items-center gap-2">
              <Badge
                tone={log.paymentStatus === "paid" ? "mint" : "butter"}
                className="text-[9px]"
              >
                {log.paymentStatus === "paid" ? "Lunas" : "Belum Bayar"}
              </Badge>

              <div
                className={cn(
                  "inline-flex items-center gap-1 border-2 border-ink px-2.5 py-1 font-mono text-[10px] font-bold uppercase transition",
                  expanded ? "bg-ink text-cream" : "bg-paper text-ink hover:bg-cream-deep",
                )}
              >
                <span>{expanded ? "Tutup Detail" : `${log.eventsCount} Kejadian`}</span>
                {expanded ? (
                  <ChevronUp className="size-3.5" strokeWidth={3} />
                ) : (
                  <ChevronDown className="size-3.5" strokeWidth={3} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expandable Detail Section */}
      {expanded ? (
        <div className="border-t-[3px] border-dashed border-ink/40 bg-cream/30 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between border-b-2 border-ink/20 pb-2">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-terracotta">
              Kronologi & Riwayat Perjalanan Pesanan
            </p>
            <Link
              href={`/admin/orders/${log.id}`}
              className={buttonClasses({
                variant: "secondary",
                size: "sm",
                className: "h-7 gap-1 px-2.5 text-[9px]",
              })}
            >
              Buka Halaman Pesanan
              <ArrowRight className="size-3" strokeWidth={2.8} />
            </Link>
          </div>

          {/* Timeline of Events */}
          <div className="relative pl-6 sm:pl-8">
            {/* Vertical timeline connector line */}
            <div className="absolute bottom-3 left-3 top-3 w-0.5 bg-ink/30 sm:left-4" />

            <div className="space-y-4">
              {log.history.map((event, idx) => (
                <div key={event.id} className="relative flex items-start gap-3 text-xs">
                  {/* Step number badge */}
                  <div className="absolute -left-6 flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-cream font-mono text-[9px] font-bold text-ink sm:-left-8">
                    {idx + 1}
                  </div>

                  {/* Event Content Box */}
                  <div className="flex-1 rounded-sm border-2 border-ink/30 bg-paper p-3 shadow-hard-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 pb-1.5">
                      <p className="font-bold text-ink sm:text-sm">{event.actionTitle}</p>
                      <span className="font-mono text-[10px] text-muted">
                        {formatDateTime(event.timestamp, timezone)} WIB
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      {/* Status Transition */}
                      <div className="flex items-center gap-1.5 font-mono text-[10px]">
                        <span className="text-muted">{event.fromStatus ?? "Awal"}</span>
                        <span className="text-terracotta">→</span>
                        <span className="font-bold text-ink">{event.toStatus}</span>
                      </div>

                      {/* Actor */}
                      <div className="flex items-center gap-1.5">
                        {event.actorType === "system" ? (
                          <ShieldCheck className="size-3.5 text-mint" strokeWidth={2.5} />
                        ) : event.actorRole === "Admin" ? (
                          <UserCheck className="size-3.5 text-butter" strokeWidth={2.5} />
                        ) : (
                          <User className="size-3.5 text-muted" strokeWidth={2.5} />
                        )}
                        <span className="text-xs font-semibold text-ink">{event.actorName}</span>
                        {event.actorRole ? (
                          <Badge
                            tone={
                              event.actorRole === "Admin"
                                ? "butter"
                                : event.actorRole === "Kasir"
                                  ? "mint"
                                  : "outline"
                            }
                            className="px-1 py-0 text-[8px]"
                          >
                            {event.actorRole}
                          </Badge>
                        ) : null}
                      </div>
                    </div>

                    {/* Notes if any */}
                    {event.notes ? (
                      <div className="mt-2 rounded border border-ink/15 bg-cream-deep/40 px-2.5 py-1 font-mono text-[10px] text-ink-soft">
                        Catatan: {event.notes}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}

              {/* Payment Milestone Box if payment exists */}
              {log.payment ? (
                <div className="relative flex items-start gap-3 text-xs">
                  <div className="absolute -left-6 flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-mint font-mono text-[9px] font-bold text-ink sm:-left-8">
                    <CheckCircle2 className="size-3.5 text-ink" strokeWidth={3} />
                  </div>

                  <div className="flex-1 rounded-sm border-2 border-mint bg-mint/10 p-3 shadow-hard-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-mint/30 pb-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-ink">
                        <CreditCard className="size-3.5 text-ink" strokeWidth={2.5} />
                        <span>Pembayaran Diterima</span>
                      </div>
                      <span className="font-mono text-[10px] text-muted">
                        {formatDateTime(log.payment.paidAt, timezone)} WIB
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <div>
                        Jumlah: <span className="font-mono font-bold">{formatIDR(log.payment.amount)}</span> (
                        <span className="capitalize">{log.payment.method === "cash" ? "Tunai" : "QRIS"}</span>)
                      </div>
                      <div className="text-muted">
                        Diterima oleh:{" "}
                        <span className="font-bold text-ink">{log.payment.receiverName}</span> (
                        {log.payment.receiverRole ?? "Staf"})
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
