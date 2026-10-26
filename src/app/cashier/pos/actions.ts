"use server";

import { revalidatePath } from "next/cache";
import { getActionProfile } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { walkinCheckoutSchema } from "@/lib/validation/schemas";
import { actionFail, actionOk, type ActionResult, toActionError } from "@/lib/errors";

export type WalkinReceipt = {
  orderId: string;
  code: string;
  customerName: string;
  status: "queued" | "preparing";
  totalAmount: number;
  alreadyExists: boolean;
};

export async function createWalkinOrderAction(
  input: unknown,
): Promise<ActionResult<WalkinReceipt>> {
  try {
    const profile = await getActionProfile(["cashier", "admin"]);
    const parsed = walkinCheckoutSchema.safeParse(input);

    if (!parsed.success) {
      return actionFail(parsed.error.issues[0]?.message ?? "Data pesanan tidak valid.");
    }

    const { data, error } = await getAdminClient().rpc("create_walkin_order", {
      p_items: parsed.data.items.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
      })),
      p_payment_method: parsed.data.paymentMethod,
      p_actor: profile.id,
      p_customer_name: parsed.data.customerName,
      p_idempotency_key: parsed.data.idempotencyKey,
    });

    if (error) throw error;

    const result = data as {
      order_id: string;
      order_code: string;
      order_status: string;
      customer_name: string;
      total_amount: number;
      already_exists: boolean;
    };

    revalidatePath("/cashier/orders");
    revalidatePath("/cashier/pos");
    revalidatePath("/admin");
    revalidatePath("/admin/sales");

    return actionOk({
      orderId: result.order_id,
      code: result.order_code,
      customerName: result.customer_name,
      status: result.order_status === "preparing" ? "preparing" : "queued",
      totalAmount: Number(result.total_amount),
      alreadyExists: Boolean(result.already_exists),
    });
  } catch (error) {
    return actionFail(toActionError(error));
  }
}
