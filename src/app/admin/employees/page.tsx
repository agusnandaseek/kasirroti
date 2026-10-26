import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { listEmployees } from "@/lib/data/employees";
import { getSettings } from "@/lib/data/settings";
import { EmployeesManager } from "./employees-manager";

export const dynamic = "force-dynamic";

export default async function AdminEmployeesPage() {
  const profile = await requireRole(["admin"]);
  const [employees, settings] = await Promise.all([listEmployees(), getSettings()]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tim toko"
        title="Karyawan"
      />
      <EmployeesManager
        employees={employees}
        currentProfileId={profile.id}
        timezone={settings.timezone}
      />
    </div>
  );
}
