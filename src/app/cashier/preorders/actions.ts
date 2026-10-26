"use server";

import { revalidatePath } from "next/cache";
import { getActionProfile } from "@/lib/auth";
import { getSettings } from "@/lib/data/settings";
import { isPickupSlotScheduled } from "@/lib/slots";
import { getAdminClient } from "@/lib/supabase/admin";
import { orderIdSchema, rejectPreorderSchema } from "@/lib/validation/schemas";
import { actionFail, actionOk, type ActionResult, toActionError } from "@/lib/errors";

function refresh() {
  revalidatePath("/cashier/preorders");
  revalidatePath("/cashier/orders");
  revalidatePath("/admin");
  revalidatePath("/admin/preorders");
}

export async function confirmPreorderAction(
  orderId: string,
): Promise<ActionResult<{ status: string }>> {
  try {
    const profile = await getActionProfile(["cashier", "admin"]);
    const parsed = orderIdSchema.safeParse({ orderId });
    if (!parsed.success) return actionFail("ID pesanan tidak valid.");

    const admin = getAdminClient();
    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("order_type, order_status, pickup_at")
      .eq("id", parsed.data.orderId)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) return actionFail(toActionError("PESANAN_TIDAK_DITEMUKAN"), "PESANAN_TIDAK_DITEMUKAN");

    // Re-validate the promised pickup slot at confirmation time: store hours
    // and the slot grid may have changed since the customer submitted. Lead
    // time is intentionally not re-applied because it was enforced at booking.
    if (order.order_status === "pending_confirmation") {
      const settings = await getSettings();
      const pickupAt = order.pickup_at ? new Date(order.pickup_at) : null;

      if (
        order.order_type !== "pre_order" ||
        !pickupAt ||
        pickupAt.getTime() < Date.now() ||
        !isPickupSlotScheduled(pickupAt, settings)
      ) {
        return actionFail(
          "Jadwal pengambilan sudah lewat atau di luar jam operasional. Tolak pre-order ini dengan alasan agar pelanggan membuat pesanan baru.",
          "JADWAL_TIDAK_VALID",
        );
      }
    }

    const { data, error } = await admin.rpc("confirm_preorder", {
      p_order_id: parsed.data.orderId,
      p_actor: profile.id,
      p_notes: "Pre-order dikonfirmasi kasir",
    });

    if (error) throw error;
    refresh();

    return actionOk({ status: (data as { order_status: string }).order_status });
  } catch (error) {
    return actionFail(toActionError(error));
  }
}

export async function rejectPreorderAction(
  orderId: string,
  reason: string,
): Promise<ActionResult<{ status: string }>> {
  try {
    const profile = await getActionProfile(["cashier", "admin"]);
    const parsed = rejectPreorderSchema.safeParse({ orderId, reason });
    if (!parsed.success) {
      return actionFail(parsed.error.issues[0]?.message ?? "Alasan penolakan wajib diisi.");
    }

    const { data, error } = await getAdminClient().rpc("reject_preorder", {
      p_order_id: parsed.data.orderId,
      p_actor: profile.id,
      p_reason: parsed.data.reason,
    });

    if (error) throw error;
    refresh();

    return actionOk({ status: (data as { order_status: string }).order_status });
  } catch (error) {
    return actionFail(toActionError(error));
  }
}

export async function enqueuePreorderAction(
  orderId: string,
): Promise<ActionResult<{ status: string; queuedAt: string }>> {
  try {
    const profile = await getActionProfile(["cashier", "admin"]);
    const parsed = orderIdSchema.safeParse({ orderId });
    if (!parsed.success) return actionFail("ID pesanan tidak valid.");

    const { data, error } = await getAdminClient().rpc("enqueue_preorder", {
      p_order_id: parsed.data.orderId,
      p_actor: profile.id,
    });

    if (error) throw error;
    refresh();

    const result = data as { order_status: string; queued_at: string };
    return actionOk({ status: result.order_status, queuedAt: result.queued_at });
  } catch (error) {
    return actionFail(toActionError(error));
  }
}
