import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  Clock3,
  Package,
  ReceiptText,
  Ticket,
  TrendingUp,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { OrdersTable } from "@/components/admin/orders-table";
import { StatCard } from "@/components/admin/stat-card";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, PanelLabel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { getDashboardData } from "@/lib/data/orders";
import { getSettings } from "@/lib/data/settings";
import { formatDateLong, formatIDR, formatTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [profile, settings] = await Promise.all([requireRole(["admin"]), getSettings()]);
  const data = await getDashboardData(settings.timezone);
  const maxSold = Math.max(1, ...data.bestSellers.map((item) => item.quantity));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dashboard"
        title={`Selamat datang, ${profile.fullName.split(" ")[0]}.`}
        actions={
          <>
            <Badge tone="outline">{formatDateLong(new Date(), settings.timezone)}</Badge>
            <Badge tone="mint">{formatTime(new Date(), settings.timezone)} WIB</Badge>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard
          icon={<Wallet className="size-4" strokeWidth={2.8} />}
          label="Omzet hari ini"
          value={formatIDR(data.revenueToday)}
          hint="Dari payments.paid_at"
          tone="butter"
          className="col-span-2 md:col-span-1"
        />
        <StatCard
          icon={<ReceiptText className="size-4" strokeWidth={2.8} />}
          label="Pembayaran lunas"
          value={String(data.paidToday)}
          hint="Transaksi tercatat hari ini"
        />
        <StatCard
          icon={<Clock3 className="size-4" strokeWidth={2.8} />}
          label="Antrean aktif"
          value={String(data.activeQueue)}
          hint="Queued · preparing · ready"
        />
        <StatCard
          icon={<Ticket className="size-4" strokeWidth={2.8} />}
          label="Pre-order menunggu"
          value={String(data.pendingPreorders)}
          hint="Belum dikonfirmasi kasir"
          tone={data.pendingPreorders > 0 ? "terracotta" : "paper"}
        />
        <StatCard
          icon={<CalendarClock className="size-4" strokeWidth={2.8} />}
          label="Ambil hari ini"
          value={String(data.pickupToday)}
          hint="Pre-order terjadwal"
        />
      </section>

      {(data.pendingPreorders > 0 || data.activeQueue > 0) && (
        <section className="flex flex-col gap-3 border-[3px] border-ink bg-butter-soft p-4 shadow-hard-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center border-[3px] border-ink bg-terracotta text-paper">
              <TriangleAlert className="size-4" strokeWidth={2.8} />
            </span>
            <div>
              <p className="text-sm font-bold uppercase">Perlu tindakan</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                {data.pendingPreorders > 0
                  ? `${data.pendingPreorders} pre-order menunggu konfirmasi. `
                  : ""}
                {data.activeQueue > 0
                  ? `${data.activeQueue} pesanan masih dalam antrean produksi.`
                  : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.pendingPreorders > 0 ? (
              <Link href="/admin/preorders?status=pending_confirmation" className={buttonClasses({ size: "sm" })}>
                Konfirmasi pre-order
              </Link>
            ) : null}
            <Link
              href="/cashier/orders"
              className={buttonClasses({ variant: "secondary", size: "sm" })}
            >
              Buka antrean
            </Link>
          </div>
        </section>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader className="flex-wrap gap-2">
            <div>
              <PanelLabel>Pesanan terbaru</PanelLabel>
              <CardTitle className="mt-1">Aktivitas terakhir</CardTitle>
            </div>
            <Link href="/admin/sales" className={buttonClasses({ variant: "secondary", size: "sm" })}>
              Semua penjualan
              <ArrowRight className="size-3.5" strokeWidth={3} />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <OrdersTable
              orders={data.recentOrders}
              timezone={settings.timezone}
              className="border-0 shadow-none"
            />
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <div>
                <PanelLabel>Hari ini</PanelLabel>
                <CardTitle className="mt-1">Produk terlaris</CardTitle>
              </div>
              <TrendingUp className="size-5 text-terracotta" strokeWidth={2.6} />
            </CardHeader>
            <CardContent className="space-y-3">
              {data.bestSellers.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted">
                  Belum ada pembayaran tercatat hari ini.
                </p>
              ) : (
                data.bestSellers.map((item, index) => (
                  <div key={item.name}>
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate font-semibold">
                        <span className="mr-1.5 font-mono text-[10px] text-muted">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        {item.name}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] font-bold">
                        {item.quantity} pcs
                      </span>
                    </div>
                    <div className="mt-1 h-2.5 border-2 border-ink bg-cream">
                      <div
                        className="h-full bg-butter"
                        style={{ width: `${Math.max(8, (item.quantity / maxSold) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <PanelLabel>Aksi cepat</PanelLabel>
                <CardTitle className="mt-1">Operasional</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <QuickLink href="/cashier/pos" icon={<ReceiptText className="size-4" />} label="Kasir" />
              <QuickLink href="/admin/products" icon={<Package className="size-4" />} label="Produk" />
              <QuickLink href="/admin/preorders" icon={<Ticket className="size-4" />} label="Pre-order" />
              <QuickLink href="/admin/reports" icon={<BarChart3 className="size-4" />} label="Laporan" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function QuickLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="press flex items-center gap-2 border-[3px] border-ink bg-paper px-2.5 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] shadow-hard-sm hover:bg-butter-soft"
    >
      {icon}
      {label}
    </Link>
  );
}
