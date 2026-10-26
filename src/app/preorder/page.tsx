import type { Metadata } from "next";
import { Clock3, ShieldCheck, Store } from "lucide-react";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import { Badge } from "@/components/ui/badge";
import { PreorderForm } from "./preorder-form";
import { buildPickupDays } from "@/lib/slots";
import { getSettings } from "@/lib/data/settings";
import { listProducts } from "@/lib/data/products";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pre-order roti",
  description:
    "Pesan roti tanpa akun, pilih jadwal pengambilan, lalu bayar di toko saat mengambil pesanan.",
};

export default async function PreorderPage() {
  const [settings, products] = await Promise.all([
    getSettings(),
    listProducts({ availableOnly: true }),
  ]);

  const initialDays = buildPickupDays(settings);

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader storeName={settings.storeName} />

      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-10">
          <div className="mb-6 flex flex-col gap-5 border-b-[3px] border-ink pb-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="terracotta">Jadwal Mulai Besok (H+1)</Badge>
                <Badge tone="butter">Tanpa akun</Badge>
                <Badge tone="outline">Bayar di toko</Badge>
                <Badge tone="mint">Konfirmasi manual</Badge>
              </div>
              <h1 className="mt-3 text-4xl uppercase sm:text-5xl">Pesan roti, ambil nanti.</h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
                Pilih roti dan jam pengambilan. Pesanan akan diperiksa kasir terlebih dahulu,
                lalu dibayar saat kamu tiba di {settings.storeName}.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 lg:w-[360px]">
              {[
                { icon: Store, text: "Bayar hanya di toko" },
                { icon: Clock3, text: `Slot ${settings.slotIntervalMinutes} menit` },
                { icon: ShieldCheck, text: "Tanpa data sensitif" },
              ].map((item) => (
                <div
                  key={item.text}
                  className="flex items-center gap-2 border-2 border-ink bg-paper px-2.5 py-2 font-mono text-[9px] font-semibold uppercase leading-tight tracking-[0.08em]"
                >
                  <item.icon className="size-3.5 shrink-0" strokeWidth={3} />
                  {item.text}
                </div>
              ))}
            </div>
          </div>

          <PreorderForm
            products={products}
            settings={settings}
            initialDays={initialDays}
          />
        </div>
      </main>

      <PublicFooter storeName={settings.storeName} />
    </div>
  );
}
