import Link from "next/link";
import {
  Award,
  BarChart3,
  CalendarRange,
  ChartColumnBig,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  ReceiptText,
  RotateCcw,
  Search,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { StatCard } from "@/components/admin/stat-card";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, PanelLabel } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { getSalesReport } from "@/lib/data/orders";
import { getSettings } from "@/lib/data/settings";
import { formatDateTime, formatIDR } from "@/lib/format";
import { dateKeyNow, resolveMonthRange, shiftDateKey } from "@/lib/ranges";
import { bucketLabel, shortBucketLabel } from "@/lib/reports/labels";
import type { PaymentMethod, SalesBucket } from "@/lib/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function groupHeading(group: "day" | "month") {
  return group === "month" ? "bulan" : "hari";
}

function paymentLabel(method: PaymentMethod) {
  return method === "cash" ? "Tunai" : "QRIS";
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; group?: string; cashier?: string }>;
}) {
  await requireRole(["admin"]);
  const params = await searchParams;
  const settings = await getSettings();
  const group = params.group === "month" ? "month" : "day";
  const range = resolveMonthRange({
    from: params.from,
    to: params.to,
    timezone: settings.timezone,
  });

  const report = await getSalesReport(range.from, range.to, group);
  const buckets: SalesBucket[] = report.buckets;

  const totalRevenue = buckets.reduce((sum, bucket) => sum + bucket.revenue, 0);
  const totalProfit = buckets.reduce((sum, bucket) => sum + bucket.profit, 0);
  const totalTransactions = buckets.reduce((sum, bucket) => sum + bucket.transactions, 0);
  const average = totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0;
  const best = buckets.reduce<SalesBucket | null>(
    (current, bucket) => (!current || bucket.revenue > current.revenue ? bucket : current),
    null,
  );
  const maxBucketValue = Math.max(
    1,
    ...buckets.map((bucket) => Math.max(bucket.revenue, bucket.profit)),
  );
  const maxBestSeller = Math.max(1, ...report.bestSellers.map((item) => item.quantity));

  const topCashier = report.cashiers.reduce<(typeof report.cashiers)[number] | null>(
    (current, cashier) => (!current || cashier.profit > current.profit ? cashier : current),
    null,
  );
  const topCashierId = topCashier && topCashier.profit > 0 ? topCashier.id : null;

  const selectedCashier =
    report.cashiers.find((cashier) => cashier.id === params.cashier) ?? null;
  const selectedTransactions = selectedCashier
    ? report.transactions.filter((transaction) => transaction.cashierId === selectedCashier.id)
    : [];
  const selectedAverage =
    selectedCashier && selectedCashier.transactions > 0
      ? Math.round(selectedCashier.revenue / selectedCashier.transactions)
      : 0;

  const baseQuery = `from=${range.fromKey}&to=${range.toKey}&group=${group}`;
  const cashierHref = (id: string) => `/admin/reports?${baseQuery}&cashier=${id}`;

  const today = dateKeyNow(settings.timezone);
  const quickRanges = [
    { label: "Hari ini", from: today, to: today },
    { label: "7 hari", from: shiftDateKey(today, -6), to: today },
    { label: "30 hari", from: shiftDateKey(today, -29), to: today },
    { label: "Bulan ini", from: `${today.slice(0, 7)}-01`, to: today },
  ];
  const exportQuery = `from=${range.fromKey}&to=${range.toKey}&group=${group}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Laporan"
        title="Laporan penjualan"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="outline">
              <CalendarRange className="size-3" strokeWidth={3} />
              {range.fromKey} → {range.toKey}
            </Badge>
            <a
              href={`/admin/reports/export?format=xlsx&${exportQuery}`}
              className={buttonClasses({ variant: "secondary", size: "sm" })}
            >
              <FileSpreadsheet className="size-3.5" strokeWidth={3} />
              Excel
            </a>
            <a
              href={`/admin/reports/export?format=pdf&${exportQuery}`}
              className={buttonClasses({ variant: "secondary", size: "sm" })}
            >
              <FileText className="size-3.5" strokeWidth={3} />
              PDF
            </a>
          </div>
        }
      />

      <form method="get" className="border-[3px] border-ink bg-paper p-4 shadow-hard-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
          <Field label="Dari tanggal" htmlFor="from" className="lg:col-span-3">
            <Input id="from" name="from" type="date" defaultValue={range.fromKey} />
          </Field>
          <Field label="Sampai tanggal" htmlFor="to" className="lg:col-span-3">
            <Input id="to" name="to" type="date" defaultValue={range.toKey} />
          </Field>
          <Field label="Kelompokkan" htmlFor="group" className="lg:col-span-3">
            <Select id="group" name="group" defaultValue={group}>
              <option value="day">Per hari</option>
              <option value="month">Per bulan</option>
            </Select>
          </Field>
          <div className="flex items-end lg:col-span-3">
            <button type="submit" className={buttonClasses({ size: "sm", className: "w-full" })}>
              <Search className="size-3.5" strokeWidth={3} />
              Tampilkan
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-muted">
            Cepat:
          </span>
          {quickRanges.map((item) => (
            <Link
              key={item.label}
              href={`/admin/reports?from=${item.from}&to=${item.to}&group=day`}
              className="border-2 border-ink bg-paper px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.08em] transition hover:bg-butter-soft"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/admin/reports"
            className={buttonClasses({ variant: "ghost", size: "sm", className: "ml-auto h-7 px-2 text-[8px]" })}
          >
            <RotateCcw className="size-3" strokeWidth={3} />
            Reset
          </Link>
        </div>
      </form>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          icon={<Wallet className="size-4" strokeWidth={2.8} />}
          label="Omzet tercatat"
          value={formatIDR(totalRevenue)}
          hint="Dari pembayaran lunas"
          tone="butter"
          className="col-span-2 lg:col-span-1"
        />
        <StatCard
          icon={<TrendingUp className="size-4" strokeWidth={2.8} />}
          label="Keuntungan"
          value={formatIDR(totalProfit)}
          hint="Modal kosong dihitung Rp0"
          tone="mint"
        />
        <StatCard
          icon={<ReceiptText className="size-4" strokeWidth={2.8} />}
          label="Transaksi"
          value={String(totalTransactions)}
          hint="Pembayaran pada rentang ini"
        />
        <StatCard
          icon={<BarChart3 className="size-4" strokeWidth={2.8} />}
          label="Rata-rata / transaksi"
          value={formatIDR(average)}
          hint="Omzet ÷ transaksi"
        />
        <StatCard
          icon={<TrendingUp className="size-4" strokeWidth={2.8} />}
          label="Periode terbaik"
          value={best ? shortBucketLabel(best.bucket, group) : "—"}
          hint={best ? formatIDR(best.revenue) : "Belum ada data"}
          tone={best ? "butter" : "paper"}
        />
      </section>

      {report.cashiers.length > 0 ? (
        <>
          <Card>
            <CardHeader className="flex-wrap gap-2">
              <div>
                <PanelLabel>Per kasir</PanelLabel>
                <CardTitle className="mt-1">Kinerja kasir</CardTitle>
              </div>
              <Badge tone="butter">
                <Users className="size-3" strokeWidth={3} />
                {report.cashiers.length} kasir
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y-2 divide-dotted divide-ink/20">
                {report.cashiers.map((cashier) => {
                  const isTop = cashier.id === topCashierId;
                  const isSelected = selectedCashier?.id === cashier.id;

                  return (
                    <Link
                      key={cashier.id}
                      href={cashierHref(cashier.id)}
                      className={cn(
                        "flex min-w-0 items-start gap-2 px-3 py-3 transition hover:bg-cream/40",
                        isSelected && "bg-butter-soft",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-xs font-semibold">{cashier.name}</p>
                          {isTop ? (
                            <Badge tone="mint">
                              <Award className="size-3" strokeWidth={3} />
                              Keuntungan tertinggi
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.08em] text-muted">
                          {cashier.transactions} transaksi · {cashier.cashTransactions} tunai ·{" "}
                          {cashier.qrisTransactions} QRIS
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="font-mono text-xs font-bold">{formatIDR(cashier.revenue)}</p>
                        <p
                          className={cn(
                            "mt-0.5 font-mono text-[9px] font-semibold",
                            cashier.profit >= 0 ? "text-mint" : "text-danger",
                          )}
                        >
                          Untung {formatIDR(cashier.profit)}
                        </p>
                        <p className="mt-0.5 font-mono text-[9px] text-muted">
                          Rata-rata{" "}
                          {formatIDR(
                            cashier.transactions > 0
                              ? Math.round(cashier.revenue / cashier.transactions)
                              : 0,
                          )}
                        </p>
                      </div>

                      <ChevronRight className="mt-1 size-4 shrink-0 text-muted" strokeWidth={3} />
                    </Link>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t-[3px] border-ink bg-butter-soft px-3 py-2.5 font-mono text-[10px] font-bold uppercase">
                <span>Total</span>
                <span className="text-right">
                  {totalTransactions} transaksi · {formatIDR(totalRevenue)} · Untung{" "}
                  {formatIDR(totalProfit)}
                </span>
              </div>
            </CardContent>
          </Card>

          {selectedCashier ? (
            <Card>
              <CardHeader className="flex-wrap gap-2">
                <div>
                  <PanelLabel>Detail kasir</PanelLabel>
                  <CardTitle className="mt-1">{selectedCashier.name}</CardTitle>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedCashier.id === topCashierId ? (
                    <Badge tone="mint">
                      <Award className="size-3" strokeWidth={3} />
                      Keuntungan tertinggi
                    </Badge>
                  ) : null}
                  <Link
                    href={`/admin/reports?${baseQuery}`}
                    className={buttonClasses({ variant: "secondary", size: "sm", className: "h-7 px-2 text-[8px]" })}
                  >
                    <X className="size-3" strokeWidth={3} />
                    Tutup
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { label: "Transaksi", value: String(selectedCashier.transactions) },
                    { label: "Penjualan", value: formatIDR(selectedCashier.revenue) },
                    { label: "Keuntungan", value: formatIDR(selectedCashier.profit) },
                    { label: "Rata-rata", value: formatIDR(selectedAverage) },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="border-2 border-ink bg-cream/40 px-2 py-2 text-center"
                    >
                      <p className="font-mono text-[8px] uppercase tracking-[0.1em] text-muted">
                        {stat.label}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[11px] font-bold">{stat.value}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <p className="mb-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-muted">
                    Transaksi ditangani
                  </p>

                  {selectedTransactions.length === 0 ? (
                    <p className="border-2 border-dashed border-ink/25 px-3 py-6 text-center text-xs text-muted">
                      Tidak ada transaksi pada rentang ini.
                    </p>
                  ) : (
                    <>
                      <div className="divide-y-2 divide-dotted divide-ink/20 border-2 border-ink md:hidden">
                        {selectedTransactions.map((transaction) => (
                          <div key={`${transaction.orderCode}-${transaction.paidAt}`} className="px-3 py-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-mono text-xs font-bold">{transaction.orderCode}</p>
                                <p className="mt-0.5 truncate text-[11px] font-semibold">
                                  {transaction.customerName}
                                </p>
                              </div>
                              <p className="shrink-0 font-mono text-[11px] font-bold">
                                {formatIDR(transaction.amount)}
                              </p>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-[0.08em] text-muted">
                              <span>{paymentLabel(transaction.method)}</span>
                              <span>Untung {formatIDR(transaction.profit)}</span>
                              <span>{formatDateTime(transaction.paidAt, settings.timezone)}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="hidden overflow-x-auto md:block">
                        <table className="w-full min-w-[640px] border-collapse text-left">
                          <thead>
                            <tr className="border-y-2 border-ink bg-cream/50 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft">
                              <th className="px-3 py-2 font-bold">Kode</th>
                              <th className="px-3 py-2 font-bold">Pelanggan</th>
                              <th className="px-3 py-2 font-bold">Metode</th>
                              <th className="px-3 py-2 text-right font-bold">Nominal</th>
                              <th className="px-3 py-2 text-right font-bold">Untung</th>
                              <th className="px-3 py-2 font-bold">Dibayar</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y-2 divide-dotted divide-ink/20">
                            {selectedTransactions.map((transaction) => (
                              <tr key={`${transaction.orderCode}-${transaction.paidAt}`}>
                                <td className="px-3 py-2 font-mono text-[11px] font-bold">
                                  {transaction.orderCode}
                                </td>
                                <td className="max-w-[180px] truncate px-3 py-2 text-[11px] font-semibold">
                                  {transaction.customerName}
                                </td>
                                <td className="px-3 py-2 text-[10px]">
                                  {paymentLabel(transaction.method)}
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-[11px] font-bold">
                                  {formatIDR(transaction.amount)}
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-[11px]">
                                  {formatIDR(transaction.profit)}
                                </td>
                                <td className="px-3 py-2 font-mono text-[9px] text-muted">
                                  {formatDateTime(transaction.paidAt, settings.timezone)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}

      {buckets.length === 0 ? (
        <div className="border-[3px] border-dashed border-ink/35 bg-paper/60 px-4 py-16 text-center">
          <ChartColumnBig className="mx-auto size-9 text-muted" strokeWidth={2.4} />
          <p className="mt-3 text-lg uppercase">Belum ada pembayaran</p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted">
            Tidak ada pembayaran tercatat pada rentang ini.
          </p>
          <Link href="/cashier/pos" className={buttonClasses({ size: "sm", className: "mt-4" })}>
            Buka kasir
          </Link>
        </div>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[1.55fr_1fr]">
          <Card>
            <CardHeader className="flex-wrap gap-2">
              <div>
                <PanelLabel>Grafik omzet & keuntungan</PanelLabel>
                <CardTitle className="mt-1">
                  {group === "month" ? "Per bulan" : "Per hari"}
                </CardTitle>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone="butter">Omzet {formatIDR(totalRevenue)}</Badge>
                <Badge tone="mint">Untung {formatIDR(totalProfit)}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto pb-1">
                <div
                  className="flex h-56 min-w-full items-end gap-1.5 border-b-[3px] border-l-[3px] border-ink px-2 pt-2"
                  style={{ minWidth: Math.max(320, buckets.length * 32) }}
                >
                  {buckets.map((bucket) => {
                    const revenueHeight = Math.max(0, (bucket.revenue / maxBucketValue) * 100);
                    const profitHeight = Math.max(0, (bucket.profit / maxBucketValue) * 100);
                    return (
                      <div
                        key={bucket.bucket}
                        className="group flex h-full min-w-0 flex-1 flex-col justify-end"
                        title={`${bucketLabel(bucket.bucket, group)} · Omzet ${formatIDR(bucket.revenue)} · Untung ${formatIDR(bucket.profit)} · ${bucket.transactions} transaksi`}
                      >
                        <div className="mx-auto flex h-full w-full max-w-[44px] items-end justify-center gap-0.5">
                          <div
                            className="w-1/2 border-2 border-ink bg-butter transition group-hover:bg-terracotta"
                            style={{ height: `${revenueHeight}%` }}
                          />
                          <div
                            className="w-1/2 border-2 border-ink bg-mint transition group-hover:bg-ink"
                            style={{ height: `${profitHeight}%` }}
                          />
                        </div>
                        <span className="mt-1 text-center font-mono text-[8px] text-muted">
                          {shortBucketLabel(bucket.bucket, group)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 border-2 border-ink bg-butter" />
                  Omzet
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 border-2 border-ink bg-mint" />
                  Keuntungan
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <PanelLabel>Produk terlaris</PanelLabel>
                <CardTitle className="mt-1">Berdasarkan kuantitas</CardTitle>
              </div>
              <TrendingUp className="size-5 text-terracotta" strokeWidth={2.6} />
            </CardHeader>
            <CardContent className="space-y-3">
              {report.bestSellers.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted">
                  Belum ada produk terjual pada rentang ini.
                </p>
              ) : (
                report.bestSellers.map((item, index) => (
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
                        className="h-full bg-mint"
                        style={{ width: `${Math.max(8, (item.quantity / maxBestSeller) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-0.5 text-right font-mono text-[9px] text-muted">
                      {formatIDR(item.revenue)}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="xl:col-span-2">
            <CardHeader>
              <div>
                <PanelLabel>Rekap</PanelLabel>
                <CardTitle className="mt-1">Rincian per {groupHeading(group)}</CardTitle>
              </div>
              <Badge tone="outline">{buckets.length} baris</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y-2 divide-dotted divide-ink/20 md:hidden">
                {buckets.map((bucket) => (
                  <div
                    key={bucket.bucket}
                    className="flex items-center justify-between gap-3 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold">{bucketLabel(bucket.bucket, group)}</p>
                      <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-muted">
                        {bucket.transactions} transaksi
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-xs font-bold">{formatIDR(bucket.revenue)}</p>
                      <p
                        className={cn(
                          "font-mono text-[9px] font-semibold",
                          bucket.profit >= 0 ? "text-mint" : "text-danger",
                        )}
                      >
                        Untung {formatIDR(bucket.profit)}
                      </p>
                      <p className="font-mono text-[9px] text-muted">
                        Rata-rata{" "}
                        {formatIDR(
                          bucket.transactions > 0
                            ? Math.round(bucket.revenue / bucket.transactions)
                            : 0,
                        )}
                      </p>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-2 bg-butter-soft px-3 py-2.5 font-mono text-[10px] font-bold uppercase">
                  <span>Total</span>
                  <span className="text-right">
                    {totalTransactions} transaksi · {formatIDR(totalRevenue)} · Untung{" "}
                    {formatIDR(totalProfit)}
                  </span>
                </div>
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[620px] border-collapse text-left">
                  <thead>
                    <tr className="border-y-2 border-ink bg-cream/50 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft">
                      <th className="px-4 py-2 font-bold">Periode</th>
                      <th className="px-4 py-2 text-right font-bold">Transaksi</th>
                      <th className="px-4 py-2 text-right font-bold">Omzet</th>
                      <th className="px-4 py-2 text-right font-bold">Keuntungan</th>
                      <th className="px-4 py-2 text-right font-bold">Rata-rata</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-dotted divide-ink/20">
                    {buckets.map((bucket) => (
                      <tr key={bucket.bucket} className="transition hover:bg-cream/40">
                        <td className="px-4 py-2 text-xs font-semibold">
                          {bucketLabel(bucket.bucket, group)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-[11px]">
                          {bucket.transactions}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs font-bold">
                          {formatIDR(bucket.revenue)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs font-bold">
                          {formatIDR(bucket.profit)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-[10px] text-muted">
                          {formatIDR(
                            bucket.transactions > 0
                              ? Math.round(bucket.revenue / bucket.transactions)
                              : 0,
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-[3px] border-ink bg-butter-soft font-mono text-[10px] font-bold uppercase">
                      <td className="px-4 py-2.5">Total</td>
                      <td className="px-4 py-2.5 text-right">{totalTransactions}</td>
                      <td className="px-4 py-2.5 text-right">{formatIDR(totalRevenue)}</td>
                      <td className="px-4 py-2.5 text-right">{formatIDR(totalProfit)}</td>
                      <td className="px-4 py-2.5 text-right">{formatIDR(average)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
