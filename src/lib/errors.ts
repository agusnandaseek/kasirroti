import { ZodError } from "zod";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

export function actionOk<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function actionFail(error: string, code?: string): ActionResult<never> {
  return { ok: false, error, code };
}

const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "Sesi kamu sudah berakhir. Silakan masuk kembali.",
  AKSES_DITOLAK: "Kamu tidak memiliki akses untuk tindakan ini.",
  AKUN_TIDAK_DITEMUKAN: "Akun pegawai tidak ditemukan.",
  AKUN_NONAKTIF: "Akun ini sudah dinonaktifkan.",
  ITEM_TIDAK_VALID: "Item pesanan tidak valid.",
  ITEM_KOSONG: "Pilih minimal satu produk.",
  ITEM_TERLALU_BANYAK: "Terlalu banyak jenis item dalam satu pesanan.",
  PRODUK_TIDAK_VALID: "Ada produk yang tidak tersedia atau sudah berubah.",
  KUANTITAS_TERLALU_BESAR: "Kuantitas per produk maksimal 999.",
  EMAIL_TIDAK_VALID: "Format email tidak valid.",
  TELEPON_TIDAK_VALID: "Nomor HP/WhatsApp tidak valid.",
  JADWAL_TIDAK_VALID: "Jadwal pengambilan tidak tersedia. Pilih slot lain.",
  TOKEN_TIDAK_VALID: "Tautan tracking tidak valid.",
  STATUS_TIDAK_VALID: "Status pesanan sudah berubah. Muat ulang halaman.",
  PESANAN_TIDAK_DITEMUKAN: "Pesanan tidak ditemukan.",
  ARAH_ANTREAN_TIDAK_VALID: "Arah antrean tidak valid.",
  ANTREAN_DITAHAN: "Pesanan sedang ditahan. Lepas tahanan terlebih dahulu.",
  STATUS_TAHAN_TIDAK_VALID: "Status tahanan antrean tidak valid.",
  ALASAN_WAJIB: "Alasan wajib diisi minimal 3 karakter.",
  METODE_PEMBAYARAN_TIDAK_VALID: "Metode pembayaran tidak valid.",
  QRIS_TIDAK_AKTIF: "Pembayaran QRIS manual sedang dinonaktifkan.",
  BELUM_DIBAYAR: "Pesanan belum dibayar. Terima pembayaran terlebih dahulu.",
  DATA_PEMBAYARAN_TIDAK_KONSISTEN: "Data pembayaran tidak konsisten. Hubungi admin.",
  GAGAL_MEMBUAT_PESANAN: "Pesanan gagal dibuat. Coba lagi.",
  RATE_LIMITED: "Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.",
  EMAIL_SUDAH_DIGUNAKAN: "Email tersebut sudah digunakan akun lain.",
  ADMIN_TERAKHIR: "Tidak bisa menonaktifkan admin aktif terakhir.",
  TIDAK_BISA_AKUN_SENDIRI: "Kamu tidak bisa menonaktifkan akun sendiri.",
};

function isZodLikeError(error: unknown): error is ZodError {
  if (error instanceof ZodError) return true;

  // Guards against duplicated Zod instances (e.g. ESM/CJS interop or bundling).
  return Boolean(
    error &&
      typeof error === "object" &&
      "issues" in error &&
      Array.isArray((error as { issues?: unknown }).issues),
  );
}

function extractMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message ?? "");
  }

  if (typeof error === "string") return error;
  return "";
}

export function toActionError(
  error: unknown,
  fallback = "Terjadi kesalahan. Coba lagi.",
): string {
  // Validation issues are safe to show: they are written by our own schemas.
  if (isZodLikeError(error)) {
    return error.issues[0]?.message ?? "Data yang dikirim tidak valid.";
  }

  const raw = extractMessage(error);

  for (const [code, message] of Object.entries(ERROR_MESSAGES)) {
    if (raw === code || raw.includes(code)) return message;
  }

  // Never expose raw database errors to the browser.
  console.error("[rotipos-action]", error);
  return fallback;
}
