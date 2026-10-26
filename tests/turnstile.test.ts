import { describe, expect, it, vi, beforeEach } from "vitest";
import { verifyTurnstileToken } from "@/lib/turnstile";

describe("verifyTurnstileToken", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY = "mock-secret-key";
  });

  it("fails if token is empty, null, or whitespace", async () => {
    const resNull = await verifyTurnstileToken(null);
    expect(resNull.success).toBe(false);

    const resEmpty = await verifyTurnstileToken("");
    expect(resEmpty.success).toBe(false);

    const resWhitespace = await verifyTurnstileToken("   ");
    expect(resWhitespace.success).toBe(false);
  });

  it("calls Cloudflare endpoint and returns success when response is valid", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        hostname: "example.com",
        challenge_ts: new Date().toISOString(),
      }),
    });

    const res = await verifyTurnstileToken("valid-token");
    expect(res.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("returns error message when Cloudflare rejects the token", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: false,
        "error-codes": ["invalid-input-response"],
      }),
    });

    const res = await verifyTurnstileToken("invalid-token");
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain("Cloudflare Turnstile gagal");
    }
  });

  it("handles timeout or duplicate tokens gracefully", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: false,
        "error-codes": ["timeout-or-duplicate"],
      }),
    });

    const res = await verifyTurnstileToken("expired-token");
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain("kedaluwarsa atau sudah digunakan");
    }
  });
});
