"use server";

import { revalidatePath } from "next/cache";
import { getActionProfile } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { settingsSchema } from "@/lib/validation/schemas";
import { actionFail, actionOk, type ActionResult, toActionError } from "@/lib/errors";

export async function updateSettingsAction(
  _previous: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  try {
    await getActionProfile(["admin"]);

    let businessHours: unknown;
    try {
      businessHours = JSON.parse(String(formData.get("businessHours") ?? "{}"));
    } catch {
      return actionFail("Format jam operasional tidak valid.");
    }

    const parsed = settingsSchema.safeParse({
      storeName: formData.get("storeName") ?? "",
      timezone: formData.get("timezone") ?? "",
      businessHours,
      slotIntervalMinutes: formData.get("slotIntervalMinutes") ?? "",
      minPreorderMinutes: formData.get("minPreorderMinutes") ?? "",
      manualQrisEnabled: formData.get("manualQrisEnabled") ?? null,
    });

    if (!parsed.success) {
      return actionFail(parsed.error.issues[0]?.message ?? "Pengaturan tidak valid.");
    }

    const { error } = await getAdminClient()
      .from("store_settings")
      .upsert({
        id: 1,
        store_name: parsed.data.storeName,
        timezone: parsed.data.timezone,
        business_hours: parsed.data.businessHours,
        slot_interval_minutes: parsed.data.slotIntervalMinutes,
        min_preorder_minutes: parsed.data.minPreorderMinutes,
        manual_qris_enabled: parsed.data.manualQrisEnabled,
      });

    if (error) throw error;

    revalidatePath("/admin/settings");
    revalidatePath("/cashier/pos");
    revalidatePath("/preorder");
    revalidatePath("/");
    revalidatePath("/admin");

    return actionOk(null);
  } catch (error) {
    return actionFail(toActionError(error));
  }
}
