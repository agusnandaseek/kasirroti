import { describe, expect, it } from "vitest";
import {
  businessHoursSchema,
  cancelOrderSchema,
  dayHoursSchema,
  deleteOrderSchema,
  employeeCreateSchema,
  loginSchema,
  paymentSchema,
  preorderSchema,
  productSchema,
  settingsSchema,
  walkinCheckoutSchema,
} from "@/lib/validation/schemas";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";

describe("walkinCheckoutSchema", () => {
  it("accepts a valid cash checkout", () => {
    const result = walkinCheckoutSchema.safeParse({
      items: [{ productId: PRODUCT_ID, quantity: 2 }],
      customerName: "  Ibu Rina ",
      paymentMethod: "cash",
      idempotencyKey: "22222222-2222-4222-8222-222222222222",
    });

    expect(result.success).toBe(true);
    expect(result.data?.customerName).toBe("Ibu Rina");
  });

  it("rejects empty carts and invalid quantities", () => {
    const base = {
      items: [],
      customerName: "Ibu Rina",
      paymentMethod: "cash",
      idempotencyKey: "22222222-2222-4222-8222-222222222222",
    };

    expect(walkinCheckoutSchema.safeParse(base).success).toBe(false);
    expect(
      walkinCheckoutSchema.safeParse({
        ...base,
        items: [{ productId: PRODUCT_ID, quantity: 0 }],
      }).success,
    ).toBe(false);
    expect(
      walkinCheckoutSchema.safeParse({
        ...base,
        items: [{ productId: PRODUCT_ID, quantity: 1000 }],
      }).success,
    ).toBe(false);
    expect(
      walkinCheckoutSchema.safeParse({
        ...base,
        items: [{ productId: PRODUCT_ID, quantity: 1.5 }],
      }).success,
    ).toBe(false);
  });

  it("rejects unknown payment methods", () => {
    const result = walkinCheckoutSchema.safeParse({
      items: [{ productId: PRODUCT_ID, quantity: 1 }],
      customerName: "Ibu Rina",
      paymentMethod: "card",
      idempotencyKey: "22222222-2222-4222-8222-222222222222",
    });

    expect(result.success).toBe(false);
  });
});

describe("preorderSchema", () => {
  const valid = {
    items: [{ productId: PRODUCT_ID, quantity: 3 }],
    customerName: "  Rina Putri ",
    email: "  PELANGGAN@Contoh.COM ",
    phone: " 0812-3456-7890 ",
    pickupAt: "2026-10-26T02:00:00.000Z",
    idempotencyKey: "33333333-3333-4333-8333-333333333333",
  };

  it("normalizes name and email and trims phone", () => {
    const result = preorderSchema.parse(valid);
    expect(result.customerName).toBe("Rina Putri");
    expect(result.email).toBe("pelanggan@contoh.com");
    expect(result.phone).toBe("0812-3456-7890");
    expect(result.company).toBe("");
  });

  it("requires a usable customer name", () => {
    expect(preorderSchema.safeParse({ ...valid, customerName: " " }).success).toBe(false);
    expect(
      walkinCheckoutSchema.safeParse({
        items: [{ productId: PRODUCT_ID, quantity: 1 }],
        customerName: "A",
        paymentMethod: "cash",
        idempotencyKey: "22222222-2222-4222-8222-222222222222",
      }).success,
    ).toBe(false);
  });

  it("requires a pickup timestamp with a timezone offset", () => {
    expect(
      preorderSchema.safeParse({ ...valid, pickupAt: "2026-10-26 09:00" }).success,
    ).toBe(false);
  });

  it("rejects short or malformed phone numbers and bad emails", () => {
    expect(preorderSchema.safeParse({ ...valid, phone: "12345" }).success).toBe(false);
    expect(preorderSchema.safeParse({ ...valid, phone: "0812 abc" }).success).toBe(false);
    expect(preorderSchema.safeParse({ ...valid, email: "bukan-email" }).success).toBe(false);
  });

  it("caps request size", () => {
    expect(
      preorderSchema.safeParse({
        ...valid,
        items: Array.from({ length: 51 }, () => ({ productId: PRODUCT_ID, quantity: 1 })),
      }).success,
    ).toBe(false);
  });

  it("accepts optional honeypot input so the action can reject it", () => {
    const result = preorderSchema.parse({ ...valid, company: "bot" });
    expect(result.company).toBe("bot");
  });
});

