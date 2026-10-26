import Link from "next/link";
import {
  CalendarClock,
  Clock3,
  Mail,
  Phone,
  TriangleAlert,
  Ticket,
  UserRound,
} from "lucide-react";
import { AutoRefresh } from "@/components/ui/auto-refresh";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { PaymentBadge, StatusBadge } from "@/components/ui/status-badge";
import { PreorderActions } from "@/components/cashier/preorder-actions";
import { WhatsappConfirmButton } from "@/components/cashier/whatsapp-confirm-button";
import { listCashierPreorders } from "@/lib/data/orders";
import { getSettings } from "@/lib/data/settings";
import {
  formatDateTime,
  formatIDR,
  formatPickupDistance,
  formatRelativeMinutes,
} from "@/lib/format";
import { requireProfile } from "@/lib/auth";
import type { OrderView } from "@/lib/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function minutesUntil(iso: string) {
  return (new Date(iso).getTime() - Date.now()) / 60000;
}

export default async function CashierPreordersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireProfile();
  const params = await searchParams;
  const tab = params.tab === "scheduled" ? "scheduled" : "pending";

  const settings = await getSettings();
  const { pending, scheduled } = await listCashierPreorders();

  const dueSoon = scheduled.filter(
    (order) => order.pickupAt && minutesUntil(order.pickupAt) <= 120,
  ).length;

  const tabs = [
    {
      href: "/cashier/preorders?tab=pending",
      label: "Menunggu Konfirmasi",
      count: pending.length,
      active: tab === "pending",
    },
    {
      href: "/cashier/preorders?tab=scheduled",
      label: "Terkonfirmasi / Terjadwal",
      count: scheduled.length,
      active: tab === "scheduled",
    },
  ];

  const visible = tab === "pending" ? pending : scheduled;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Menu 3 · Pre-order"
        title="Pre-order"
        actions={
          <AutoRefresh
            label={tab === "pending" ? "Pre-order auto-refresh" : "Jadwal auto-refresh"}
            intervalMs={tab === "pending" ? 15000 : 30000}
          />
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterTabs tabs={tabs} />
        {dueSoon > 0 ? (
          <Badge tone="terracotta">
            <TriangleAlert className="size-3" strokeWidth={3} />
            {dueSoon} jadwal dekat / lewat
          </Badge>
        ) : (
          <Badge tone="outline">
            <CalendarClock className="size-3" strokeWidth={3} />
            Urut jadwal terdekat
          </Badge>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Ticket className="size-6" strokeWidth={2.6} />}
          title={
            tab === "pending"
              ? "Tidak ada pre-order baru"
              : "Belum ada pre-order terjadwal"
          }
          description={
            tab === "pending"
              ? "Pre-order dari halaman publik akan muncul di sini untuk dikonfirmasi manual."
              : "Pre-order yang sudah kamu konfirmasi akan tampil di sini, diurutkan berdasarkan jadwal pengambilan."
          }
          action={
            <Link href="/preorder" target="_blank" className={buttonClasses({ variant: "secondary", size: "sm" })}>
              Buka halaman pre-order publik
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((order) => (
            <PreorderCard
              key={order.id}
              order={order}
              timezone={settings.timezone}
              storeName={settings.storeName}
              scheduled={tab === "scheduled"}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PreorderCard({
  order,
  timezone,
  storeName,
  scheduled,
}: {
  order: OrderView;
  timezone: string;
  storeName: string;
  scheduled: boolean;
}) {
  const until = order.pickupAt ? minutesUntil(order.pickupAt) : null;
  const overdue = until !== null && until < 0;
  const soon = until !== null && until >= 0 && until <= 120;

  return (
    <article className="border-[3px] border-ink bg-paper shadow-hard-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-[3px] border-ink bg-cream/50 px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center border-[3px] border-ink bg-sky">
            <Ticket className="size-4" strokeWidth={2.8} />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[8px] font-bold uppercase tracking-[0.18em] text-muted">
              Kode lacak
            </p>
            <p className="mt-0.5 font-mono text-lg font-bold leading-none">
              {order.trackingCode ?? "—"}
            </p>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
              Dibuat {formatRelativeMinutes(order.createdAt)} ·{" "}
              {order.items.reduce((sum, item) => sum + item.quantity, 0)} item
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={order.status} />
          <PaymentBadge status={order.paymentStatus} />
          {order.trackingCode ? (
            <CopyButton
              value={order.trackingCode}
              label="Salin kode"
              size="sm"
              variant="ghost"
              className="h-7 px-2"
            />
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 p-3 sm:p-4 md:grid-cols-[1fr_280px]">
        <div className="min-w-0">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="border-2 border-ink bg-butter-soft px-2.5 py-2 sm:col-span-2">
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-muted">
                Nama pemesan
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-bold">
                <UserRound className="size-3.5 shrink-0" strokeWidth={2.8} />
                {order.customerName}
              </p>
            </div>
            <div className="border-2 border-ink bg-cream/40 px-2.5 py-2">
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-muted">
                Email pelanggan
              </p>
              <a
                href={`mailto:${order.customerEmail}`}
                className="mt-1 flex items-center gap-1.5 break-all text-xs font-semibold hover:text-terracotta"
              >
                <Mail className="size-3.5 shrink-0" strokeWidth={2.8} />
                {order.customerEmail}
              </a>
            </div>
            <div className="border-2 border-ink bg-cream/40 px-2.5 py-2">
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-muted">
                HP / WhatsApp
              </p>
              <a
                href={`tel:${order.customerPhone}`}
                className="mt-1 flex items-center gap-1.5 text-xs font-semibold hover:text-terracotta"
              >
                <Phone className="size-3.5 shrink-0" strokeWidth={2.8} />
                {order.customerPhone}
              </a>
            </div>
          </div>

          <p className="mt-3 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-muted">
            Item pesanan
          </p>
          <ul className="mt-1.5 space-y-1">
            {order.items.map((item) => (
              <li
                key={item.productId}
                className="flex items-baseline justify-between gap-3 border-b-2 border-dotted border-ink/20 pb-1 text-xs"
              >
                <span>
                  <span className="font-mono text-[11px] font-bold">{item.quantity}×</span>{" "}
                  {item.productName}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-muted">
                  {formatIDR(item.subtotal)}
                </span>
              </li>
            ))}
          </ul>

          {scheduled && order.pickupAt ? (
            <div
              className={cn(
                "mt-3 flex items-start gap-2 border-2 border-ink px-2.5 py-2",
                overdue ? "bg-[#fdeae6]" : soon ? "bg-butter-soft" : "bg-cream/40",
              )}
            >
              <Clock3 className="mt-0.5 size-3.5 shrink-0" strokeWidth={3} />
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.08em]">
                  {overdue ? "Jadwal sudah lewat" : soon ? "Jadwal produksi dekat" : "Jadwal pengambilan"}
                </p>
                <p className="mt-0.5 text-[11px]">
                  {formatDateTime(order.pickupAt, timezone)} · {formatPickupDistance(order.pickupAt)}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col justify-between gap-3 border-t-2 border-dashed border-ink/25 pt-3 md:border-l-2 md:border-t-0 md:pl-4 md:pt-0">
          <div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-muted">
                  {scheduled ? "Jadwal diminta" : "Diminta ambil"}
                </p>
                <p className="mt-1 text-sm font-bold leading-tight">
                  {order.pickupAt ? formatDateTime(order.pickupAt, timezone) : "—"}
                </p>
              </div>
              {scheduled && order.pickupAt ? (
                <Badge tone={overdue ? "terracotta" : soon ? "butter" : "outline"}>
                  {formatPickupDistance(order.pickupAt)}
                </Badge>
              ) : null}
            </div>

            <div className="mt-3 flex items-end justify-between border-t-2 border-dotted border-ink/25 pt-2">
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em]">
                Total
              </span>
              <span className="font-display text-2xl leading-none">
                {formatIDR(order.totalAmount)}
              </span>
            </div>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.06em] text-terracotta">
              {order.paymentStatus === "paid" ? "Sudah dibayar" : "Belum dibayar · tagih saat ambil"}
            </p>
          </div>

          <PreorderActions
            orderId={order.id}
            status={order.status}
            trackingCode={order.trackingCode ?? "Pre-order"}
          />

          <WhatsappConfirmButton order={order} storeName={storeName} className="w-full" />
        </div>
      </div>
    </article>
  );
}
