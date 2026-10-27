import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarClock,
  Check,
  CircleAlert,
  Clock3,
  MapPin,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import { TrackLookupForm } from "@/components/public/track-lookup-form";
import { AutoRefresh } from "@/components/ui/auto-refresh";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { PaymentBadge, StatusBadge } from "@/components/ui/status-badge";
import { getSettings } from "@/lib/data/settings";
import { getPublicOrderByCodeHash } from "@/lib/data/orders";
import { formatDateTime, formatIDR } from "@/lib/format";
import { checkRateLimit } from "@/lib/rate-limit";
import { formatSlotLabel } from "@/lib/slots";
import { hashTrackingCode } from "@/lib/tokens";
import { isTrackingCodeFormat, normalizeTrackingCode } from "@/lib/token-format";
import type { OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Status pesanan",
  robots: { index: false, follow: false },
};

const FLOW: { status: OrderStatus; label: string }[] = [
  { status: "pending_confirmation", label: "Diterima" },
  { status: "confirmed", label: "Dikonfirmasi" },
  { status: "queued", label: "Antrean" },
  { status: "preparing", label: "Dibuat" },
  { status: "ready", label: "Siap" },
  { status: "completed", label: "Selesai" },
];

function labelForStatus(status: OrderStatus) {
  return (
    FLOW.find((step) => step.status === status)?.label ??
    (status === "rejected" ? "Ditolak" : status === "cancelled" ? "Dibatalkan" : status)
  );
}

