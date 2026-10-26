import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getAdminClient();
  const now = new Date();

  const { data, error } = await admin
    .from("orders")
    .select("id, order_code, customer_name, order_status, pickup_at, created_at")
    .eq("order_type", "pre_order")
    .in("order_status", ["pending_confirmation", "confirmed"])
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const orders = data ?? [];

  const pending = orders.filter((o) => o.order_status === "pending_confirmation");
  
  // Due soon: confirmed orders where pickup is within 120 minutes or already past
  const dueSoon = orders.filter((o) => {
    if (o.order_status !== "confirmed" || !o.pickup_at) return false;
    const diffMinutes = (new Date(o.pickup_at).getTime() - now.getTime()) / 60000;
    return diffMinutes <= 120;
  });

  const totalAlerts = pending.length + dueSoon.length;

  return NextResponse.json({
    pendingCount: pending.length,
    dueSoonCount: dueSoon.length,
    totalAlerts,
    pendingOrders: pending.slice(0, 5).map((o) => ({
      id: o.id,
      code: o.order_code,
      name: o.customer_name,
      createdAt: o.created_at,
    })),
    dueSoonOrders: dueSoon.slice(0, 5).map((o) => ({
      id: o.id,
      code: o.order_code,
      name: o.customer_name,
      pickupAt: o.pickup_at,
    })),
  });
}
