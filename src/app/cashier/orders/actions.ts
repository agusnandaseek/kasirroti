"use server";

import { revalidatePath } from "next/cache";
import { getActionProfile } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  cancelOrderSchema,
  deleteOrderSchema,
  orderIdSchema,
  paymentSchema,
} from "@/lib/validation/schemas";
import { actionFail, actionOk, type ActionResult, toActionError } from "@/lib/errors";

function refreshOrderViews() {
  revalidatePath("/cashier/orders");
  revalidatePath("/cashier/preorders");
  revalidatePath("/admin");
  revalidatePath("/admin/sales");
  revalidatePath("/admin/preorders");
  revalidatePath("/admin/reports");
  revalidatePath("/admin/products");
  revalidatePath("/admin/logs");
  revalidatePath("/admin/logs/deletions");
}

export type OrderRpcResult = {
  status: string;
  alreadyExists: boolean;
  promotedCode: string | null;
  promotedStatus: string | null;
};

async function runOrderRpc(
  rpc: "start_preparing" | "mark_ready" | "complete_order",
  orderId: string,
): Promise<ActionResult<OrderRpcResult>> {
  try {
    const profile = await getActionProfile(["cashier", "admin"]);
    const parsed = orderIdSchema.safeParse({ orderId });
    if (!parsed.success) return actionFail("ID pesanan tidak valid.");

    const { data, error } = await getAdminClient().rpc(rpc, {
      p_order_id: parsed.data.orderId,
      p_actor: profile.id,
    });

    if (error) throw error;
    refreshOrderViews();

    const result = data as {
      order_status: string;
      already_exists: boolean;
      promoted_order_code?: string | null;
      promoted_order_status?: string | null;
    };
    return actionOk({
      status: result.order_status,
      alreadyExists: Boolean(result.already_exists),
      promotedCode: result.promoted_order_code ?? null,
      promotedStatus: result.promoted_order_status ?? null,
    });
  } catch (error) {
    return actionFail(toActionError(error));
  }
}

export async function startPreparingAction(orderId: string) {
  return runOrderRpc("start_preparing", orderId);
}

export async function markReadyAction(orderId: string) {
  return runOrderRpc("mark_ready", orderId);
}

export async function completeOrderAction(orderId: string) {
  return runOrderRpc("complete_order", orderId);
}

export type QueuePriorityResult = {
  status: string;
  queuePriority: boolean;
  alreadyExists: boolean;
  activeCode: string | null;
  activeStatus: string | null;
};

async function runPriorityRpc(
  rpc: "prioritize_queue_order" | "clear_queue_priority",
  orderId: string,
): Promise<ActionResult<QueuePriorityResult>> {
  try {
    const profile = await getActionProfile(["cashier", "admin"]);
    const parsed = orderIdSchema.safeParse({ orderId });
    if (!parsed.success) return actionFail("ID pesanan tidak valid.");

    const { data, error } = await getAdminClient().rpc(rpc, {
      p_order_id: parsed.data.orderId,
      p_actor: profile.id,
    });

    if (error) throw error;
    refreshOrderViews();

    const result = data as {
      order_status: string;
      queue_priority: boolean;
      already_exists: boolean;
      active_order_code?: string | null;
      active_order_status?: string | null;
    };
    return actionOk({
      status: result.order_status,
      queuePriority: Boolean(result.queue_priority),
      alreadyExists: Boolean(result.already_exists),
      activeCode: result.active_order_code ?? null,
      activeStatus: result.active_order_status ?? null,
    });
  } catch (error) {
    return actionFail(toActionError(error));
  }
}

export async function prioritizeOrderAction(orderId: string) {
  return runPriorityRpc("prioritize_queue_order", orderId);
}

export async function clearQueuePriorityAction(orderId: string) {
  return runPriorityRpc("clear_queue_priority", orderId);
}

export async function recordPaymentAction(
  orderId: string,
  method: "cash" | "manual_qris",
): Promise<ActionResult<{ status: string }>> {
  try {
    const profile = await getActionProfile(["cashier", "admin"]);
    const parsed = paymentSchema.safeParse({ orderId, method });
    if (!parsed.success) {
      return actionFail(parsed.error.issues[0]?.message ?? "Data pembayaran tidak valid.");
    }

    const { data, error } = await getAdminClient().rpc("record_manual_payment", {
      p_order_id: parsed.data.orderId,
      p_payment_method: parsed.data.method,
      p_actor: profile.id,
    });

    if (error) throw error;
    refreshOrderViews();

    return actionOk({ status: (data as { payment_status: string }).payment_status });
  } catch (error) {
    return actionFail(toActionError(error));
  }
}

export async function cancelOrderAction(
  orderId: string,
  reason: string,
): Promise<ActionResult<{ status: string }>> {
  try {
    const profile = await getActionProfile(["admin"]);
    const parsed = cancelOrderSchema.safeParse({ orderId, reason });
    if (!parsed.success) {
      return actionFail(parsed.error.issues[0]?.message ?? "Data pembatalan tidak valid.");
    }

    const { data, error } = await getAdminClient().rpc("cancel_order", {
      p_order_id: parsed.data.orderId,
      p_actor: profile.id,
      p_reason: parsed.data.reason,
    });

    if (error) throw error;
    refreshOrderViews();

    return actionOk({ status: (data as { order_status: string }).order_status });
  } catch (error) {
    return actionFail(toActionError(error));
  }
}

export type DeletedOrderResult = {
  orderCode: string;
  stockRestored: boolean;
  unitsRestored: number;
};

export async function deleteOrderAction(
  orderId: string,
  reasonCode: string,
  reasonNote: string,
): Promise<ActionResult<DeletedOrderResult>> {
  try {
    const profile = await getActionProfile(["cashier", "admin"]);
    const parsed = deleteOrderSchema.safeParse({ orderId, reasonCode, reasonNote });
    if (!parsed.success) {
      return actionFail(parsed.error.issues[0]?.message ?? "Data penghapusan tidak valid.");
    }

    const { data, error } = await getAdminClient().rpc("delete_order_with_audit", {
      p_order_id: parsed.data.orderId,
      p_actor: profile.id,
      p_reason_code: parsed.data.reasonCode,
      p_reason_note: parsed.data.reasonNote || undefined,
    });

    if (error) throw error;
    refreshOrderViews();

    const result = data as {
      order_code: string;
      stock_restored: boolean;
      units_restored: number;
    };

    return actionOk({
      orderCode: result.order_code,
      stockRestored: Boolean(result.stock_restored),
      unitsRestored: Number(result.units_restored ?? 0),
    });
  } catch (error) {
    return actionFail(toActionError(error));
  }
}
