export const DELETE_REASON_OPTIONS = [
  {
    value: "wrong_input",
    label: "Salah input transaksi",
    description: "Produk, jumlah, atau nominal yang dicatat tidak sesuai.",
  },
  {
    value: "duplicate",
    label: "Transaksi duplikat",
    description: "Transaksi yang sama tercatat lebih dari satu kali.",
  },
  {
    value: "customer_cancelled",
    label: "Pelanggan membatalkan",
    description: "Pelanggan membatalkan pesanan sebelum diserahkan.",
  },
  {
    value: "stock_mismatch",
    label: "Stok tidak sesuai",
    description: "Stok fisik tidak cocok dengan catatan sistem.",
  },
  {
    value: "other",
    label: "Lainnya",
    description: "Tuliskan alasan lain pada catatan.",
  },
] as const;

export type DeleteReasonCode = (typeof DELETE_REASON_OPTIONS)[number]["value"];

const DELETE_REASON_LABELS = new Map<string, string>(
  DELETE_REASON_OPTIONS.map((option) => [option.value, option.label]),
);

export function deleteReasonLabel(code: string): string {
  return DELETE_REASON_LABELS.get(code) ?? code;
}
