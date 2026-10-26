import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { Logo } from "@/components/brand/logo";
import { SiteCredit } from "@/components/public/site-credit";
import { TrackLookupForm } from "@/components/public/track-lookup-form";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { getSettings } from "@/lib/data/settings";
import { listProducts } from "@/lib/data/products";
import { formatIDR } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [settings, products] = await Promise.all([
    getSettings(),
    listProducts({ availableOnly: true }),
  ]);

  const featured = products.slice(0, 3);
  // `i` is ISO day 1-7 (Monday-Sunday); business hours use 0-6 (Sunday=0).
  const isoDay = Number(formatInTimeZone(new Date(), settings.timezone, "i"));
  const openToday = settings.businessHours[String(isoDay % 7)];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b-[3px] border-ink bg-cream/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-4">
          <Logo href="/" />
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/preorder"
              className={buttonClasses({ variant: "ghost", size: "sm", className: "hidden sm:inline-flex" })}
            >
              Pre-order
            </Link>
            <Link href="/lacak" className={buttonClasses({ variant: "secondary", size: "sm" })}>
              Lacak
            </Link>
            <Link href="/login" className={buttonClasses({ variant: "ink", size: "sm" })}>
              Masuk
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <section className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-4 pb-16 pt-12 lg:grid-cols-[1.1fr_0.9fr] lg:pt-20">
          <div className="rise-in">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="butter">Pre-order tanpa akun</Badge>
              <Badge tone="outline">{settings.storeName}</Badge>
            </div>

            <h1 className="mt-6 text-5xl uppercase leading-[0.92] sm:text-6xl lg:text-7xl">
              Roti hangat,
              <br />
              <span className="text-terracotta">tanpa antre.</span>
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">
              Pesan roti favoritmu dari rumah, pilih jam pengambilan, lalu bayar saat tiba di
              toko. Pesanan baru diproses setelah dikonfirmasi kasir.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/preorder" className={buttonClasses({ size: "lg" })}>
                Mulai pre-order
                <ArrowRight className="size-4" strokeWidth={3} />
              </Link>
              <Link href="/preorder" className={buttonClasses({ variant: "secondary", size: "lg" })}>
                Lihat menu
              </Link>
            </div>

            <div className="mt-8 max-w-lg border-[3px] border-ink bg-paper p-4 shadow-hard-sm">
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-terracotta">
                Sudah punya tautan pesanan?
              </p>
              <TrackLookupForm className="mt-2.5" compact />
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-mint" />
                Bayar di toko
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-butter" />
                Konfirmasi manual
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-terracotta" />
                Tanpa pembayaran online
              </span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-sm lg:mx-0 lg:justify-self-end">
            <div className="absolute -left-4 -top-5 z-10 rotate-[-6deg] border-[3px] border-ink bg-terracotta px-4 py-2 font-display text-sm uppercase text-paper shadow-hard-sm">
              Fresh from oven
            </div>
            <div className="border-[3px] border-ink bg-paper p-5 shadow-hard-lg">
              <div className="flex items-start justify-between border-b-[3px] border-dashed border-ink/40 pb-3">
                <div>
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-muted">
                    Pesanan pre-order
                  </p>
                  <p className="mt-1 font-mono text-2xl font-bold tracking-tight">PO-000042</p>
                </div>
                <Badge tone="mint">Siap diambil</Badge>
              </div>

              <div className="space-y-2.5 py-4 font-mono text-[11px]">
                {featured.map((product) => (
                  <div key={product.id} className="flex items-end justify-between gap-3">
                    <span className="leading-tight">{product.name}</span>
                    <span className="mb-1 flex-1 border-b-2 border-dotted border-ink/30" />
                    <span>{formatIDR(product.price)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-muted">
                  <span>Ambil</span>
                  <span>Hari ini · 16:30</span>
                </div>
              </div>

              <div className="border-t-[3px] border-dashed border-ink/40 pt-3">
                <div className="flex items-end justify-between">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em]">
                    Total
                  </span>
                  <span className="font-display text-2xl">
                    {formatIDR(featured.reduce((sum, product) => sum + product.price, 0))}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between border-2 border-ink bg-butter-soft px-2.5 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em]">
                  <span>Bayar saat pengambilan</span>
                  <span className="size-2 rounded-full bg-ink" />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-center gap-1">
                {Array.from({ length: 24 }).map((_, index) => (
                  <span
                    key={index}
                    className="block h-6 bg-ink"
                    style={{ width: index % 3 === 0 ? 3 : 1.5 }}
                  />
                ))}
              </div>
              <p className="mt-1.5 text-center font-mono text-[8px] uppercase tracking-[0.28em] text-muted">
                Simpan tautan tracking milikmu
              </p>
            </div>

            <div className="absolute -bottom-5 -right-3 z-10 rotate-[5deg] border-[3px] border-ink bg-butter px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] shadow-hard-sm">
              {openToday && !openToday.closed
                ? `Buka ${openToday.open}–${openToday.close}`
                : "Tutup hari ini"}
            </div>
          </div>
        </section>

        <div className="overflow-hidden border-y-[3px] border-ink bg-ink py-2.5 text-cream">
          <div className="marquee-track flex w-max items-center gap-8 whitespace-nowrap font-mono text-[10px] font-bold uppercase tracking-[0.3em]">
            {Array.from({ length: 2 }).map((_, group) => (
              <div key={group} className="flex items-center gap-8">
                {[
                  "Bayar di toko",
                  "Konfirmasi kasir",
                  "Ambil sesuai jadwal",
                  "Tanpa akun",
                  "Tanpa payment gateway",
                  "Roti dibuat segar",
                ].map((item) => (
                  <span key={`${group}-${item}`} className="flex items-center gap-8">
                    {item}
                    <span className="size-1.5 rotate-45 bg-butter" />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="border-t-[3px] border-ink bg-paper">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 py-4 font-mono text-[9px] uppercase tracking-[0.16em] text-muted sm:flex-row">
          <span>© {new Date().getFullYear()} {settings.storeName}</span>
          <SiteCredit />
        </div>
      </footer>
    </div>
  );
}
