import Link from "next/link";
import {
  ArrowUpRight,
  CalendarClock,
  Mail,
  Phone,
  Search,
  Ticket,
  Timer,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { PreorderActions } from "@/components/cashier/preorder-actions";
import { WhatsappConfirmButton } from "@/components/cashier/whatsapp-confirm-button";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input } from "@/components/ui/field";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { PaymentBadge, StatusBadge } from "@/components/ui/status-badge";
import { requireRole } from "@/lib/auth";
import { listAdminPreorders } from "@/lib/data/orders";
import { getSettings } from "@/lib/data/settings";
import { formatDateTime, formatIDR, formatPickupDistance, formatRelativeMinutes, isPastPickup } from "@/lib/format";
import { isDateKey, shiftDateKey } from "@/lib/ranges";
import { zonedTimeToUtc } from "@/lib/slots";
import type { OrderStatus, OrderView } from "@/lib/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TABS: { value: OrderStatus | "all"; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "pending_confirmation", label: "Menunggu" },
  { value: "confirmed", label: "Terkonfirmasi" },
  { value: "queued", label: "Antrean" },
  { value: "ready", label: "Siap" },
  { value: "completed", label: "Selesai" },
];

const ALLOWED = new Set<string>(TABS.map((tab) => tab.value));

function parseStatus(value?: string): OrderStatus | "all" {
  return value && ALLOWED.has(value) ? (value as OrderStatus) : "all";
}

function buildQuery(input: { status?: string; from?: string; to?: string; q?: string }) {
  const params = new URLSearchParams();
  if (input.status && input.status !== "all") params.set("status", input.status);
  if (input.from) params.set("from", input.from);
  if (input.to) params.set("to", input.to);
  if (input.q) params.set("q", input.q);
  return params.toString();
}