export default async function TrackPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: rawCode } = await params;
  const code = normalizeTrackingCode(rawCode);
  const valid = isTrackingCodeFormat(code);

  const [allowed, settings, order] = await Promise.all([
    checkRateLimit("track", 20, 60),
    getSettings(),
    valid ? getPublicOrderByCodeHash(hashTrackingCode(code)) : Promise.resolve(null),
  ]);

  if (!allowed) {
    return (
      <div className="flex min-h-screen flex-col">
        <PublicHeader storeName={settings.storeName} />
        <main className="flex-1">
          <div className="mx-auto w-full max-w-xl px-4 py-16">
            <div className="border-[3px] border-ink bg-paper p-6 text-center shadow-hard-lg sm:p-8">
              <span className="mx-auto flex size-14 items-center justify-center border-[3px] border-ink bg-butter">
                <Clock3 className="size-7 text-terracotta" strokeWidth={2.6} />
              </span>
              <h1 className="mt-4 text-2xl uppercase">Terlalu banyak permintaan</h1>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
                Halaman tracking dibuka terlalu sering dari jaringan ini. Tunggu sekitar satu
                menit, lalu muat ulang halaman.
              </p>

              <div className="mt-5 flex justify-center gap-3">
                <Link href="/lacak" className={buttonClasses({ variant: "secondary", size: "md" })}>
                  Kembali ke halaman lacak
                </Link>
              </div>

              <p className="mt-5 inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-muted">
                <ShieldCheck className="size-3" strokeWidth={3} />
                Perlindungan anti-spam tracking
              </p>
            </div>
          </div>
        </main>
        <PublicFooter storeName={settings.storeName} />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen flex-col">
        <PublicHeader storeName={settings.storeName} />
        <main className="flex-1">
          <div className="mx-auto w-full max-w-xl px-4 py-16">
            <div className="border-[3px] border-ink bg-paper p-6 text-center shadow-hard-lg sm:p-8">
              <span className="mx-auto flex size-14 items-center justify-center border-[3px] border-ink bg-[#fdeae6]">
                <CircleAlert className="size-7 text-danger" strokeWidth={2.6} />
              </span>
              <h1 className="mt-4 text-2xl uppercase">Kode tidak ditemukan</h1>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
                Kode lacak tidak valid atau sudah tidak tersedia. Periksa kembali 5 karakter yang
                kamu simpan, atau cari menggunakan kode pesanan bersama kasir.
              </p>

              <div className="mt-5 border-[3px] border-ink bg-cream p-3 text-left">
                <TrackLookupForm />
              </div>

              <div className="mt-5 flex justify-center gap-3">
                <Link href="/preorder" className={buttonClasses({ size: "md" })}>
                  Buat pre-order
                </Link>
                <Link href="/lacak" className={buttonClasses({ variant: "secondary", size: "md" })}>
                  Halaman lacak
                </Link>
              </div>

              <p className="mt-5 inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-muted">
                <ShieldCheck className="size-3" strokeWidth={3} />
                Tidak ada data pribadi yang ditampilkan
              </p>
            </div>
          </div>
        </main>
        <PublicFooter storeName={settings.storeName} />
      </div>
    );
  }

  const currentIndex = FLOW.findIndex((step) => step.status === order.status);
  const isTerminal = order.status === "rejected" || order.status === "cancelled";
  const isDone = order.status === "completed";

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader storeName={settings.storeName} />

      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/"
              className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-muted hover:text-ink"
            >
              ← Beranda
            </Link>
            <AutoRefresh label="Cek status otomatis" intervalMs={15000} />
          </div>

          <section className="border-[3px] border-ink bg-paper shadow-hard-lg">
            <div className="relative overflow-hidden border-b-[3px] border-ink bg-ink p-5 text-cream sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[0.26em] text-butter">
                    Status pesanan
                  </p>
                  <h1 className="mt-2 text-4xl uppercase leading-none sm:text-5xl">
                    {labelForStatus(order.status)}
                  </h1>
                  <div className="mt-3 flex flex-wrap items-center gap-2 font-mono">
                    <span className="inline-flex items-center gap-1.5 border-2 border-cream bg-butter px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-ink">
                      Kode Lacak: <span className="font-mono text-base tracking-widest">{code}</span>
                    </span>
                    <CopyButton
                      value={code}
                      label="Salin Kode"
                      variant="secondary"
                      size="sm"
                      className="h-8 border-cream bg-ink px-2.5 text-[9px] text-cream shadow-none hover:bg-ink-soft"
                    />
                    <span className="text-xs text-cream/70">
                      (No. Pesanan: {order.code})
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <StatusBadge status={order.status} />
                  <PaymentBadge status={order.paymentStatus} />
                </div>
              </div>

              <div className="dots pointer-events-none absolute -bottom-6 -right-4 size-28 opacity-20" />
            </div>

            <div className="grid gap-0 border-b-[3px] border-ink sm:grid-cols-2">
              <div className="flex items-start gap-3 border-b-[3px] border-ink p-4 sm:border-b-0 sm:border-r-[3px]">
                <span className="flex size-9 shrink-0 items-center justify-center border-2 border-ink bg-butter-soft">
                  <CalendarClock className="size-4" strokeWidth={2.8} />
                </span>
                <div>
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-muted">
                    Jadwal pengambilan
                  </p>
                  <p className="mt-1 text-sm font-bold">
                    {order.pickupAt
                      ? formatSlotLabel(order.pickupAt, settings.timezone)
                      : "Belum dijadwalkan"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4">
                <span className="flex size-9 shrink-0 items-center justify-center border-2 border-ink bg-butter-soft">
                  <Wallet className="size-4" strokeWidth={2.8} />
                </span>
                <div>
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-muted">
                    Pembayaran
                  </p>
                  <p className="mt-1 text-sm font-bold">
                    {order.paymentStatus === "paid"
                      ? "Lunas — sudah dibayar di toko"
                      : "Bayar di toko saat pengambilan"}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              {isTerminal ? (
                <div className="flex items-start gap-3 border-[3px] border-ink bg-[#fdeae6] p-4">
                  <CircleAlert className="mt-0.5 size-5 shrink-0 text-danger" strokeWidth={2.8} />
                  <div>
                    <p className="text-sm font-bold uppercase">
                      {order.status === "rejected" ? "Pesanan ditolak" : "Pesanan dibatalkan"}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                      {order.cancellationReason
                        ? `Alasan: ${order.cancellationReason}`
                        : "Hubungi toko untuk informasi lebih lanjut."}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <ol className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                    {FLOW.map((step, index) => {
                      const state =
                        isDone || index < currentIndex
                          ? "done"
                          : index === currentIndex
                            ? "current"
                            : "upcoming";
                      return (
                        <li key={step.status} className="flex flex-col items-center gap-2 text-center">
                          <span
                            className={cn(
                              "flex size-9 items-center justify-center border-[3px] border-ink font-mono text-[11px] font-bold",
                              state === "done" && "bg-mint text-paper",
                              state === "current" && "bg-butter text-ink shadow-hard-sm",
                              state === "upcoming" && "bg-paper text-muted",
                            )}
                          >
                            {state === "done" ? (
                              <Check className="size-4" strokeWidth={3.5} />
                            ) : (
                              index + 1
                            )}
                          </span>
                          <span
                            className={cn(
                              "font-mono text-[9px] font-bold uppercase leading-tight tracking-[0.08em]",
                              state === "upcoming" ? "text-muted/60" : "text-ink",
                            )}
                          >
                            {step.label}
                          </span>
                        </li>
                      );
                    })}
                  </ol>

                  <div className="mt-5 border-2 border-ink bg-cream px-3 py-2.5 text-[11px] leading-relaxed">
                    {order.status === "pending_confirmation" &&
                      "Kasir sedang memeriksa pesananmu. Status akan berubah setelah dikonfirmasi."}
                    {order.status === "confirmed" &&
                      "Pesanan sudah disetujui. Kasir akan memasukkannya ke antrean produksi mendekati jadwal pengambilan."}
                    {order.status === "queued" &&
                      "Pesanan sudah masuk antrean produksi. Roti akan dibuat sesuai urutan."}
                    {order.status === "preparing" &&
                      "Roti sedang dibuat. Datanglah sesuai jadwal pengambilan."}
                    {order.status === "ready" &&
                      "Pesanan siap diambil. Tunjukkan kode pesanan ke kasir dan lakukan pembayaran."}
                    {order.status === "completed" &&
                      "Pesanan sudah selesai. Terima kasih sudah memesan di toko kami."}
                  </div>
                </>
              )}

              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-base uppercase">Rincian pesanan</h2>
                  <Badge tone="outline">{order.items.length} jenis</Badge>
                </div>
                <ul className="divide-y-2 divide-dotted divide-ink/25 border-[3px] border-ink">
                  {order.items.map((item) => (
                    <li
                      key={item.productId}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs"
                    >
                      <span className="min-w-0 font-semibold">
                        {item.productName}
                        <span className="ml-2 font-mono text-[10px] font-normal text-muted">
                          {item.quantity} × {formatIDR(item.unitPrice)}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[11px] font-bold">
                        {formatIDR(item.subtotal)}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 flex items-end justify-between border-[3px] border-ink bg-butter-soft px-3 py-3">
                  <div>
                    <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em]">
                      Total
                    </p>
                    <p className="mt-0.5 text-[10px] text-ink-soft">
                      {order.paymentStatus === "paid"
                        ? "Sudah dibayar"
                        : "Dibayar saat pengambilan di toko"}
                    </p>
                  </div>
                  <span className="font-display text-2xl">{formatIDR(order.totalAmount)}</span>
                </div>
              </div>

              {!isTerminal && order.paymentStatus === "unpaid" ? (
                <div className="mt-4 flex items-start gap-2 border-[3px] border-ink bg-terracotta p-3 text-[11px] leading-relaxed text-paper">
                  <Wallet className="mt-0.5 size-4 shrink-0" strokeWidth={2.8} />
                  <span>
                    Siapkan pembayaran <strong>{formatIDR(order.totalAmount)}</strong> saat
                    mengambil pesanan. Pembayaran dicatat manual oleh kasir (tunai
                    {settings.manualQrisEnabled ? " atau QRIS manual" : ""}).
                  </span>
                </div>
              ) : null}

              {order.history.length > 0 ? (
                <div className="mt-6">
                  <h2 className="mb-2 flex items-center gap-2 text-base uppercase">
                    <Clock3 className="size-4" strokeWidth={2.8} />
                    Riwayat status
                  </h2>
                  <ol className="space-y-0 border-[3px] border-ink">
                    {order.history.map((entry, index) => (
                      <li
                        key={`${entry.toStatus}-${entry.changedAt}`}
                        className={cn(
                          "flex items-start gap-3 px-3 py-2.5 text-xs",
                          index !== order.history.length - 1 && "border-b-2 border-dotted border-ink/25",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-1 size-2.5 shrink-0 rounded-full border-2 border-ink",
                            index === order.history.length - 1 ? "bg-butter" : "bg-cream",
                          )}
                        />
                        <div className="flex w-full flex-wrap items-baseline justify-between gap-2">
                          <span className="font-semibold">{labelForStatus(entry.toStatus)}</span>
                          <span className="font-mono text-[10px] text-muted">
                            {formatDateTime(entry.changedAt, settings.timezone)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}

              <div className="mt-6 flex flex-col gap-3 border-t-[3px] border-dashed border-ink/30 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                  <MapPin className="size-3" strokeWidth={3} />
                  {settings.storeName} · {settings.timezone}
                </p>
                <CopyButton
                  value={code}
                  label="Salin kode lacak"
                  variant="secondary"
                  size="sm"
                />
              </div>

              <p className="mt-3 inline-flex items-start gap-1.5 text-[9px] leading-relaxed text-muted">
                <ShieldCheck className="mt-0.5 size-3 shrink-0" strokeWidth={3} />
                Halaman ini tidak menampilkan email atau nomor telepon. Jangan bagikan kode lacak
                ini kepada orang lain.
              </p>
            </div>
          </section>
        </div>
      </main>

      <PublicFooter storeName={settings.storeName} />
    </div>
  );
}
