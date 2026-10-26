import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { getAdminClient } from "@/lib/supabase/admin";

async function getClientKey(scope: string) {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for");
  const ip =
    headerStore.get("x-vercel-forwarded-for") ||
    headerStore.get("x-real-ip") ||
    forwarded?.split(",")[0]?.trim() ||
    "local-development";

  const digest = createHash("sha256").update(ip).digest("hex").slice(0, 20);
  return `${scope}:${digest}`;
}

/**
 * DB-backed so it also works across serverless instances.
 * Fail-open on infrastructure errors: never block a real order because the
 * limiter itself is unavailable.
 */
export async function checkRateLimit(
  scope: string,
  max: number,
  windowSeconds: number,
) {
  try {
    const key = await getClientKey(scope);
    const { data, error } = await getAdminClient().rpc("check_rate_limit", {
      p_key: key,
      p_window_seconds: windowSeconds,
      p_max: max,
    });

    if (error) {
      console.error("[rotipos-rate-limit]", error.message);
      return true;
    }

    return data === true;
  } catch (error) {
    console.error("[rotipos-rate-limit]", error);
    return true;
  }
}
