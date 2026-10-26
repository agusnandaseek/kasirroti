import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type TokenModule = typeof import("@/lib/tokens");
type TokenFormatModule = typeof import("@/lib/token-format");

let tokens: TokenModule;
let format: TokenFormatModule;

beforeAll(async () => {
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    TRACKING_TOKEN_PEPPER: "unit-test-pepper-that-is-long-enough-123456",
  });

  tokens = await import("@/lib/tokens");
  format = await import("@/lib/token-format");
});

const KEY = "44444444-4444-4444-8444-444444444444";

describe("deriveTrackingCode", () => {
  it("is deterministic for the same idempotency key and salt", () => {
    const first = tokens.deriveTrackingCode(KEY);
    const second = tokens.deriveTrackingCode(KEY);

    expect(first).toBe(second);
    expect(first).toMatch(/^[A-HJ-NP-Z2-9]{5}$/);
  });

  it("produces a different code for a different key", () => {
    expect(tokens.deriveTrackingCode(KEY)).not.toBe(
      tokens.deriveTrackingCode("55555555-5555-4555-8555-555555555555"),
    );
  });

  it("produces a different code when the collision salt changes", () => {
    expect(tokens.deriveTrackingCode(KEY, 0)).not.toBe(tokens.deriveTrackingCode(KEY, 1));
  });

  it("does not expose the raw idempotency key", () => {
    expect(tokens.deriveTrackingCode(KEY)).not.toContain(KEY);
  });
});

describe("hashTrackingCode", () => {
  it("returns a stable HMAC-SHA256 hex digest", () => {
    const code = tokens.deriveTrackingCode(KEY);
    const hash = tokens.hashTrackingCode(code);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokens.hashTrackingCode(code)).toBe(hash);
    expect(hash).not.toBe(code);
  });

  it("normalizes case, spaces, and dashes before hashing", () => {
    const hash = tokens.hashTrackingCode("AB7K2");

    expect(tokens.hashTrackingCode(" ab7-k2 ")).toBe(hash);
    expect(tokens.hashTrackingCode("ab7k2")).toBe(hash);
  });

  it("changes when the code changes", () => {
    expect(tokens.hashTrackingCode("AB7K2")).not.toBe(tokens.hashTrackingCode("AB7K3"));
  });
});

describe("tracking code format", () => {
  it("normalizes user input", () => {
    expect(format.normalizeTrackingCode(" ab7-k2 ")).toBe("AB7K2");
  });

  it("accepts five unambiguous characters", () => {
    expect(format.isTrackingCodeFormat("AB7K2")).toBe(true);
  });

  it("rejects ambiguous characters and wrong lengths", () => {
    expect(format.isTrackingCodeFormat("ABIK2")).toBe(false);
    expect(format.isTrackingCodeFormat("AB0K2")).toBe(false);
    expect(format.isTrackingCodeFormat("AB7K")).toBe(false);
  });
});
