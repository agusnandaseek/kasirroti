import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { OrderTypeBadge, PaymentBadge, StatusBadge } from "@/components/ui/status-badge";
import { formatDateTime, formatIDR } from "@/lib/format";
import type { OrderView } from "@/lib/types";
import { cn } from "@/lib/utils";

export function OrdersTable({
  orders,
  timezone,
  emptyMessage = "Belum ada pesanan pada rentang ini.",
  showContact = false,
  className,
}: {
  orders: OrderView[];
  timezone: string;
  emptyMessage?: string;
  showContact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 border-[3px] border-ink bg-paper", className)}>
      <div className="divide-y-2 divide-dotted divide-ink/20 md:hidden">
        {orders.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted">{emptyMessage}</p>
        ) : (
          orders.map((order) => (
            <Link
              key={order.id}
              href={`/admin/orders/${order.id}`}
              className="block px-3 py-3 transition active:bg-cream/70"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-sm font-bold">{order.code}</span>
                    <OrderTypeBadge type={order.type} />
                  </div>
                  <p className="mt-0.5 truncate text-[11px] font-semibold text-ink-soft">
                    {order.customerName}
                  </p>
                  {showContact && order.customerEmail ? (
                    <p className="mt-0.5 break-all text-[9px] leading-relaxed text-muted">
                      {order.customerEmail}
                      {order.customerPhone ? ` · ${order.customerPhone}` : ""}
                    </p>
                  ) : order.type === "pre_order" && order.pickupAt ? (
                    <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-muted">
                      Ambil {formatDateTime(order.pickupAt, timezone)}
                    </p>
                  ) : null}
                  {order.cashierName ? (
                    <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.08em] text-terracotta">
                      Kasir · {order.cashierName}
                    </p>
                  ) : null}
                </div>
                <span className="flex size-7 shrink-0 items-center justify-center border-2 border-ink bg-butter">
                  <ArrowUpRight className="size-3.5" strokeWidth={3} />
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={order.status} />
                  <PaymentBadge status={order.paymentStatus} />
                </div>
                <span className="font-mono text-sm font-bold">
                  {formatIDR(order.totalAmount)}
                </span>
              </div>

              <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.08em] text-muted">
                Dibuat {formatDateTime(order.createdAt, timezone)}
              </p>
            </Link>
          ))
        )}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[820px] border-collapse text-left">
          <thead>
            <tr className="border-b-[3px] border-ink bg-cream/60 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft">
              <th className="px-3 py-2.5 font-bold">Pesanan</th>
              <th className="px-3 py-2.5 font-bold">Dibuat</th>
              <th className="px-3 py-2.5 font-bold">Kasir</th>
              <th className="px-3 py-2.5 font-bold">Status</th>
              <th className="px-3 py-2.5 font-bold">Bayar</th>
              <th className="px-3 py-2.5 text-right font-bold">Total</th>
              <th className="w-10 px-2 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-dotted divide-ink/20">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-sm text-muted">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="group transition hover:bg-cream/50">
                  <td className="px-3 py-2.5 align-top">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-mono text-sm font-bold underline-offset-2 hover:underline"
                      >
                        {order.code}
                      </Link>
                      <OrderTypeBadge type={order.type} />
                    </div>
                    <p className="mt-1 max-w-[220px] truncate text-[10px] font-semibold text-ink-soft">
                      {order.customerName}
                    </p>
                    {showContact && order.customerEmail ? (
                      <p className="mt-0.5 max-w-[220px] truncate text-[9px] text-muted">
                        {order.customerEmail}
                        {order.customerPhone ? ` · ${order.customerPhone}` : ""}
                      </p>
                    ) : order.type === "pre_order" && order.pickupAt ? (
                      <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-muted">
                        Ambil {formatDateTime(order.pickupAt, timezone)}
                      </p>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 align-top font-mono text-[10px] text-ink-soft">
                    {formatDateTime(order.createdAt, timezone)}
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    {order.cashierName ? (
                      <span className="text-[10px] font-semibold text-terracotta">
                        {order.cashierName}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted/70">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <PaymentBadge status={order.paymentStatus} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right align-top font-mono text-xs font-bold">
                    {formatIDR(order.totalAmount)}
                  </td>
                  <td className="px-2 py-2.5 align-top">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="flex size-7 items-center justify-center border-2 border-transparent text-muted transition group-hover:border-ink group-hover:bg-butter group-hover:text-ink"
                      aria-label={`Buka ${order.code}`}
                    >
                      <ArrowUpRight className="size-3.5" strokeWidth={3} />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
