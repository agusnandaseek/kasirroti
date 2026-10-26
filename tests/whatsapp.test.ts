import { describe, expect, it } from "vitest";
import { formatIDR } from "@/lib/format";
import {
  buildPreorderWhatsappMessage,
  buildPreorderWhatsappUrl,
  normalizeWhatsappNumber,
} from "@/lib/whatsapp";

const baseInput = {
  customerName: "Rina Putri",
  customerEmail: "rina@contoh.com",
  trackingCode: "AB7K2",
  trackingUrl: "https://rotipos.contoh/track/AB7K2",
  items: [
    { productName: "Roti Cokelat", quantity: 2, subtotal: 50000 },
    { productName: "Bolu Pandan", quantity: 1, subtotal: 25000 },
  ],
  totalAmount: 75000,
  storeName: "RotiPOS",
};

describe("normalizeWhatsappNumber", () => {
  it("normalizes the common Indonesian formats to 62 digits", () => {
    expect(normalizeWhatsappNumber("0812-3456-7890")).toBe("6281234567890");
    expect(normalizeWhatsappNumber("+62 812 3456 7890")).toBe("6281234567890");
    expect(normalizeWhatsappNumber("62812 3456 7890")).toBe("6281234567890");
    expect(normalizeWhatsappNumber("812 3456 7890")).toBe("6281234567890");
    expect(normalizeWhatsappNumber("0062 812 3456 7890")).toBe("6281234567890");
  });

  it("keeps an explicit international number", () => {
    expect(normalizeWhatsappNumber("+1 (415) 555-0132")).toBe("14155550132");
  });

  it("rejects empty and implausible numbers", () => {
    expect(normalizeWhatsappNumber(null)).toBeNull();
    expect(normalizeWhatsappNumber("")).toBeNull();
    expect(normalizeWhatsappNumber("12345")).toBeNull();
    expect(normalizeWhatsappNumber("0812")).toBeNull();
  });
});

describe("buildPreorderWhatsappMessage", () => {
  it("contains the email, tracking code, item list, and tracking link", () => {
    const message = buildPreorderWhatsappMessage(baseInput);

    expect(message).toContain("rina@contoh.com");
    expect(message).toContain("AB7K2");
    expect(message).toContain("2× Roti Cokelat");
    expect(message).toContain("1× Bolu Pandan");
    expect(message).toContain("https://rotipos.contoh/track/AB7K2");
    expect(message).toContain(formatIDR(75000));
    expect(message).toContain("RotiPOS");
  });
});

describe("buildPreorderWhatsappUrl", () => {
  it("builds a wa.me link with the encoded message", () => {
    const url = buildPreorderWhatsappUrl({
      ...baseInput,
      customerPhone: "0812 3456 7890",
    });

    expect(url).toMatch(/^https:\/\/wa\.me\/6281234567890\?text=/);
    const encoded = url?.split("?text=")[1] ?? "";
    expect(decodeURIComponent(encoded)).toBe(buildPreorderWhatsappMessage(baseInput));
  });

  it("returns null when the phone or tracking code is missing", () => {
    expect(buildPreorderWhatsappUrl({ ...baseInput, customerPhone: null })).toBeNull();
    expect(buildPreorderWhatsappUrl({ ...baseInput, customerPhone: "abc" })).toBeNull();
    expect(
      buildPreorderWhatsappUrl({
        ...baseInput,
        customerPhone: "081234567890",
        trackingCode: null,
      }),
    ).toBeNull();
  });
});
