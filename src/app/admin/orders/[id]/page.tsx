import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  History,
  Mail,
  Phone,
  ReceiptText,
  ShieldCheck,
  Store,
  Ticket,
  UserRound,
  Wallet,
} from "lucide-react";
import { OrderActions } from "@/components/cashier/order-actions";
import { PreorderActions } from "@/components/cashier/preorder-actions";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, PanelLabel } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { PageHeader } from "@/components/ui/page-header";
import {
  OrderTypeBadge,
  PaymentBadge,
  StatusBadge,
  orderStatusLabel,
} from "@/components/ui/status-badge";
import { requireRole } from "@/lib/auth";
import { getOrderDetail } from "@/lib/data/orders";
import { getSettings } from "@/lib/data/settings";
import { formatDateTime, formatIDR, formatPickupDistance } from "@/lib/format";
import { formatSlotLabel } from "@/lib/slots";
import type { OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CancelOrderButton } from "./cancel-order-button";

export const dynamic = "force-dynamic";

const CANCELLABLE = new Set<OrderStatus>([
  "pending_confirmation",
  "confirmed",
  "queued",
  "preparing",
  "ready",
]);

const ACTOR_LABEL: Record<string, string> = {
  guest: "Pelanggan",
  cashier: "Kasir",
  admin: "Admin",
  system: "Sistem",
};

