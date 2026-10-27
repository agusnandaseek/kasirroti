import { Download, HardDrive, ShieldCheck } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { getSettings } from "@/lib/data/settings";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireRole(["admin"]);
  const settings = await getSettings();

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Konfigurasi" title="Pengaturan" />

      <SettingsForm settings={settings} />

      {/* Backup & Disaster Recovery Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <HardDrive className="size-5 text-terracotta" strokeWidth={2.6} />
            <CardTitle>Cadangan Data (Backup & Pemulihan)</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs leading-relaxed text-ink-soft sm:text-sm">
            Unduh salinan cadangan instan seluruh database toko (pengaturan, katalog produk, riwayat pesanan, rincian transaksi, log status, dan akun staf). File snapshot berformat JSON terenkripsi dan dapat disimpan ke laptop/flashdisk Anda kapan saja.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <a
              href="/admin/settings/backup"
              download
              className={buttonClasses({ size: "md" })}
            >
              <Download className="size-4" strokeWidth={2.8} />
              Unduh Snapshot Backup (.json)
            </a>

            <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-muted">
              <ShieldCheck className="size-4 text-mint" strokeWidth={2.8} />
              Tersedia otomatis setiap saat
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
