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
      <PageHeader
        eyebrow="Konfigurasi"
        title="Pengaturan"
      />
      <SettingsForm settings={settings} />
    </div>
  );
}
