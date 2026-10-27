import type { ReactNode } from "react";
import Link from "next/link";
import { ClipboardList, Inbox } from "lucide-react";
import { AutoRefresh } from "@/components/ui/auto-refresh";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { OrderActions } from "@/components/cashier/order-actions";
import { DeleteOrderButton } from "@/components/orders/delete-order-button";
import { listActiveQueue, listCompletedToday } from "@/lib/data/orders";
import { getSettings } from "@/lib/data/settings";
import { requireProfile } from "@/lib/auth";
import type { OrderStatus, OrderView } from "@/lib/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TABS = {
  active: { label: "Aktif" },
  ready: { label: "Siap Diambil" },
  done: { label: "Selesai" },
} as const;

type TabKey = keyof typeof TABS;

const STATUS_LABEL: Partial<Record<OrderStatus, string>> = {
  queued: "Antrean",
  preparing: "Diproses",
  ready: "Siap",
  completed: "Selesai",
  cancelled: "Batal",
  rejected: "Ditolak",
};

const STATUS_STYLE: Partial<Record<OrderStatus, string>> = {
  queued: "bg-cream text-ink-soft",
  preparing: "bg-butter text-ink",
  ready: "bg-mint text-paper",
  completed: "bg-sky text-ink",
};

export default async function CashierOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireProfile();
  const params = await searchParams;
  const tab: TabKey =
    params.tab === "ready" ? "ready" : params.tab === "done" ? "done" : "active";

  const settings = await getSettings();
  const [queue, completed] = await Promise.all([
    listActiveQueue(),
    listCompletedToday(settings.timezone),
  ]);

  const ready = queue.filter((order) => order.status === "ready");
  const activeOrder =
    queue.find((order) => order.status === "preparing" || order.status === "ready") ?? null;
  const waiting = queue.filter((order) => order.status === "queued");
  const visible = tab === "done" ? completed : tab === "ready" ? ready : queue;

  const tabs = [
    { href: "/cashier/orders?tab=active", label: TABS.active.label, count: queue.length, active: tab === "active" },
    { href: "/cashier/orders?tab=ready", label: TABS.ready.label, count: ready.length, active: tab === "ready" },
    { href: "/cashier/orders?tab=done", label: TABS.done.label, count: completed.length, active: tab === "done" },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Menu 2 · List Pesanan"
        title="List Pesanan"
        actions={<AutoRefresh label="Antrean auto-refresh" intervalMs={15000} />}
      />

      <FilterTabs tabs={tabs} />

      {visible.length === 0 ? (
        <EmptyState
          icon={
            tab === "done" ? (
              <Inbox className="size-6" strokeWidth={2.6} />
            ) : (
              <ClipboardList className="size-6" strokeWidth={2.6} />
            )
          }
          title={
            tab === "active"
              ? "Antrean sedang kosong"
              : tab === "ready"
                ? "Belum ada pesanan siap diambil"
                : "Belum ada pesanan selesai hari ini"
          }
          description={
            tab === "active"
              ? "Pesanan walk-in dan pre-order yang diantrekan akan muncul di sini. Pesanan pertama langsung diproses."
              : tab === "ready"
                ? "Pesanan yang ditandai siap diambil akan tampil pada tab ini."
                : "Riwayat pesanan yang sudah diserahkan ke pelanggan hari ini akan tampil di sini."
          }
          action={
            tab !== "done" ? (
              <Link href="/cashier/pos" className={buttonClasses({ size: "md" })}>
                Buka kasir
              </Link>
            ) : null
          }
        />
      ) : tab === "active" ? (
        <div className="space-y-5">
          {activeOrder ? (
            <QueueSection
              label={activeOrder.status === "ready" ? "Siap diambil" : "Sedang diproses"}
              count={1}
            >
              <OrderCard
                order={activeOrder}
                qrisEnabled={settings.manualQrisEnabled}
                showActions
              />
            </QueueSection>
          ) : null}

          {waiting.length > 0 ? (
            <QueueSection label="Antrean menunggu" count={waiting.length}>
              {waiting.map((order, index) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  qrisEnabled={settings.manualQrisEnabled}
                  showActions
                  queueIndex={index + 1}
                  activeCode={activeOrder?.code ?? null}
                />
              ))}
            </QueueSection>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2.5">
          {visible.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              qrisEnabled={settings.manualQrisEnabled}
              showActions={tab !== "done"}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function QueueSection({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-muted">
            {label}
          </h2>
        </div>
        <span
          className={cn(
            "shrink-0 border-2 border-ink px-1.5 py-0.5 font-mono text-[9px] font-bold",
            "bg-cream text-ink-soft",
          )}
        >
          {count}
        </span>
      </div>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

function OrderCard({
  order,
  qrisEnabled,
  showActions,
  queueIndex,
  activeCode,
}: {
  order: OrderView;
  qrisEnabled: boolean;
  showActions: boolean;
  queueIndex?: number;
  activeCode?: string | null;
}) {
  const statusLabel =
    order.status === "queued" && order.queuePriority
      ? "Prioritas"
      : (STATUS_LABEL[order.status] ?? order.status);

  return (
    <article className="border-[3px] border-ink bg-paper shadow-hard-sm">
      <div className="flex items-start justify-between gap-3 px-3 py-2.5">
        <div className="min-w-0">
          <p className="font-mono text-base font-bold leading-none">{order.code}</p>
          <p className="mt-1.5 truncate text-sm font-bold leading-tight">{order.customerName}</p>
        </div>
        <span
          className={cn(
            "shrink-0 border-2 border-ink px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em]",
            order.status === "queued" && order.queuePriority
              ? "bg-butter text-ink"
              : (STATUS_STYLE[order.status] ?? "bg-cream text-ink-soft"),
          )}
        >
          {statusLabel}
        </span>
      </div>

      <ul className="space-y-0.5 border-t-2 border-dashed border-ink/25 px-3 py-2">
        {order.items.map((item) => (
          <li key={item.productId} className="flex items-baseline gap-2 text-[11px] leading-snug">
            <span className="font-mono font-bold">{item.quantity}×</span>
            <span className="min-w-0">{item.productName}</span>
          </li>
        ))}
      </ul>

      {showActions ? (
        <div className="border-t-[3px] border-ink p-2">
          <OrderActions
            order={order}
            qrisEnabled={qrisEnabled}
            queueIndex={queueIndex}
            activeCode={activeCode}
          />
          <div className="mt-2 flex justify-end border-t-2 border-dotted border-ink/25 pt-2">
            <DeleteOrderButton
              orderId={order.id}
              code={order.code}
              orderType={order.type}
              totalAmount={order.totalAmount}
              variant="ghost"
              label="Hapus"
              className="text-danger hover:bg-[#fdeae6]"
            />
          </div>
        </div>
      ) : (
        <div className="flex justify-end border-t-2 border-dotted border-ink/25 px-2 py-1.5">
          <DeleteOrderButton
            orderId={order.id}
            code={order.code}
            orderType={order.type}
            totalAmount={order.totalAmount}
            variant="ghost"
            label="Hapus"
            className="text-danger hover:bg-[#fdeae6]"
          />
        </div>
      )}
    </article>
  );
}
