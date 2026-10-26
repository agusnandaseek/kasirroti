import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

let adminClient: SupabaseClient<Database> | null = null;

/**
 * Service-role client. Never import this file from a Client Component.
 * All public access is funneled through validated Server Actions.
 */
export function getAdminClient() {
  if (!adminClient) {
    adminClient = createClient<Database>(env.supabaseUrl, env.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: { "x-application-name": "rotipos" },
      },
    });
  }

  return adminClient;
}
