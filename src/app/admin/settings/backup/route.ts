import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireRole(["admin"]);

  const admin = getAdminClient();

  const [
    settingsResult,
    productsResult,
    ordersResult,
    itemsResult,
    historyResult,
    paymentsResult,
    profilesResult,
  ] = await Promise.all([
    admin.from("store_settings").select("*"),
    admin.from("products").select("*"),
    admin.from("orders").select("*"),
    admin.from("order_items").select("*"),
    admin.from("order_status_history").select("*"),
    admin.from("payments").select("*"),
    admin.from("profiles").select("id, full_name, role, is_active, created_at"),
  ]);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `rotipos-backup-${timestamp}.json`;

  const snapshot = {
    metadata: {
      exportedAt: new Date().toISOString(),
      storeName: settingsResult.data?.[0]?.store_name ?? "RotiPOS",
      version: "1.0",
    },
    tables: {
      storeSettings: settingsResult.data ?? [],
      products: productsResult.data ?? [],
      orders: ordersResult.data ?? [],
      orderItems: itemsResult.data ?? [],
      orderStatusHistory: historyResult.data ?? [],
      payments: paymentsResult.data ?? [],
      profiles: profilesResult.data ?? [],
    },
  };

  return new NextResponse(JSON.stringify(snapshot, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
