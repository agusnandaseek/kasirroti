export type TurnstileVerifyResult =
  | { success: true; hostname?: string; cdata?: string }
  | { success: false; error: string; errorCodes?: string[] };

/**
 * Verifies a Cloudflare Turnstile token server-side using Cloudflare's official siteverify endpoint.
 * Reference: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */
export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string,
): Promise<TurnstileVerifyResult> {
  const secretKey = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;

  if (!token || typeof token !== "string" || token.trim().length === 0) {
    return {
      success: false,
      error: "Verifikasi keamanan Cloudflare Turnstile wajib diselesaikan.",
    };
  }

  // In testing environments without secret key, bypass
  if (!secretKey) {
    if (process.env.NODE_ENV === "test") {
      return { success: true };
    }
    return {
      success: false,
      error: "Kunci rahasia Cloudflare Turnstile belum dikonfigurasi di server.",
    };
  }

  try {
    const formData = new URLSearchParams();
    formData.append("secret", secretKey);
    formData.append("response", token.trim());
    if (remoteIp) {
      formData.append("remoteip", remoteIp);
    }

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        success: false,
        error: `Cloudflare Turnstile gateway error: HTTP ${res.status}`,
      };
    }

    const data = (await res.json()) as {
      success: boolean;
      "error-codes"?: string[];
      challenge_ts?: string;
      hostname?: string;
      cdata?: string;
    };

    if (!data.success) {
      const errorCodes = data["error-codes"] ?? [];
      const isExpiredOrDuplicate = errorCodes.includes("timeout-or-duplicate");
      return {
        success: false,
        error: isExpiredOrDuplicate
          ? "Sesi verifikasi Cloudflare telah kedaluwarsa atau sudah digunakan. Silakan ulangi verifikasi."
          : "Verifikasi keamanan Cloudflare Turnstile gagal. Silakan coba lagi.",
        errorCodes,
      };
    }

    return {
      success: true,
      hostname: data.hostname,
      cdata: data.cdata,
    };
  } catch (err) {
    console.error("[turnstile-verify-error]", err);
    return {
      success: false,
      error: "Gagal memverifikasi keamanan ke server Cloudflare. Periksa koneksi internet.",
    };
  }
}
