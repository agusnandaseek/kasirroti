"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Banknote,
  Check,
  CheckCircle2,
  Minus,
  Plus,
  QrCode,
  Search,
  ShoppingBasket,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CopyButton } from "@/components/ui/copy-button";
import { PaymentBadge } from "@/components/ui/status-badge";
import { adjustProductStockAction } from "@/app/admin/products/actions";
import { createWalkinOrderAction, type WalkinReceipt } from "./actions";
import { formatDateTime, formatIDR } from "@/lib/format";
import type { PaymentMethod, ProductView } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  products: ProductView[];
  qrisEnabled: boolean;
  timezone: string;
  cashierName: string;
};

type Receipt = WalkinReceipt & {
  items: { name: string; quantity: number; subtotal: number }[];
  totalAmount: number;
  method: PaymentMethod;
  at: string;
};

export function PosTerminal({ products, qrisEnabled, timezone, cashierName }: Props) {
  const router = useRouter();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [paidConfirmed, setPaidConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [adjustingStockId, setAdjustingStockId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const idempotencyKey = useRef("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  const filteredProducts = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return products;
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(term) ||
        (product.description ?? "").toLowerCase().includes(term),
    );
  }, [products, query]);

  const items = useMemo(
    () =>
      products
        .filter((product) => (cart[product.id] ?? 0) > 0)
        .map((product) => ({ product, quantity: cart[product.id] })),
    [cart, products],
  );

  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  function setQuantity(productId: string, quantity: number) {
    const product = products.find((p) => p.id === productId);
    const maxStock = product ? product.stock : 999;

    setCart((current) => {
      const next = { ...current };
      if (quantity <= 0) {
        delete next[productId];
      } else {
        if (quantity > maxStock) {
          toast.error(
            `Stok ${product?.name ?? "produk"} hanya tersisa ${maxStock} pcs.`,
          );
          next[productId] = maxStock;
        } else {
          next[productId] = quantity;
        }
      }
      return next;
    });
  }

  function addProduct(productId: string) {
    const product = products.find((p) => p.id === productId);
    if (!product || product.stock <= 0) {
      toast.error(`Stok ${product?.name ?? "produk"} sedang habis.`);
      return;
    }
    const currentQty = cart[productId] ?? 0;
    if (currentQty >= product.stock) {
      toast.error(`Stok ${product.name} hanya tersisa ${product.stock} pcs.`);
      return;
    }
    setQuantity(productId, currentQty + 1);
  }

  async function handleAdjustShelfStock(
    event: React.MouseEvent,
    product: ProductView,
    delta: number,
  ) {
    event.stopPropagation();
    if (adjustingStockId) return;

    setAdjustingStockId(product.id);
    const result = await adjustProductStockAction(product.id, delta);
    setAdjustingStockId(null);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(
      `Stok fisik ${product.name}: ${result.data.stock} pcs ${
        result.data.stock <= 0 ? "(Stok habis)" : ""
      }`,
    );

    // If stock is now less than current in cart, cap cart quantity
    if ((cart[product.id] ?? 0) > result.data.stock) {
      setQuantity(product.id, result.data.stock);
    }

    router.refresh();
  }

  function openConfirm() {
    if (items.length === 0) {
      toast.error("Keranjang masih kosong.");
      return;
    }
    if (customerName.trim().length < 2) {
      toast.error("Isi nama pemesan minimal 2 karakter.");
      nameInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      nameInputRef.current?.focus();
      return;
    }

    // Double check stock sufficiency
    for (const item of items) {
      if (item.quantity > item.product.stock) {
        toast.error(
          `Stok ${item.product.name} tidak mencukupi (tersedia: ${item.product.stock}, di keranjang: ${item.quantity}). Sesuaikan keranjang terlebih dahulu.`,
        );
        return;
      }
    }

    setError(null);
    setPaidConfirmed(false);
    setConfirmOpen(true);
  }

  async function submitOrder() {
    const trimmedName = customerName.trim();
    if (!paidConfirmed || trimmedName.length < 2) return;

    if (!idempotencyKey.current) {
      idempotencyKey.current = crypto.randomUUID();
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await createWalkinOrderAction({
        items: items.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
        customerName: trimmedName,
        paymentMethod: method,
        idempotencyKey: idempotencyKey.current,
      });

      if (!result.ok) {
        setError(result.error);
        setSubmitting(false);
        return;
      }

      setReceipt({
        ...result.data,
        items: items.map((item) => ({
          name: item.product.name,
          quantity: item.quantity,
          subtotal: item.product.price * item.quantity,
        })),
        totalAmount: result.data.totalAmount,
        method,
        at: new Date().toISOString(),
      });

      idempotencyKey.current = "";
      setCart({});
      setCustomerName("");
      setConfirmOpen(false);
      setPaidConfirmed(false);
      setSubmitting(false);
      toast.success(
        result.data.status === "preparing"
          ? `Pesanan ${result.data.code} langsung diproses.`
          : `Pesanan ${result.data.code} masuk antrean.`,
      );
      router.refresh();
    } catch {
      setError("Koneksi terputus. Coba konfirmasi lagi dengan keranjang yang sama.");
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="grid items-start gap-5 xl:grid-cols-[1fr_370px]">
        <section className="min-w-0">
          <div className="mb-4 flex flex-col gap-3 border-[3px] border-ink bg-paper p-3 shadow-hard-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
                strokeWidth={3}
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari produk…"
                aria-label="Cari produk"
                className="h-10 pl-9 text-xs"
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">
                Kasir: {cashierName}
              </span>
              <Badge tone="mint">{products.length} menu katalog</Badge>
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="border-[3px] border-dashed border-ink/35 bg-paper/60 px-4 py-16 text-center">
              <p className="text-sm font-bold">Produk tidak ditemukan</p>
              <p className="mt-1 text-xs text-muted">Coba kata kunci lain atau periksa katalog.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4">
              {filteredProducts.map((product) => {
                const quantity = cart[product.id] ?? 0;
                const isOutOfStock = product.stock <= 0;
                const isLowStock = product.stock > 0 && product.stock < 5;

                return (
                  <div
                    key={product.id}
                    className={cn(
                      "flex flex-col justify-between overflow-hidden border-[3px] border-ink text-left shadow-hard-sm transition",
                      quantity > 0
                        ? "bg-butter-soft"
                        : isOutOfStock
                          ? "bg-paper/70 opacity-80"
                          : "bg-paper",
                    )}
                  >
                    {/* Clickable Card Header & Image for Adding to Cart */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => addProduct(product.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          addProduct(product.id);
                        }
                      }}
                      className={cn(
                        "group cursor-pointer select-none",
                        isOutOfStock && "cursor-not-allowed",
                      )}
                      title={
                        isOutOfStock
                          ? "Stok habis"
                          : `Klik untuk tambah ke keranjang (Sisa: ${product.stock})`
                      }
                    >
                      <div className="relative aspect-[4/3] w-full overflow-hidden border-b-[3px] border-ink bg-butter-soft">
                        {product.imageUrl ? (
                          <Image
                            src={product.imageUrl}
                            alt={product.name}
                            fill
                            sizes="(max-width: 640px) 50vw, 240px"
                            className="object-cover transition group-hover:scale-105"
                          />
                        ) : (
                          <div className="hatch flex h-full w-full items-center justify-center">
                            <span className="font-display text-5xl uppercase text-ink/25">
                              {product.name.slice(0, 1)}
                            </span>
                          </div>
                        )}

                        {/* Cart Quantity Badge */}
                        {quantity > 0 ? (
                          <span className="absolute right-2 top-2 flex size-8 items-center justify-center border-[3px] border-ink bg-ink font-mono text-sm font-bold text-cream shadow-hard-sm">
                            {quantity}
                          </span>
                        ) : null}

                        {/* Out of stock watermark badge */}
                        {isOutOfStock ? (
                          <div className="absolute inset-0 flex items-center justify-center bg-paper/85">
                            <span className="border-2 border-ink bg-danger px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-cream shadow-hard-sm">
                              Stok Habis
                            </span>
                          </div>
                        ) : null}
                      </div>

                      <div className="p-2.5 pb-1.5">
                        <p className="line-clamp-2 text-xs font-bold leading-tight sm:text-sm">
                          {product.name}
                        </p>
                        <div className="mt-1 flex items-center justify-between gap-1">
                          <span className="font-mono text-[11px] font-bold">
                            {formatIDR(product.price)}
                          </span>
                          {!isOutOfStock ? (
                            <span className="flex size-5 items-center justify-center border-2 border-ink bg-butter group-hover:bg-[#ffd35c]">
                              <Plus className="size-3" strokeWidth={3.5} />
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {/* Shelf Stock Indicator & Quick Adjustment Buttons */}
                    <div className="mt-1 border-t-2 border-dashed border-ink/25 bg-cream/30 px-2 py-1.5">
                      <div className="flex items-center justify-between gap-1">
                        <div className="min-w-0">
                          <span className="block font-mono text-[7px] uppercase tracking-wider text-muted">
                            Fisik Etalase
                          </span>
                          <span
                            className={cn(
                              "font-mono text-[10px] font-bold leading-none",
                              isOutOfStock
                                ? "text-danger"
                                : isLowStock
                                  ? "text-amber-700"
                                  : "text-ink",
                            )}
                          >
                            {isOutOfStock ? "Habis (0)" : `${product.stock} pcs`}
                          </span>
                        </div>

                        {/* Quick Action +/- for shelf stock */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => handleAdjustShelfStock(e, product, -1)}
                            disabled={adjustingStockId === product.id || product.stock <= 0}
                            className="flex size-6 items-center justify-center border-2 border-ink bg-paper font-bold hover:bg-cream disabled:opacity-30"
                            title="Kurangi stok etalase (-1)"
                            aria-label={`Kurangi stok ${product.name}`}
                          >
                            <Minus className="size-2.5" strokeWidth={3.5} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleAdjustShelfStock(e, product, 1)}
                            disabled={adjustingStockId === product.id}
                            className="flex size-6 items-center justify-center border-2 border-ink bg-butter font-bold hover:bg-[#ffd35c] disabled:opacity-30"
                            title="Tambah stok etalase (+1)"
                            aria-label={`Tambah stok ${product.name}`}
                          >
                            <Plus className="size-2.5" strokeWidth={3.5} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <aside id="cart" className="scroll-mt-36 xl:sticky xl:top-36">
          <div className="border-[3px] border-ink bg-paper shadow-hard">
            <div className="flex items-center justify-between border-b-[3px] border-ink bg-ink p-4 text-cream">
              <div className="flex items-center gap-2">
                <ShoppingBasket className="size-4 text-butter" strokeWidth={3} />
                <h2 className="text-lg uppercase">Pesanan baru</h2>
              </div>
              <span className="border-2 border-cream/40 px-1.5 py-0.5 font-mono text-[9px] font-bold">
                {itemCount} item
              </span>
            </div>

            <div className="max-h-[42vh] overflow-y-auto p-3">
              {items.length === 0 ? (
                <div className="border-[3px] border-dashed border-ink/25 px-3 py-8 text-center">
                  <p className="text-xs font-bold">Belum ada item</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-muted">
                    Ketuk produk untuk menambahkan ke keranjang.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {items.map((item) => {
                    const atStockLimit = item.quantity >= item.product.stock;
                    return (
                      <li
                        key={item.product.id}
                        className="border-2 border-ink bg-cream/40 p-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-bold leading-tight">
                              {item.product.name}
                            </p>
                            <span className="font-mono text-[9px] text-muted">
                              Stok: {item.product.stock} pcs
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setQuantity(item.product.id, 0)}
                            className="text-muted transition hover:text-danger"
                            aria-label={`Hapus ${item.product.name}`}
                          >
                            <Trash2 className="size-3.5" strokeWidth={3} />
                          </button>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setQuantity(item.product.id, item.quantity - 1)
                              }
                              className="flex size-6 items-center justify-center border-2 border-ink bg-paper hover:bg-cream"
                              aria-label={`Kurangi ${item.product.name}`}
                            >
                              <Minus className="size-3" strokeWidth={3.5} />
                            </button>
                            <span className="w-7 text-center font-mono text-xs font-bold">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setQuantity(item.product.id, item.quantity + 1)
                              }
                              disabled={atStockLimit}
                              className={cn(
                                "flex size-6 items-center justify-center border-2 border-ink",
                                atStockLimit
                                  ? "cursor-not-allowed bg-muted/20 opacity-40"
                                  : "bg-butter hover:bg-[#ffd35c]",
                              )}
                              title={
                                atStockLimit
                                  ? "Maksimal stok tercapai"
                                  : `Tambah ${item.product.name}`
                              }
                              aria-label={`Tambah ${item.product.name}`}
                            >
                              <Plus className="size-3" strokeWidth={3.5} />
                            </button>
                          </div>
                          <span className="font-mono text-[11px] font-bold">
                            {formatIDR(item.product.price * item.quantity)}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="border-t-[3px] border-ink p-3">
              <Field
                label="Nama pemesan"
                htmlFor="customer-name"
                required
                hint="Wajib diisi agar pesanan mudah dipanggil."
              >
                <Input
                  ref={nameInputRef}
                  id="customer-name"
                  name="customerName"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="Contoh: Ibu Rina"
                  autoComplete="name"
                  maxLength={100}
                  required
                />
              </Field>

              <p className="mt-3 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-muted">
                Metode pembayaran
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMethod("cash")}
                  aria-pressed={method === "cash"}
                  className={cn(
                    "flex items-center justify-center gap-1.5 border-[3px] border-ink py-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em] transition",
                    method === "cash"
                      ? "bg-butter shadow-hard-sm"
                      : "bg-paper hover:bg-cream",
                  )}
                >
                  <Banknote className="size-3.5" strokeWidth={3} />
                  Tunai
                </button>
                <button
                  type="button"
                  onClick={() => qrisEnabled && setMethod("manual_qris")}
                  disabled={!qrisEnabled}
                  aria-pressed={method === "manual_qris"}
                  className={cn(
                    "flex items-center justify-center gap-1.5 border-[3px] border-ink py-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em] transition",
                    method === "manual_qris"
                      ? "bg-butter shadow-hard-sm"
                      : "bg-paper hover:bg-cream",
                    !qrisEnabled && "cursor-not-allowed opacity-40",
                  )}
                  title={qrisEnabled ? "QRIS manual" : "QRIS manual dinonaktifkan admin"}
                >
                  <QrCode className="size-3.5" strokeWidth={3} />
                  QRIS
                </button>
              </div>

              <div className="mt-3 flex items-end justify-between border-t-2 border-dashed border-ink/25 pt-3">
                <div>
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em]">
                    Total
                  </p>
                  <p className="text-[10px] text-muted">Harga dihitung ulang di server</p>
                </div>
                <span className="font-display text-3xl leading-none">{formatIDR(total)}</span>
              </div>

              <Button
                type="button"
                size="lg"
                className="mt-3 w-full"
                onClick={openConfirm}
                disabled={items.length === 0}
              >
                Bayar & buat pesanan
              </Button>
            </div>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t-[3px] border-ink bg-paper p-2 xl:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-muted">
              {itemCount} item
            </p>
            <p className="font-display text-lg leading-none">{formatIDR(total)}</p>
          </div>
          <a
            href="#cart"
            className="inline-flex h-10 items-center border-[3px] border-ink bg-butter px-4 font-mono text-[10px] font-bold uppercase tracking-[0.12em] shadow-hard-sm"
          >
            Lihat keranjang
          </a>
        </div>
      </div>
      <div className="h-16 xl:hidden" />

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!submitting) {
            setConfirmOpen(open);
            if (!open) setError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-terracotta">
              Konfirmasi manual
            </p>
            <DialogTitle>Pembayaran sudah diterima?</DialogTitle>
          </DialogHeader>

          <div className="border-[3px] border-ink bg-cream p-3">
            <div className="flex items-center justify-between border-b-2 border-dashed border-ink/25 pb-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em]">
                {method === "cash" ? "Tunai" : "QRIS manual"}
              </span>
              <PaymentBadge status="paid" />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-muted">
                Pemesan
              </span>
              <span className="truncate text-xs font-bold">{customerName.trim()}</span>
            </div>
            <ul className="mt-2 space-y-1.5 text-xs">
              {items.map((item) => (
                <li key={item.product.id} className="flex justify-between gap-2">
                  <span className="min-w-0">
                    {item.quantity} × {item.product.name}
                  </span>
                  <span className="shrink-0 font-mono">
                    {formatIDR(item.product.price * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex items-end justify-between border-t-2 border-ink pt-2">
              <span className="font-mono text-[10px] font-bold uppercase">Total</span>
              <span className="font-display text-2xl">{formatIDR(total)}</span>
            </div>
          </div>

          {method === "manual_qris" ? (
            <p className="mt-3 border-2 border-ink bg-butter-soft px-3 py-2 text-[10px] leading-relaxed">
              QRIS manual: verifikasi notifikasi pembayaran di perangkat toko sebelum mencentang
              konfirmasi. Aplikasi tidak mengecek pembayaran otomatis.
            </p>
          ) : null}

          <div className="mt-3">
            <Checkbox
              checked={paidConfirmed}
              onChange={(event) => setPaidConfirmed(event.target.checked)}
              label={`Saya sudah menerima pembayaran ${formatIDR(total)}`}
            />
          </div>

          {error ? (
            <div
              role="alert"
              className="mt-3 border-[3px] border-ink bg-[#fdeae6] px-3 py-2 text-xs font-semibold leading-relaxed text-danger"
            >
              {error}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setConfirmOpen(false)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="success"
              onClick={submitOrder}
              disabled={!paidConfirmed || submitting}
              loading={submitting}
            >
              <Check className="size-4" strokeWidth={3.5} />
              {submitting ? "Menyimpan…" : "Konfirmasi & buat pesanan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(receipt)} onOpenChange={(open) => !open && setReceipt(null)}>
        <DialogContent className="max-w-md">
          {receipt ? (
            <>
              <div className="text-center">
                <span className="mx-auto flex size-14 items-center justify-center rounded-full border-[3px] border-ink bg-mint text-paper shadow-hard-sm">
                  <CheckCircle2 className="size-7" strokeWidth={2.8} />
                </span>
                <DialogTitle className="mt-3 justify-center text-center">
                  {receipt.status === "preparing"
                    ? "Pesanan langsung diproses"
                    : "Pesanan masuk antrean"}
                </DialogTitle>
                <DialogDescription className="text-center">
                  {receipt.status === "preparing"
                    ? "Pembayaran sudah tercatat dan produksi dimulai otomatis. Serahkan kode ini kepada pelanggan."
                    : "Pembayaran sudah tercatat. Pesanan menunggu pesanan aktif selesai, lalu diproses otomatis."}
                </DialogDescription>
              </div>

              <div className="mt-4 border-[3px] border-ink bg-butter-soft p-4 text-center shadow-hard-sm">
                <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em]">
                  Kode pesanan
                </p>
                <p className="mt-1 font-mono text-4xl font-bold tracking-tight">
                  {receipt.code}
                </p>
                <div className="mt-2 flex justify-center">
                  <CopyButton value={receipt.code} label="Salin kode" variant="secondary" size="sm" />
                </div>
              </div>

              <div className="mt-3 border-[3px] border-ink p-3">
                <div className="mb-2 flex items-center justify-between gap-2 border-b-2 border-dashed border-ink/25 pb-2">
                  <span className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-muted">
                    Pemesan
                  </span>
                  <span className="truncate text-xs font-bold">{receipt.customerName}</span>
                </div>
                <ul className="space-y-1 text-xs">
                  {receipt.items.map((item) => (
                    <li key={item.name} className="flex justify-between gap-2">
                      <span className="min-w-0 break-words">
                        {item.quantity} × {item.name}
                      </span>
                      <span className="shrink-0 font-mono">{formatIDR(item.subtotal)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex flex-wrap items-end justify-between gap-2 border-t-2 border-ink pt-2">
                  <span className="font-mono text-[10px] font-bold uppercase">Total lunas</span>
                  <span className="font-display text-2xl">{formatIDR(receipt.totalAmount)}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                  <span>{receipt.method === "cash" ? "Tunai" : "QRIS manual"}</span>
                  <span>{formatDateTime(receipt.at, timezone)}</span>
                </div>
                <p className="mt-2 border-t-2 border-dotted border-ink/25 pt-2 font-mono text-[9px] font-bold uppercase tracking-[0.1em]">
                  {receipt.status === "preparing"
                    ? "Status: sedang diproses"
                    : "Status: menunggu antrean"}
                </p>
              </div>

              <DialogFooter className="sm:justify-between">
                <Button type="button" variant="secondary" onClick={() => setReceipt(null)}>
                  Transaksi baru
                </Button>
                <Link
                  href="/cashier/orders"
                  className="inline-flex"
                  onClick={() => setReceipt(null)}
                >
                  <Button type="button" variant="ink">
                    Lihat antrean
                  </Button>
                </Link>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