export default async function AdminPreordersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; from?: string; to?: string; q?: string }>;
}) {
  await requireRole(["admin"]);
  const params = await searchParams;
  const settings = await getSettings();
  const status = parseStatus(params.status);
  const fromKey = isDateKey(params.from) ? params.from : "";
  const toKey = isDateKey(params.to) ? params.to : "";
  const q = (params.q ?? "").slice(0, 60);

  const orders = await listAdminPreorders({
    status,
    q,
    from: fromKey ? zonedTimeToUtc(`${fromKey} 00:00:00`, settings.timezone) : undefined,
    to: toKey ? zonedTimeToUtc(`${shiftDateKey(toKey, 1)} 00:00:00`, settings.timezone) : undefined,
  });

  const pending = orders.filter((order) => order.status === "pending_confirmation").length;

  const tabs = TABS.map((tab) => ({
    href: `/admin/preorders${buildQuery({ status: tab.value, from: fromKey, to: toKey, q }) ? `?${buildQuery({ status: tab.value, from: fromKey, to: toKey, q })}` : ""}`,
    label: tab.label,
    active: status === tab.value,
    alert: tab.value === "pending_confirmation" && pending > 0,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pre-order"
        title="Kelola pre-order"
        actions={
          <Link
            href="/preorder"
            target="_blank"
            className={buttonClasses({ variant: "secondary", size: "sm" })}
          >
            Form publik
            <ArrowUpRight className="size-3.5" strokeWidth={3} />
          </Link>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterTabs tabs={tabs} />
        <div className="flex flex-wrap items-center gap-2">
          {pending > 0 ? (
            <Badge tone="terracotta">
              <TriangleAlert className="size-3" strokeWidth={3} />
              {pending} menunggu konfirmasi
            </Badge>
          ) : (
            <Badge tone="outline">
              <Timer className="size-3" strokeWidth={3} />
              {orders.length} pre-order
            </Badge>
          )}
        </div>
      </div>

      <form method="get" className="border-[3px] border-ink bg-paper p-4 shadow-hard-sm">
        {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
          <Field label="Ambil dari" htmlFor="from" className="lg:col-span-3">
            <Input id="from" name="from" type="date" defaultValue={fromKey} />
          </Field>
          <Field label="Ambil sampai" htmlFor="to" className="lg:col-span-3">
            <Input id="to" name="to" type="date" defaultValue={toKey} />
          </Field>
          <Field label="Cari kode lacak / nama / kontak" htmlFor="q" className="lg:col-span-4">
            <Input
              id="q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="AB7K2, nama, email, HP…"
            />
          </Field>
          <div className="flex items-end lg:col-span-2">
            <button type="submit" className={buttonClasses({ size: "sm", className: "w-full" })}>
              <Search className="size-3.5" strokeWidth={3} />
              Cari
            </button>
          </div>
        </div>
      </form>

      {orders.length === 0 ? (
        <EmptyState
          icon={<Ticket className="size-6" strokeWidth={2.6} />}
          title="Tidak ada pre-order"
          description="Belum ada pre-order yang cocok dengan filter ini. Pre-order baru dari halaman publik akan muncul di sini."
          action={
            <Link href="/admin/preorders" className={buttonClasses({ variant: "secondary", size: "sm" })}>
              Reset filter
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <PreorderRow
              key={order.id}
              order={order}
              timezone={settings.timezone}
              storeName={settings.storeName}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PreorderRow({
  order,
  timezone,
  storeName,
}: {
  order: OrderView;
  timezone: string;
  storeName: string;
}) {
  const overdue = order.pickupAt ? isPastPickup(order.pickupAt) : false;
  const actionable = order.status === "pending_confirmation" || order.status === "confirmed";

  return (
    <article className="border-[3px] border-ink bg-paper shadow-hard-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-[3px] border-ink bg-cream/50 px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center border-[3px] border-ink bg-sky">
            <Ticket className="size-4" strokeWidth={2.8} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-lg font-bold leading-none">
                {order.trackingCode ?? "—"}
              </span>
              <StatusBadge status={order.status} />
              <PaymentBadge status={order.paymentStatus} />
            </div>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
              Kode lacak · dibuat {formatRelativeMinutes(order.createdAt)} ·{" "}
              {order.items.reduce((sum, item) => sum + item.quantity, 0)} item
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {order.trackingCode ? (
            <CopyButton
              value={order.trackingCode}
              label="Salin"
              variant="ghost"
              size="sm"
              className="h-7 px-2"
            />
          ) : null}
          <Link
            href={`/admin/orders/${order.id}`}
            className={buttonClasses({ variant: "secondary", size: "sm", className: "h-7 px-2 text-[8px]" })}
          >
            Detail
          </Link>
        </div>
      </div>

      <div className="grid gap-4 p-3 sm:p-4 md:grid-cols-[1fr_300px]">
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
                Email
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
            Item
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
        </div>

        <div className="flex flex-col gap-3 border-t-2 border-dashed border-ink/25 pt-3 md:border-l-2 md:border-t-0 md:pl-4 md:pt-0">
          <div
            className={cn(
              "border-2 border-ink px-2.5 py-2",
              overdue ? "bg-[#fdeae6]" : "bg-butter-soft",
            )}
          >
            <p className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em]">
              <CalendarClock className="size-3" strokeWidth={3} />
              {overdue ? "Jadwal lewat" : "Jadwal pengambilan"}
            </p>
            <p className="mt-1 text-xs font-bold">
              {order.pickupAt ? formatDateTime(order.pickupAt, timezone) : "—"}
            </p>
            <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-ink-soft">
              {order.pickupAt ? formatPickupDistance(order.pickupAt) : ""}
            </p>
          </div>

          <div className="flex items-end justify-between border-t-2 border-dotted border-ink/25 pt-2">
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em]">
              Total
            </span>
            <span className="font-display text-2xl leading-none">{formatIDR(order.totalAmount)}</span>
          </div>

          {actionable ? (
            <PreorderActions
              orderId={order.id}
              status={order.status}
              trackingCode={order.trackingCode ?? "Pre-order"}
            />
          ) : (
            <Link
              href={`/admin/orders/${order.id}`}
              className={buttonClasses({ variant: "secondary", size: "sm", className: "w-full" })}
            >
              Lihat detail
              <ArrowUpRight className="size-3.5" strokeWidth={3} />
            </Link>
          )}

          <WhatsappConfirmButton order={order} storeName={storeName} className="w-full" />
        </div>
      </div>
    </article>
  );
}
