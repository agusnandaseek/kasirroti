import "server-only";
import { createHmac } from "node:crypto";
import { env } from "@/lib/env";
import { normalizeTrackingCode } from "@/lib/token-format";

/**
 * Tracking codes are 5 characters from a 32-symbol alphabet. The code is
 * derived deterministically from the idempotency key and a collision salt so
 * a safe retry can reproduce the same code. The database stores only an HMAC.
 */
const TRACKING_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function deriveTrackingCode(idempotencyKey: string, salt = 0) {
  const digest = createHmac("sha256", env.trackingPepper)
    .update(`preorder:${idempotencyKey}:${salt}`)
    .digest();

  let code = "";
  for (let index = 0; index < 5; index += 1) {
    code += TRACKING_ALPHABET[digest[index]! & 31];
  }
  return code;
}

export function hashTrackingCode(code: string) {
  return createHmac("sha256", env.trackingPepper)
    .update(`tracking:${normalizeTrackingCode(code)}`)
    .digest("hex");
}
