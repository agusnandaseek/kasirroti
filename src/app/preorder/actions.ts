"use server";

import { revalidatePath } from "next/cache";
import { getSettings } from "@/lib/data/settings";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { deriveTrackingCode, hashTrackingCode } from "@/lib/tokens";
import { isValidPickupSlot } from "@/lib/slots";
import { getAdminClient } from "@/lib/supabase/admin";
import { preorderSchema } from "@/lib/validation/schemas";
import { actionFail, actionOk, type ActionResult, toActionError } from "@/lib/errors";

export type PreorderReceipt = {
  code: string;
  trackingCode: string;
  totalAmount: number;
  pickupAt: string;
  alreadyExists: boolean;
};

type CreatePreorderResult = {
  order_id: string;
  order_code: string;
  total_amount: number;
  pickup_at: string;
  tracking_code_salt: number;
  already_exists: boolean;
};

export async function createPreorderAction(
  input: unknown,
): Promise<ActionResult<PreorderReceipt>> {
  try {
    if (!(await checkRateLimit("preorder", 8, 600))) {
      return actionFail("Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.", "RATE_LIMITED");
    }

    const parsed = preorderSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(parsed.error.issues[0]?.message ?? "Data pre-order tidak valid.");
    }

    const turnstileCheck = await verifyTurnstileToken(parsed.data.turnstileToken);
    if (!turnstileCheck.success) {
      return actionFail(turnstileCheck.error, "CAPTCHA_FAILED");
    }

    if (parsed.data.company.trim().length > 0) {
      return actionFail("Data pre-order tidak valid.");
    }

    const settings = await getSettings();
    const pickupAt = new Date(parsed.data.pickupAt);

    if (!isValidPickupSlot(pickupAt, settings)) {
      return actionFail(
        "Jadwal pengambilan sudah tidak tersedia. Pilih slot lain.",
        "JADWAL_TIDAK_VALID",
      );
    }

    let result: CreatePreorderResult | null = null;
    let lastError: unknown = null;

    // A code collision is rare, but the database is the source of truth for
    // uniqueness. Retrying with the next salt keeps the code deterministic for
    // this idempotency key while eventually finding a free code.
    for (let salt = 0; salt < 12; salt += 1) {
      const trackingCode = deriveTrackingCode(parsed.data.idempotencyKey, salt);
      const { data, error } = await getAdminClient().rpc("create_preorder", {
        p_items: parsed.data.items.map((item) => ({
          product_id: item.productId,
          quantity: item.quantity,
        })),
        p_customer_name: parsed.data.customerName,
        p_email: parsed.data.email,
        p_phone: parsed.data.phone,
        p_pickup_at: pickupAt.toISOString(),
        p_tracking_code_hash: hashTrackingCode(trackingCode),
        p_tracking_code_salt: salt,
        p_idempotency_key: parsed.data.idempotencyKey,
      });

      if (!error) {
        result = data as CreatePreorderResult;
        break;
      }

      lastError = error;
      const isCodeCollision =
        error.code === "23505" && /tracking_(token|code)_hash/i.test(error.message);
      if (!isCodeCollision) throw error;
    }

    if (!result) {
      throw lastError ?? new Error("GAGAL_MEMBUAT_PESANAN");
    }

    const trackingCode = deriveTrackingCode(
      parsed.data.idempotencyKey,
      Number(result.tracking_code_salt ?? 0),
    );

    revalidatePath("/cashier/preorders");
    revalidatePath("/admin");
    revalidatePath("/admin/preorders");

    return actionOk({
      code: result.order_code,
      trackingCode,
      totalAmount: Number(result.total_amount),
      pickupAt: result.pickup_at,
      alreadyExists: Boolean(result.already_exists),
    });
  } catch (error) {
    return actionFail(toActionError(error));
  }
}
