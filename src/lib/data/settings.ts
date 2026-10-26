import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_SETTINGS, type BusinessHours, type StoreSettingsView } from "@/lib/types";

type SettingsRow = {
  store_name: string;
  timezone: string;
  business_hours: BusinessHours;
  slot_interval_minutes: number;
  min_preorder_minutes: number;
  manual_qris_enabled: boolean;
};

export async function getSettings(): Promise<StoreSettingsView> {
  const { data, error } = await getAdminClient()
    .from("store_settings")
    .select(
      "store_name, timezone, business_hours, slot_interval_minutes, min_preorder_minutes, manual_qris_enabled",
    )
    .eq("id", 1)
    .maybeSingle<SettingsRow>();

  if (error) throw new Error(`Gagal memuat pengaturan toko: ${error.message}`);
  if (!data) return DEFAULT_SETTINGS;

  return {
    storeName: data.store_name,
    timezone: data.timezone,
    businessHours: data.business_hours,
    slotIntervalMinutes: Number(data.slot_interval_minutes),
    minPreorderMinutes: Number(data.min_preorder_minutes),
    manualQrisEnabled: Boolean(data.manual_qris_enabled),
  };
}
