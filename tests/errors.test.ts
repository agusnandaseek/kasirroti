import { describe, expect, it, vi } from "vitest";
import { z, ZodError } from "zod";
import { actionFail, actionOk, toActionError } from "@/lib/errors";

describe("ActionResult helpers", () => {
  it("builds success and failure results", () => {
    expect(actionOk({ id: 1 })).toEqual({ ok: true, data: { id: 1 } });
    expect(actionFail("Gagal", "KODE")).toEqual({
      ok: false,
      error: "Gagal",
      code: "KODE",
    });
  });
});

describe("toActionError", () => {
  it("maps known database codes to Indonesian messages", () => {
    expect(toActionError("STATUS_TIDAK_VALID")).toBe(
      "Status pesanan sudah berubah. Muat ulang halaman.",
    );
    expect(toActionError("JADWAL_TIDAK_VALID")).toBe(
      "Jadwal pengambilan tidak tersedia. Pilih slot lain.",
    );
    expect(toActionError("ANTREAN_DITAHAN")).toBe(
      "Pesanan sedang ditahan. Lepas tahanan terlebih dahulu.",
    );
    expect(toActionError("ARAH_ANTREAN_TIDAK_VALID")).toBe("Arah antrean tidak valid.");
  });

  it("recognizes a code embedded in a PostgREST error message", () => {
    expect(
      toActionError({
        message: 'P0001: BELUM_DIBAYAR: Pesanan belum dibayar',
        code: "P0001",
      }),
    ).toBe("Pesanan belum dibayar. Terima pembayaran terlebih dahulu.");
  });

  it("surfaces the first Zod issue", () => {
    const parsed = z.object({ name: z.string().min(2, "Nama minimal 2 karakter.") }).safeParse({
      name: "A",
    });

    expect(parsed.success).toBe(false);
    expect(toActionError(parsed.error)).toBe("Nama minimal 2 karakter.");
    expect(parsed.error).toBeInstanceOf(ZodError);
  });

  it("never leaks unknown errors to the browser", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(toActionError(new Error("duplicate key violates constraint orders_pkey"))).toBe(
      "Terjadi kesalahan. Coba lagi.",
    );
    expect(toActionError("something exploded")).toBe("Terjadi kesalahan. Coba lagi.");
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("supports a custom fallback", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(toActionError(null, "Gagal menyimpan.")).toBe("Gagal menyimpan.");
    expect(spy).toHaveBeenCalledOnce();
  });
});
