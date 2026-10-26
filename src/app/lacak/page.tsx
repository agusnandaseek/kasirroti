import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, ShieldCheck } from "lucide-react";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import { TrackLookupForm } from "@/components/public/track-lookup-form";
import { buttonClasses } from "@/components/ui/button";
import { getSettings } from "@/lib/data/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lacak pesanan",
  description: "Pantau status pre-order roti dengan kode lacak 5 karakter.",
};

export default async function TrackLookupPage() {
  const settings = await getSettings();

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader storeName={settings.storeName} />

      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
          <div className="border-[3px] border-ink bg-paper p-6 shadow-hard-lg sm:p-9">
            <span className="flex size-12 items-center justify-center border-[3px] border-ink bg-butter shadow-hard-sm">
              <KeyRound className="size-6" strokeWidth={2.6} />
            </span>
            <h1 className="mt-5 text-3xl uppercase sm:text-4xl">Lacak pesananmu.</h1>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
              Masukkan kode lacak 5 karakter yang kamu terima setelah mengirim pre-order. Kode ini
              bersifat pribadi dan tidak memerlukan akun.
            </p>

            <div className="mt-6 border-[3px] border-ink bg-cream p-4">
              <TrackLookupForm />
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="border-2 border-ink p-3">
                <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-terracotta">
                  Bentuk kode
                </p>
                <code className="mt-2 block border-2 border-ink bg-paper px-2 py-1.5 text-center font-mono text-xl font-bold tracking-[0.3em]">
                  AB7K2
                </code>
              </div>
              <div className="border-2 border-ink p-3">
                <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-terracotta">
                  Tidak menemukan kode?
                </p>
                <p className="mt-2 text-[11px] leading-relaxed text-muted">
                  Buat pre-order baru atau hubungi toko dengan menyebutkan kode pesananmu. Kasir
                  dapat mencocokkan pesanan secara manual.
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-start gap-2 border-2 border-ink bg-mint-soft px-3 py-2.5 text-[11px] leading-relaxed">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-mint" strokeWidth={2.6} />
              <span>
                Halaman tracking tidak menampilkan email maupun nomor telepon. Kode yang salah
                tidak akan memberi petunjuk apakah pesanan tersebut ada.
              </span>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/preorder" className={buttonClasses({ size: "md" })}>
                Buat pre-order baru
              </Link>
              <Link href="/" className={buttonClasses({ variant: "secondary", size: "md" })}>
                Kembali ke beranda
              </Link>
            </div>
          </div>
        </div>
      </main>

      <PublicFooter storeName={settings.storeName} />
    </div>
  );
}