describe("loginSchema", () => {
  it("trims emails and requires a password", () => {
    expect(loginSchema.parse({ email: " admin@example.com ", password: "x" })).toEqual({
      email: "admin@example.com",
      password: "x",
    });
    expect(loginSchema.safeParse({ email: "admin@example.com", password: "" }).success).toBe(
      false,
    );
  });
});

describe("productSchema", () => {
  const valid = {
    name: "  Roti Sourdough ",
    description: "",
    price: "25000",
    costPrice: "",
    imageUrl: "",
    isAvailable: "on",
  };

  it("coerces price, trims text and treats empty strings as null", () => {
    const result = productSchema.parse(valid);
    expect(result).toMatchObject({
      name: "Roti Sourdough",
      description: null,
      price: 25000,
      costPrice: null,
      imageUrl: null,
      isAvailable: true,
    });
  });

  it("accepts an optional integer cost price", () => {
    expect(productSchema.parse({ ...valid, costPrice: "15000" }).costPrice).toBe(15000);
    expect(productSchema.safeParse({ ...valid, costPrice: "12.5" }).success).toBe(false);
    expect(productSchema.safeParse({ ...valid, costPrice: "-1" }).success).toBe(false);
    expect(productSchema.safeParse({ ...valid, costPrice: "100000001" }).success).toBe(false);
  });

  it("rejects non-integer, negative or oversized prices", () => {
    expect(productSchema.safeParse({ ...valid, price: "12.5" }).success).toBe(false);
    expect(productSchema.safeParse({ ...valid, price: "-1" }).success).toBe(false);
    expect(productSchema.safeParse({ ...valid, price: "100000001" }).success).toBe(false);
  });

  it("only accepts http(s) image URLs", () => {
    expect(productSchema.parse({ ...valid, imageUrl: "https://example.com/a.jpg" }).imageUrl).toBe(
      "https://example.com/a.jpg",
    );
    expect(productSchema.safeParse({ ...valid, imageUrl: "javascript:alert(1)" }).success).toBe(
      false,
    );
  });

  it("treats unchecked checkboxes as false", () => {
    expect(productSchema.parse({ ...valid, isAvailable: undefined }).isAvailable).toBe(false);
  });
});

describe("settingsSchema", () => {
  const valid = {
    storeName: "RotiPOS",
    timezone: "Asia/Jakarta",
    businessHours: {
      "0": { closed: false, open: "08:00", close: "20:00" },
      "1": { closed: false, open: "08:00", close: "20:00" },
      "2": { closed: false, open: "08:00", close: "20:00" },
      "3": { closed: false, open: "08:00", close: "20:00" },
      "4": { closed: false, open: "08:00", close: "20:00" },
      "5": { closed: false, open: "08:00", close: "20:00" },
      "6": { closed: false, open: "08:00", close: "20:00" },
    },
    slotIntervalMinutes: "30",
    minPreorderMinutes: "60",
    manualQrisEnabled: "on",
  };

  it("accepts store settings and coerces numeric strings", () => {
    const result = settingsSchema.parse(valid);
    expect(result.slotIntervalMinutes).toBe(30);
    expect(result.minPreorderMinutes).toBe(60);
    expect(result.manualQrisEnabled).toBe(true);
  });

  it("rejects unknown timezones", () => {
    expect(settingsSchema.safeParse({ ...valid, timezone: "Mars/Olympus" }).success).toBe(false);
  });

  it("rejects closing time before opening time", () => {
    expect(
      settingsSchema.safeParse({
        ...valid,
        businessHours: { ...valid.businessHours, "1": { closed: false, open: "20:00", close: "08:00" } },
      }).success,
    ).toBe(false);
  });

  it("rejects out-of-range intervals and lead times", () => {
    expect(settingsSchema.safeParse({ ...valid, slotIntervalMinutes: 2 }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...valid, slotIntervalMinutes: 241 }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...valid, minPreorderMinutes: -1 }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...valid, minPreorderMinutes: 10081 }).success).toBe(false);
  });
});

