import { formatIDR } from "@/lib/format";

export type WhatsappPreorderItem = {
  productName: string;
  quantity: number;
  subtotal: number;
};

export type WhatsappPreorderInput = {
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  trackingCode: string | null;
  trackingUrl: string;
  items: WhatsappPreorderItem[];
  totalAmount: number;
  storeName?: string;
};

/**
 * Converts common Indonesian phone formats into the digits-only number that
 * WhatsApp accepts in `wa.me` links. Returns null when the number is not
 * plausible, so callers can disable the action instead of opening a dead link.
 */
export function normalizeWhatsappNumber(input: string | null | undefined): string | null {
  if (!input) return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  const hasPlusPrefix = trimmed.startsWith("+");
  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  // International prefix written as 00 (e.g. 0062 812…).
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (digits.startsWith("620")) {
    digits = `62${digits.slice(3)}`;
  } else if (digits.startsWith("0")) {
    digits = `62${digits.slice(1)}`;
  } else if (digits.startsWith("8")) {
    digits = `62${digits}`;
  }

  if (digits.startsWith("62")) {
    return digits.length >= 10 && digits.length <= 15 ? digits : null;
  }

  // A bare international number is only trusted when it was written with "+".
  if (hasPlusPrefix && digits.length >= 8 && digits.length <= 15) {
    return digits;
  }

  return null;
}

export function buildPreorderWhatsappMessage(input: Omit<WhatsappPreorderInput, "customerPhone">) {
  const storeName = input.storeName?.trim() || "RotiPOS";
  const lines = [
    `Halo ${input.customerName},`,
    "",
    `Pre-order Anda di ${storeName} sudah kami terima.`,
    "",
    `Email: ${input.customerEmail ?? "-"}`,
    `Kode lacak: ${input.trackingCode ?? "-"}`,
    "",
    "Rincian menu:",
    ...input.items.map(
      (item) =>
        `- ${item.quantity}× ${item.productName} (${formatIDR(item.subtotal)})`,
    ),
    "",
    `Total: ${formatIDR(input.totalAmount)}`,
    "",
    "Lacak status pesanan Anda di:",
    input.trackingUrl,
  ];

  return lines.join("\n");
}

export function buildPreorderWhatsappUrl(input: WhatsappPreorderInput): string | null {
  const phone = normalizeWhatsappNumber(input.customerPhone);
  if (!phone || !input.trackingCode) return null;

  const message = buildPreorderWhatsappMessage(input);
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
