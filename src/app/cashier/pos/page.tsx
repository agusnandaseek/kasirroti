import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { PosTerminal } from "./pos-terminal";
import { requireProfile } from "@/lib/auth";
import { listProducts } from "@/lib/data/products";
import { getSettings } from "@/lib/data/settings";
import { formatDateLong, formatTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CashierPosPage() {
  const profile = await requireProfile();
  const [products, settings] = await Promise.all([
    listProducts({ availableOnly: true }),
    getSettings(),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Menu 1 · Kasir"
        title="Kasir"
        actions={
          <>
            <Badge tone="outline">{formatDateLong(new Date(), settings.timezone)}</Badge>
            <Badge tone="mint">{formatTime(new Date(), settings.timezone)} WIB</Badge>
          </>
        }
      />

      <PosTerminal
        products={products}
        qrisEnabled={settings.manualQrisEnabled}
        timezone={settings.timezone}
        cashierName={profile.fullName}
      />
    </div>
  );
}