describe("dayHoursSchema", () => {
  it("allows a closed day without hours", () => {
    expect(dayHoursSchema.safeParse({ closed: true }).success).toBe(true);
  });

  it("requires a valid open and close pair otherwise", () => {
    expect(dayHoursSchema.safeParse({ closed: false, open: "08:00" }).success).toBe(false);
    expect(dayHoursSchema.safeParse({ closed: false, open: "8:00", close: "20:00" }).success).toBe(
      false,
    );
    expect(dayHoursSchema.safeParse({ closed: false, open: "08:00", close: "20:00" }).success).toBe(
      true,
    );
  });

  it("rejects keys outside 0-6", () => {
    expect(businessHoursSchema.safeParse({ "7": { closed: true } }).success).toBe(false);
  });
});

describe("employeeCreateSchema", () => {
  it("normalizes email and enforces password length", () => {
    const result = employeeCreateSchema.parse({
      fullName: "Kasir Baru",
      email: "  KASIR@EXAMPLE.COM ",
      role: "cashier",
      password: "Rahasia123",
    });

    expect(result.email).toBe("kasir@example.com");
    expect(
      employeeCreateSchema.safeParse({
        fullName: "Kasir Baru",
        email: "kasir@example.com",
        role: "cashier",
        password: "pendek",
      }).success,
    ).toBe(false);
  });
});

describe("order action schemas", () => {
  it("requires a reason of at least 3 characters", () => {
    expect(
      cancelOrderSchema.safeParse({
        orderId: PRODUCT_ID,
        reason: "  x  ",
      }).success,
    ).toBe(false);
    expect(
      cancelOrderSchema.safeParse({
        orderId: PRODUCT_ID,
        reason: "Stok habis",
      }).success,
    ).toBe(true);
  });

  it("validates manual payment methods", () => {
    expect(paymentSchema.safeParse({ orderId: PRODUCT_ID, method: "cash" }).success).toBe(true);
    expect(
      paymentSchema.safeParse({ orderId: PRODUCT_ID, method: "manual_qris" }).success,
    ).toBe(true);
    expect(paymentSchema.safeParse({ orderId: PRODUCT_ID, method: "card" }).success).toBe(false);
  });

  it("requires a valid deletion reason", () => {
    expect(
      deleteOrderSchema.safeParse({
        orderId: PRODUCT_ID,
        reasonCode: "wrong_input",
      }).success,
    ).toBe(true);
    expect(
      deleteOrderSchema.safeParse({
        orderId: PRODUCT_ID,
        reasonCode: "not_a_reason",
      }).success,
    ).toBe(false);
  });

  it("requires a note of at least 5 characters for the other reason", () => {
    expect(
      deleteOrderSchema.safeParse({
        orderId: PRODUCT_ID,
        reasonCode: "other",
        reasonNote: "    ",
      }).success,
    ).toBe(false);
    expect(
      deleteOrderSchema.safeParse({
        orderId: PRODUCT_ID,
        reasonCode: "other",
        reasonNote: "  Salah pilih produk  ",
      }).success,
    ).toBe(true);
  });

  it("trims the deletion note and rejects notes over 500 characters", () => {
    const parsed = deleteOrderSchema.safeParse({
      orderId: PRODUCT_ID,
      reasonCode: "duplicate",
      reasonNote: "  Transaksi dobel  ",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data?.reasonNote).toBe("Transaksi dobel");

    expect(
      deleteOrderSchema.safeParse({
        orderId: PRODUCT_ID,
        reasonCode: "duplicate",
        reasonNote: "x".repeat(501),
      }).success,
    ).toBe(false);
  });
});