function paymentMethodLabel(method: "cash" | "manual_qris") {
  return method === "cash" ? "Tunai" : "QRIS manual";
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["admin"]);
  const { id } = await params;

  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [order, settings] = await Promise.all([getOrderDetail(id), getSettings()]);
  if (!order) notFound();

  const isPreorder = order.type === "pre_order";
  const canCancel = CANCELLABLE.has(order.status);
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="space-y-5">
      <Link
        href={isPreorder ? "/admin/preorders" : "/admin/sales"}
        className="inline-flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-muted hover:text-ink"
      >
        <ArrowLeft className="size-3" strokeWidth={3} />
        {isPreorder ? "Kembali ke pre-order" : "Kembali ke penjualan"}
      </Link>

      <PageHeader
        eyebrow="Detail pesanan"
        title={order.code}
        description={`Dibuat ${formatDateTime(order.createdAt, settings.timezone)} · ${itemCount} item · ${isPreorder ? "pre-order" : "walk-in"}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <OrderTypeBadge type={order.type} />
            <StatusBadge status={order.status} />
            {order.queuePriority ? <Badge tone="terracotta">Prioritas berikutnya</Badge> : null}
            <PaymentBadge status={order.paymentStatus} />
            {canCancel ? (
              <CancelOrderButton
                orderId={order.id}
                code={order.code}
                paid={order.paymentStatus === "paid"}
                totalAmount={order.totalAmount}
              />
            ) : null}
          </div>
        }
      />

      {order.cancellationReason ? (
        <div className="flex items-start gap-3 border-[3px] border-ink bg-[#fdeae6] p-4">
          <CircleAlert className="mt-0.5 size-5 shrink-0 text-danger" strokeWidth={2.8} />
          <div>
            <p className="text-sm font-bold uppercase">
              {order.status === "rejected" ? "Pesanan ditolak" : "Pesanan dibatalkan"}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              {order.cancellationReason}
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader>
              <div>
                <PanelLabel>Rincian item</PanelLabel>
                <CardTitle className="mt-1">{itemCount} item</CardTitle>
              </div>
              <ReceiptText className="size-5 text-terracotta" strokeWidth={2.6} />
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y-2 divide-dotted divide-ink/20 md:hidden">
                {order.items.map((item) => (
                  <div key={item.productId} className="px-3 py-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 text-xs font-semibold">{item.productName}</p>
                      <p className="shrink-0 font-mono text-[11px] font-bold">
                        {formatIDR(item.subtotal)}
                      </p>
                    </div>
                    <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.08em] text-muted">
                      {item.quantity} × {formatIDR(item.unitPrice)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[480px] border-collapse text-left">
                  <thead>
                    <tr className="border-b-2 border-ink bg-cream/50 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft">
                      <th className="px-4 py-2 font-bold">Produk</th>
                      <th className="px-4 py-2 text-right font-bold">Harga</th>
                      <th className="px-4 py-2 text-right font-bold">Qty</th>
                      <th className="px-4 py-2 text-right font-bold">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-dotted divide-ink/20">
                    {order.items.map((item) => (
                      <tr key={item.productId}>
                        <td className="px-4 py-2.5 text-xs font-semibold">{item.productName}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-[11px]">
                          {formatIDR(item.unitPrice)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-[11px]">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-[11px] font-bold">
                          {formatIDR(item.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-end justify-between gap-2 border-t-[3px] border-ink bg-butter-soft px-4 py-3">
                <div className="min-w-0">
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em]">
                    Total pesanan
                  </p>
                  <p className="mt-0.5 text-[10px] text-ink-soft">
                    {order.paymentStatus === "paid"
                      ? "Sudah dibayar"
                      : "Belum dibayar · bayar saat pengambilan"}
                  </p>
                </div>
                <span className="max-w-full break-words font-display text-2xl leading-none sm:text-3xl">
                  {formatIDR(order.totalAmount)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <PanelLabel>Jejak audit</PanelLabel>
                <CardTitle className="mt-1">Riwayat status</CardTitle>
              </div>
              <History className="size-5 text-muted" strokeWidth={2.6} />
            </CardHeader>
            <CardContent>
              {order.history.length === 0 ? (
                <p className="text-xs text-muted">Belum ada riwayat status.</p>
              ) : (
                <ol className="relative space-y-4 border-l-2 border-ink/20 pl-5">
                  {order.history.map((entry) => (
                    <li key={entry.id} className="relative">
                      <span
                        className={cn(
                          "absolute -left-[27px] top-1 size-3 rounded-full border-2 border-ink",
                          entry.to_status === "completed"
                            ? "bg-mint"
                            : entry.to_status === "cancelled" || entry.to_status === "rejected"
                              ? "bg-terracotta"
                              : "bg-butter",
                        )}
                      />
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-xs font-bold">
                          {entry.from_status
                            ? `${orderStatusLabel(entry.from_status)} → ${orderStatusLabel(entry.to_status)}`
                            : orderStatusLabel(entry.to_status)}
                        </p>
                        <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted">
                          {formatDateTime(entry.changed_at, settings.timezone)}
                        </span>
                      </div>
                      <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                        Oleh {ACTOR_LABEL[entry.actor_type] ?? entry.actor_type}
                      </p>
                      {entry.notes ? (
                        <p className="mt-1 border-l-2 border-ink/20 pl-2 text-[11px] leading-relaxed text-ink-soft">
                          {entry.notes}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader>
              <div>
                <PanelLabel>{isPreorder ? "Pelanggan" : "Transaksi"}</PanelLabel>
                <CardTitle className="mt-1">{isPreorder ? "Kontak & jadwal" : "Walk-in"}</CardTitle>
              </div>
              {isPreorder ? (
                <Ticket className="size-5 text-terracotta" strokeWidth={2.6} />
              ) : (
                <Store className="size-5 text-terracotta" strokeWidth={2.6} />
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="border-2 border-ink bg-butter-soft px-3 py-2">
                <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-muted">
                  Nama pemesan
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-bold">
                  <UserRound className="size-3.5 shrink-0" strokeWidth={2.8} />
                  {order.customerName}
                </p>
              </div>

              {isPreorder ? (
                <>
                  <div>
                    <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-muted">
                      Email
                    </p>
                    <a
                      href={`mailto:${order.customerEmail}`}
                      className="mt-1 flex items-center gap-1.5 break-all text-xs font-semibold hover:text-terracotta"
                    >
                      <Mail className="size-3.5 shrink-0" strokeWidth={2.8} />
                      {order.customerEmail ?? "—"}
                    </a>
                  </div>
                  <div>
                    <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-muted">
                      HP / WhatsApp
                    </p>
                    <a
                      href={`tel:${order.customerPhone}`}
                      className="mt-1 flex items-center gap-1.5 text-xs font-semibold hover:text-terracotta"
                    >
                      <Phone className="size-3.5 shrink-0" strokeWidth={2.8} />
                      {order.customerPhone ?? "—"}
                    </a>
                  </div>

                  <div className="border-t-2 border-dotted border-ink/25 pt-3">
                    <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-muted">
                      Jadwal pengambilan
                    </p>
                    <p className="mt-1 flex items-start gap-1.5 text-xs font-semibold">
                      <CalendarClock className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.8} />
                      {order.pickupAt
                        ? formatSlotLabel(order.pickupAt, settings.timezone)
                        : "—"}
                    </p>
                    {order.pickupAt ? (
                      <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.08em] text-muted">
                        {formatPickupDistance(order.pickupAt)}
                      </p>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="text-xs leading-relaxed text-muted">
                  Pesanan dibuat langsung di kasir. Nama pemesan disimpan untuk memanggil pesanan;
                  email dan nomor HP tidak diminta untuk transaksi walk-in.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <PanelLabel>Pembayaran</PanelLabel>
                <CardTitle className="mt-1">
                  {order.paymentStatus === "paid" ? "Lunas" : "Belum dibayar"}
                </CardTitle>
              </div>
              <Wallet
                className={cn(
                  "size-5",
                  order.paymentStatus === "paid" ? "text-mint" : "text-terracotta",
                )}
                strokeWidth={2.6}
              />
            </CardHeader>
            <CardContent className="space-y-2">
              {order.payment ? (
                <>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted">Nominal</span>
                    <span className="font-mono font-bold">{formatIDR(order.payment.amount)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted">Metode</span>
                    <span className="font-semibold">
                      {paymentMethodLabel(order.payment.payment_method)}
                    </span>
                  </div>
                  {order.cashierName ? (
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-muted">Kasir</span>
                      <span className="font-semibold">{order.cashierName}</span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted">Waktu</span>
                    <span className="font-mono text-[10px]">
                      {formatDateTime(order.payment.paid_at, settings.timezone)}
                    </span>
                  </div>
                  <p className="mt-2 flex items-start gap-1.5 border-2 border-ink bg-mint-soft px-2.5 py-2 text-[10px] leading-relaxed">
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-mint" strokeWidth={3} />
                    Pembayaran ini dihitung sebagai omzet pada laporan.
                  </p>
                </>
              ) : (
                <p className="border-2 border-ink bg-cream px-2.5 py-2 text-[10px] leading-relaxed">
                  Belum ada pembayaran. Pre-order yang belum dibayar tidak dihitung sebagai omzet.
                  Terima pembayaran dari menu antrean atau detail ini saat pesanan siap.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <PanelLabel>Tindakan</PanelLabel>
                <CardTitle className="mt-1">Kelola pesanan</CardTitle>
              </div>
              <ShieldCheck className="size-5 text-muted" strokeWidth={2.6} />
            </CardHeader>
            <CardContent className="space-y-3">
              {order.status === "pending_confirmation" || order.status === "confirmed" ? (
                <PreorderActions
                  orderId={order.id}
                  status={order.status}
                  trackingCode={order.trackingCode ?? "Pre-order"}
                />
              ) : null}

              {order.status === "queued" ||
              order.status === "preparing" ||
              order.status === "ready" ? (
                <OrderActions order={order} qrisEnabled={settings.manualQrisEnabled} />
              ) : null}

              {order.status === "completed" ||
              order.status === "cancelled" ||
              order.status === "rejected" ? (
                <p className="text-[11px] leading-relaxed text-muted">
                  Pesanan sudah final. Tidak ada tindakan status yang tersedia.
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2 border-t-2 border-dotted border-ink/25 pt-3">
                <Link
                  href="/cashier/orders"
                  className={buttonClasses({ variant: "secondary", size: "sm" })}
                >
                  <Clock3 className="size-3.5" strokeWidth={3} />
                  Buka antrean
                </Link>
                <CopyButton value={order.id} label="Salin ID" variant="ghost" size="sm" />
              </div>
            </CardContent>
          </Card>

          {isPreorder ? (
            <p className="flex items-start gap-1.5 text-[9px] leading-relaxed text-muted">
              <ShieldCheck className="mt-0.5 size-3 shrink-0" strokeWidth={3} />
              Tautan tracking pre-order hanya tersimpan sebagai hash. Admin tidak dapat melihat
              tautan pelanggan; minta pelanggan membuka tautan yang sudah disimpan.
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t-2 border-dashed border-ink/25 pt-3">
        <Badge tone="outline">ID pesanan</Badge>
        <code className="break-all font-mono text-[10px] text-muted">{order.id}</code>
      </div>
    </div>
  );
}
