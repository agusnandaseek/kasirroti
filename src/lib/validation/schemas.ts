import { z } from "zod";

const uuid = z.string().uuid("ID tidak valid.");
const customerNameSchema = z
  .string()
  .trim()
  .min(2, "Nama pemesan minimal 2 karakter.")
  .max(100, "Nama pemesan maksimal 100 karakter.");
const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const checkbox = z.preprocess(
  (value) => value === true || value === "true" || value === "on" || value === "1",
  z.boolean(),
);

export const cartItemSchema = z.object({
  productId: uuid,
  quantity: z
    .number()
    .int("Kuantitas harus bilangan bulat.")
    .min(1, "Kuantitas minimal 1.")
    .max(999, "Kuantitas maksimal 999."),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Format email tidak valid."),
  password: z.string().min(1, "Password wajib diisi."),
});

export const walkinCheckoutSchema = z.object({
  items: z.array(cartItemSchema).min(1, "Pilih minimal satu produk.").max(50),
  customerName: customerNameSchema,
  paymentMethod: z.enum(["cash", "manual_qris"], {
    message: "Metode pembayaran tidak valid.",
  }),
  idempotencyKey: uuid,
});

export const preorderSchema = z.object({
  items: z.array(cartItemSchema).min(1, "Pilih minimal satu produk.").max(50),
  customerName: customerNameSchema,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Format email tidak valid.")
    .max(160),
  phone: z
    .string()
    .trim()
    .min(8, "Nomor HP/WhatsApp minimal 8 digit.")
    .max(20, "Nomor HP/WhatsApp terlalu panjang.")
    .regex(/^[0-9+()\-\s]+$/, "Nomor HP/WhatsApp hanya boleh angka dan simbol telepon."),
  pickupAt: z
    .string()
    .datetime({ offset: true, message: "Jadwal pengambilan tidak valid." }),
  idempotencyKey: uuid,
  company: z.string().max(200).optional().default(""),
  turnstileToken: z.string().optional(),
});

export const orderIdSchema = z.object({ orderId: uuid });

export const rejectPreorderSchema = z.object({
  orderId: uuid,
  reason: z
    .string()
    .trim()
    .min(3, "Alasan minimal 3 karakter.")
    .max(300, "Alasan maksimal 300 karakter."),
});

export const cancelOrderSchema = rejectPreorderSchema;

export const deleteOrderSchema = z
  .object({
    orderId: uuid,
    reasonCode: z.enum(
      ["wrong_input", "duplicate", "customer_cancelled", "stock_mismatch", "other"],
      { message: "Alasan hapus tidak valid." },
    ),
    reasonNote: z
      .string()
      .trim()
      .max(500, "Catatan maksimal 500 karakter.")
      .optional()
      .default(""),
  })
  .superRefine((value, ctx) => {
    if (value.reasonCode === "other" && value.reasonNote.length < 5) {
      ctx.addIssue({
        code: "custom",
        path: ["reasonNote"],
        message: "Catatan alasan minimal 5 karakter.",
      });
    }
  });

export const paymentSchema = z.object({
  orderId: uuid,
  method: z.enum(["cash", "manual_qris"], {
    message: "Metode pembayaran tidak valid.",
  }),
});

export const productSchema = z.object({
  name: z.string().trim().min(2, "Nama produk minimal 2 karakter.").max(100),
  description: z
    .string()
    .trim()
    .max(500, "Deskripsi maksimal 500 karakter.")
    .optional()
    .transform((value) => (value ? value : null)),
  price: z.coerce
    .number()
    .int("Harga harus bilangan bulat.")
    .min(0, "Harga tidak boleh negatif.")
    .max(100_000_000, "Harga terlalu besar."),
  costPrice: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? null : value),
    z.union([
      z.null(),
      z.coerce
        .number()
        .int("Harga modal harus bilangan bulat.")
        .min(0, "Harga modal tidak boleh negatif.")
        .max(100_000_000, "Harga modal terlalu besar."),
    ]),
  ),
  imageUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => (value ? value : null))
    .refine(
      (value) => value === null || /^https?:\/\/.+/i.test(value),
      "URL foto harus diawali http:// atau https://.",
    ),
  stock: z.coerce
    .number()
    .int("Stok harus bilangan bulat.")
    .min(0, "Stok tidak boleh negatif.")
    .max(100_000, "Stok maksimal 100.000.")
    .default(0),
  isAvailable: checkbox,
});

export const productUpdateSchema = productSchema.extend({ id: uuid });

export const employeeCreateSchema = z.object({
  fullName: z.string().trim().min(2, "Nama minimal 2 karakter.").max(100),
  email: z.string().trim().toLowerCase().email("Format email tidak valid."),
  role: z.enum(["admin", "cashier"], { message: "Peran tidak valid." }),
  password: z
    .string()
    .min(8, "Password minimal 8 karakter.")
    .max(72, "Password maksimal 72 karakter."),
});

export const employeeUpdateSchema = z.object({
  id: uuid,
  fullName: z.string().trim().min(2, "Nama minimal 2 karakter.").max(100),
  role: z.enum(["admin", "cashier"], { message: "Peran tidak valid." }),
  isActive: checkbox,
});

export const dayHoursSchema = z
  .object({
    closed: z.boolean(),
    open: z.string().regex(timeRegex, "Format jam HH:mm.").optional(),
    close: z.string().regex(timeRegex, "Format jam HH:mm.").optional(),
  })
  .refine((value) => value.closed || (value.open && value.close), {
    message: "Jam buka dan tutup wajib diisi.",
  })
  .refine((value) => value.closed || (value.open ?? "") < (value.close ?? ""), {
    message: "Jam tutup harus setelah jam buka.",
  });

export const businessHoursSchema = z.record(
  z.enum(["0", "1", "2", "3", "4", "5", "6"]),
  dayHoursSchema,
);

export const settingsSchema = z.object({
  storeName: z.string().trim().min(2, "Nama toko minimal 2 karakter.").max(100),
  timezone: z
    .string()
    .trim()
    .min(1, "Zona waktu wajib dipilih.")
    .max(64)
    .refine((timezone) => {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
        return true;
      } catch {
        return false;
      }
    }, "Zona waktu tidak valid."),
  businessHours: businessHoursSchema,
  slotIntervalMinutes: z.coerce
    .number()
    .int("Interval harus bilangan bulat.")
    .min(5, "Interval minimal 5 menit.")
    .max(240, "Interval maksimal 240 menit."),
  minPreorderMinutes: z.coerce
    .number()
    .int("Lead time harus bilangan bulat.")
    .min(0, "Lead time tidak boleh negatif.")
    .max(10080, "Lead time maksimal 7 hari."),
  manualQrisEnabled: checkbox,
});

export type WalkinCheckoutInput = z.infer<typeof walkinCheckoutSchema>;
export type PreorderInput = z.infer<typeof preorderSchema>;
