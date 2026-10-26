import Link from "next/link";
import { ReceiptText, RotateCcw, Search, Wallet, XCircle } from "lucide-react";
import { OrdersTable } from "@/components/admin/orders-table";
import { StatCard } from "@/components/admin/stat-card";
import { buttonClasses } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { listSales } from "@/lib/data/orders";
import { getSettings } from "@/lib/data/settings";
import { formatIDR } from "@/lib/format";
import { resolveDateRange } from "@/lib/ranges";
import type { OrderStatus, OrderType } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS: { value: OrderStatus | "all"; label: string }[] = [
  { value: "all", label: "Semua status" },
  { value: "pending_confirmation", label: "Menunggu konfirmasi" },
  { value: "confirmed", label: "Terkonfirmasi" },
  { value: "queued", label: "Dalam antrean" },
  { value: "preparing", label: "Sedang dibuat" },
  { value: "ready", label: "Siap diambil" },
  { value: "completed", label: "Selesai" },
  { value: "rejected", label: "Ditolak" },
  { value: "cancelled", label: "Dibatalkan" },
];

const TYPE_OPTIONS: { value: OrderType | "all"; label: string }[] = [
  { value: "all", label: "Semua tipe" },
  { value: "walk_in", label: "Walk-in" },
  { value: "pre_order", label: "Pre-order" },
];

function parseStatus(value?: string): OrderStatus | "all" {
  return STATUS_OPTIONS.some((option) => option.value === value)
    ? (value as OrderStatus)
    : "all";
}

function parseType(value?: string): OrderType | "all" {
  return TYPE_OPTIONS.some((option) => option.value === value) ? (value as OrderType) : "all";
}

export default async function AdminSalesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; status?: string; type?: string; q?: string }>;
}) {
  await requireRole(["admin"]);
  const params = await searchParams;
  const settings = await getSettings();
  const range = resolveDateRange({
    from: params.from,
    to: params.to,
    timezone: settings.timezone,
    defaultDays: 7,
  });

  const status = parseStatus(params.status);
  const type = parseType(params.type);
  const q = (params.q ?? "").slice(0, 60);

  const orders = await listSales({
    from: range.from,
    to: range.to,
    status,
    type,
    q,
  });

  const paid = orders.filter((order) => order.paymentStatus === "paid");
  const unpaid = orders.filter((order) => order.paymentStatus === "unpaid");
  const cancelled = orders.filter(
    (order) => order.status === "cancelled" || order.status === "rejected",
  );
  const paidValue = paid.reduce((sum, order) => sum + order.totalAmount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Penjualan"
        title="Riwayat penjualan"
        actions={<Link href="/admin/reports" className={buttonClasses({ variant: "secondary", size: "sm" })}>Lihat laporan</Link>}
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={<ReceiptText className="size-4" strokeWidth={2.8} />}
          label="Pesanan"
          value={String(orders.length)}
          hint={`${range.fromKey} → ${range.toKey}`}
          tone="butter"
        />
        <StatCard
          icon={<Wallet className="size-4" strokeWidth={2.8} />}
          label="Lunas"
          value={String(paid.length)}
          hint={formatIDR(paidValue)}
          tone="mint"
        />
        <StatCard
          icon={<Wallet className="size-4" strokeWidth={2.8} />}
          label="Belum bayar"
          value={String(unpaid.length)}
          hint="Wajib dilunasi saat ambil"
        />
        <StatCard
          icon={<XCircle className="size-4" strokeWidth={2.8} />}
          label="Ditolak / batal"
          value={String(cancelled.length)}
          hint="Tidak dihitung omzet"
        />
      </section>

      <form className="border-[3px] border-ink bg-paper p-4 shadow-hard-sm" method="get">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
          <Field label="Dari tanggal" htmlFor="from" className="lg:col-span-2">
            <Input id="from" name="from" type="date" defaultValue={range.fromKey} />
          </Field>
          <Field label="Sampai tanggal" htmlFor="to" className="lg:col-span-2">
            <Input id="to" name="to" type="date" defaultValue={range.toKey} />
          </Field>
          <Field label="Status" htmlFor="status" className="lg:col-span-2">
            <Select id="status" name="status" defaultValue={status}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tipe" htmlFor="type" className="lg:col-span-2">
            <Select id="type" name="type" defaultValue={type}>
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Cari kode / nama / kontak" htmlFor="q" className="lg:col-span-4">
            <Input
              id="q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="W-000001, nama, email, atau nomor HP…"
            />
          </Field>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="submit" className={buttonClasses({ size: "sm" })}>
            <Search className="size-3.5" strokeWidth={3} />
            Terapkan filter
          </button>
          <Link href="/admin/sales" className={buttonClasses({ variant: "secondary", size: "sm" })}>
            <RotateCcw className="size-3.5" strokeWidth={3} />
            Reset
          </Link>
          <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
            Maks. 200 pesanan · urut terbaru
          </span>
        </div>
      </form>

      <OrdersTable
        orders={orders}
        timezone={settings.timezone}
        showContact
        emptyMessage="Tidak ada pesanan yang cocok dengan filter ini."
      />
    </div>
  );
}
