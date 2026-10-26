"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Minus,
  Plus,
  Search,
  ShoppingBasket,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/field";
import { createPreorderAction, type PreorderReceipt } from "@/app/preorder/actions";
import { formatIDR } from "@/lib/format";
import { formatSlotLabel, buildPickupDays, type PickupDay } from "@/lib/slots";
import type { ProductView, StoreSettingsView } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  products: ProductView[];
  settings: StoreSettingsView;
  initialDays: PickupDay[];
};

type FieldErrors = {
  cart?: string;
  name?: string;
  email?: string;
  phone?: string;
  slot?: string;
};

export function PreorderForm({ products, settings, initialDays }: Props) {
  const router = useRouter();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [days, setDays] = useState<PickupDay[]>(initialDays);
  const [selectedDayKey, setSelectedDayKey] = useState(initialDays[0]?.dateKey ?? "");
  const [selectedSlot, setSelectedSlot] = useState(initialDays[0]?.slots[0]?.value ?? "");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<PreorderReceipt | null>(null);
  const idempotencyKey = useRef("");
  const summaryRef = useRef<HTMLDivElement>(null);

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
  const selectedDay = days.find((day) => day.dateKey === selectedDayKey);

  function setQuantity(productId: string, quantity: number) {
    setCart((current) => {
      const next = { ...current };
      if (quantity <= 0) delete next[productId];
      else next[productId] = Math.min(quantity, 999);
      return next;
    });
    setErrors((current) => ({ ...current, cart: undefined }));
  }

  function chooseDay(day: PickupDay) {
    setSelectedDayKey(day.dateKey);
    setSelectedSlot(day.slots[0]?.value ?? "");
    setErrors((current) => ({ ...current, slot: undefined }));
  }

  function validate() {
    const nextErrors: FieldErrors = {};

    if (items.length === 0) nextErrors.cart = "Pilih minimal satu roti.";
    if (name.trim().length < 2) {
      nextErrors.name = "Masukkan nama pemesan minimal 2 karakter.";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      nextErrors.email = "Masukkan email yang valid.";
    }
    if (phone.replace(/\D/g, "").length < 8) {
      nextErrors.phone = "Masukkan nomor HP/WhatsApp minimal 8 digit.";
    }
    if (!selectedSlot) nextErrors.slot = "Pilih tanggal dan jam pengambilan.";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!validate()) {
      summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (!idempotencyKey.current) {
      idempotencyKey.current = crypto.randomUUID();
    }

    setSubmitting(true);
    try {
      const result = await createPreorderAction({
        items: items.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
        customerName: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        pickupAt: selectedSlot,
        idempotencyKey: idempotencyKey.current,
        company: honeypot,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      idempotencyKey.current = "";
      setReceipt(result.data);
      window.scrollTo({ top: 0, behavior: "smooth" });
      router.refresh();
    } catch {
      setError("Koneksi terputus. Coba kirim lagi dengan data yang sama.");
    } finally {
      setSubmitting(false);
    }
  }

  if (receipt) {
    return <PreorderSuccess receipt={receipt} timezone={settings.timezone} onReset={() => {
      setReceipt(null);
      setCart({});
      setName("");
      setEmail("");
      setPhone("");
      setErrors({});
      setError(null);
      const next = buildPickupDays(settings, new Date());
      setDays(next);
      setSelectedDayKey(next[0]?.dateKey ?? "");
      setSelectedSlot(next[0]?.slots[0]?.value ?? "");
    }} />;
  }

  return (
    <form onSubmit={submit} className="grid min-w-0 items-start gap-6 lg:grid-cols-[1fr_370px]" noValidate>
      <div className="min-w-0 space-y-6">
        <section className="min-w-0 border-[3px] border-ink bg-paper shadow-hard">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-[3px] border-ink p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center border-[3px] border-ink bg-butter font-display text-sm">
                1
              </span>
              <div>
                <h2 className="text-lg uppercase leading-none">Pilih roti</h2>
                <p className="mt-1 text-[11px] text-muted">
                  {products.length} produk tersedia hari ini
                </p>
              </div>
            </div>
            <div className="relative w-full min-w-0 sm:w-56">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted"
                strokeWidth={3}
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari roti…"
                aria-label="Cari roti"
                className="h-9 pl-8 text-xs"
              />
            </div>
          </div>

          <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
            {filteredProducts.map((product) => {
              const quantity = cart[product.id] ?? 0;
              return (
                <div
                  key={product.id}
                  className={cn(
                    "flex min-w-0 items-start justify-between gap-3 border-[3px] border-ink p-3 shadow-hard-sm transition",
                    quantity > 0 ? "bg-butter-soft" : "bg-paper",
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold leading-tight">{product.name}</p>
                    {product.description ? (
                      <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted">
                        {product.description}
                      </p>
                    ) : null}
                    <p className="mt-2 font-mono text-[11px] font-bold">
                      {formatIDR(product.price)}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {quantity > 0 ? (
                      <button
                        type="button"
                        onClick={() => setQuantity(product.id, quantity - 1)}
                        className="flex size-8 items-center justify-center border-[3px] border-ink bg-paper transition hover:bg-cream active:translate-y-0.5"
                        aria-label={`Kurangi ${product.name}`}
                      >
                        <Minus className="size-3.5" strokeWidth={3} />
                      </button>
                    ) : null}
                    {quantity > 0 ? (
                      <span className="w-7 text-center font-mono text-sm font-bold">{quantity}</span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setQuantity(product.id, quantity + 1)}
                      className="flex size-8 items-center justify-center border-[3px] border-ink bg-butter transition hover:bg-[#ffd35c] active:translate-y-0.5"
                      aria-label={`Tambah ${product.name}`}
                    >
                      <Plus className="size-3.5" strokeWidth={3} />
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredProducts.length === 0 ? (
              <p className="col-span-full py-8 text-center text-sm text-muted">
                Produk tidak ditemukan. Coba kata kunci lain.
              </p>
            ) : null}
          </div>

          {errors.cart ? (
            <p className="border-t-[3px] border-ink bg-[#fdeae6] px-5 py-2 text-xs font-semibold text-danger">
              {errors.cart}
            </p>
          ) : null}
        </section>

        <section className="min-w-0 border-[3px] border-ink bg-paper shadow-hard">
          <div className="flex items-center gap-3 border-b-[3px] border-ink p-4 sm:p-5">
            <span className="flex size-9 items-center justify-center border-[3px] border-ink bg-butter font-display text-sm">
              2
            </span>
            <div>
              <h2 className="text-lg uppercase leading-none">Data & jadwal</h2>
              <p className="mt-1 text-[11px] text-muted">
                Tanpa akun. Kami tidak mengirim email atau WhatsApp otomatis.
              </p>
            </div>
          </div>

          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <Field
              label="Nama pemesan"
              htmlFor="name"
              required
              error={errors.name}
              className="sm:col-span-2"
            >
              <Input
                id="name"
                name="name"
                autoComplete="name"
                placeholder="Contoh: Rina Putri"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setErrors((current) => ({ ...current, name: undefined }));
                }}
                aria-invalid={Boolean(errors.name)}
                maxLength={100}
              />
            </Field>

            <Field label="Email" htmlFor="email" required error={errors.email}>
              <Input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="nama@email.com"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setErrors((current) => ({ ...current, email: undefined }));
                }}
                aria-invalid={Boolean(errors.email)}
              />
            </Field>

            <Field
              label="Nomor HP / WhatsApp"
              htmlFor="phone"
              required
              error={errors.phone}
              hint="Dipakai kasir hanya untuk mencocokkan pesanan."
            >
              <Input
                id="phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="0812 3456 7890"
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value);
                  setErrors((current) => ({ ...current, phone: undefined }));
                }}
                aria-invalid={Boolean(errors.phone)}
              />
            </Field>

            <div className="sr-only" aria-hidden>
              <Label htmlFor="company">Perusahaan</Label>
              <Input
                id="company"
                name="company"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(event) => setHoneypot(event.target.value)}
              />
            </div>

            <div className="min-w-0 sm:col-span-2">
              <div className="mb-2 flex items-end justify-between gap-3">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-soft">
                  Tanggal pengambilan <span className="text-terracotta">*</span>
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                  {settings.storeName}
                </span>
              </div>

              {days.length === 0 ? (
                <div className="flex items-start gap-2 border-[3px] border-ink bg-[#fdeae6] p-3 text-xs">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={3} />
                  <span>
                    Belum ada slot pengambilan yang tersedia. Hubungi toko atau coba lagi nanti.
                  </span>
                </div>
              ) : (
                <>
                  <div className="no-scrollbar flex min-w-0 gap-2 overflow-x-auto pb-1">
                    {days.map((day) => {
                      const active = day.dateKey === selectedDayKey;
                      return (
                        <button
                          key={day.dateKey}
                          type="button"
                          onClick={() => chooseDay(day)}
                          className={cn(
                            "min-w-[86px] shrink-0 border-[3px] border-ink px-2.5 py-2 text-left transition",
                            active
                              ? "bg-ink text-cream shadow-hard-sm"
                              : "bg-paper hover:bg-cream",
                          )}
                          aria-pressed={active}
                        >
                          <span className="block font-mono text-[8px] font-bold uppercase tracking-[0.16em] opacity-70">
                            {day.relativeLabel ?? day.weekday}
                          </span>
                          <span className="mt-0.5 block text-xs font-bold">{day.dateLabel}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                    {(selectedDay?.slots ?? []).map((slot) => {
                      const active = slot.value === selectedSlot;
                      return (
                        <button
                          key={slot.value}
                          type="button"
                          onClick={() => {
                            setSelectedSlot(slot.value);
                            setErrors((current) => ({ ...current, slot: undefined }));
                          }}
                          className={cn(
                            "border-[3px] border-ink py-2 font-mono text-xs font-bold transition",
                            active
                              ? "bg-butter shadow-hard-sm"
                              : "bg-paper hover:bg-cream",
                          )}
                          aria-pressed={active}
                        >
                          {slot.label}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {errors.slot ? (
                <p className="mt-2 text-[11px] font-semibold text-danger">{errors.slot}</p>
              ) : null}
            </div>
          </div>
        </section>

        <div className="flex items-start gap-3 border-[3px] border-ink bg-terracotta p-4 text-paper shadow-hard-sm">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" strokeWidth={2.6} />
          <p className="text-xs leading-relaxed sm:text-sm">
            <span className="font-bold">Bayar di toko saat pengambilan.</span> Pesanan baru berlaku
            setelah dikonfirmasi kasir. Tidak ada pembayaran online di aplikasi ini.
          </p>
        </div>
      </div>

      <aside ref={summaryRef} className="min-w-0 lg:sticky lg:top-24">
        <div className="min-w-0 border-[3px] border-ink bg-paper shadow-hard">
          <div className="flex items-center justify-between border-b-[3px] border-ink bg-ink p-4 text-cream">
            <h2 className="text-lg uppercase">Ringkasan</h2>
            <span className="inline-flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-butter">
              <ShoppingBasket className="size-3.5" strokeWidth={3} />
              {itemCount} item
            </span>
          </div>

          <div className="p-4">
            {items.length === 0 ? (
              <div className="border-[3px] border-dashed border-ink/30 px-4 py-8 text-center">
                <p className="text-sm font-bold">Keranjang kosong</p>
                <p className="mt-1 text-[11px] text-muted">
                  Tambahkan roti dari daftar di sebelah kiri.
                </p>
              </div>
            ) : (
              <ul className="divide-y-2 divide-dotted divide-ink/25">
                {items.map((item) => (
                  <li key={item.product.id} className="flex items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-xs font-bold leading-tight">{item.product.name}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-muted">
                        {item.quantity} × {formatIDR(item.product.price)}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-[11px] font-bold">
                      {formatIDR(item.product.price * item.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 flex items-end justify-between border-t-[3px] border-ink pt-3">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em]">
                Total
              </span>
              <span className="font-display text-2xl">{formatIDR(total)}</span>
            </div>

            <div className="mt-2 border-2 border-ink bg-cream px-2.5 py-2 font-mono text-[9px] font-semibold uppercase leading-relaxed tracking-[0.08em]">
              {selectedSlot ? (
                <>
                  Ambil: {formatSlotLabel(selectedSlot, settings.timezone)}
                  <br />
                  Status: menunggu konfirmasi kasir
                </>
              ) : (
                "Belum memilih jadwal pengambilan"
              )}
            </div>

            {error ? (
              <div
                role="alert"
                className="mt-3 border-[3px] border-ink bg-[#fdeae6] p-3 text-xs font-semibold leading-relaxed text-danger"
              >
                {error}
              </div>
            ) : null}

            <Button
              type="submit"
              size="lg"
              className="mt-4 w-full"
              loading={submitting}
              disabled={submitting}
            >
              {submitting ? "Mengirim…" : "Kirim pre-order"}
              {!submitting ? <ArrowRight className="size-4" strokeWidth={3} /> : null}
            </Button>

            <p className="mt-3 text-center text-[10px] leading-relaxed text-muted">
              Dengan mengirim, kamu setuju pesanan diperiksa manual oleh kasir dan dibayar saat
              pengambilan.
            </p>
          </div>
        </div>

        <div className="mt-4 border-[3px] border-ink bg-butter-soft p-3 shadow-hard-sm">
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em]">
            Kenapa tanpa pembayaran online?
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
            Toko memverifikasi stok dan jadwal secara manual. Pembayaran hanya dicatat kasir di
            toko, sehingga tidak ada uang yang tertahan di aplikasi.
          </p>
        </div>
      </aside>
    </form>
  );
}

function PreorderSuccess({
  receipt,
  timezone,
  onReset,
}: {
  receipt: PreorderReceipt;
  timezone: string;
  onReset: () => void;
}) {
  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} disalin.`);
    } catch {
      toast.error("Gagal menyalin. Salin secara manual dari kolom di bawah.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="border-[3px] border-ink bg-paper shadow-hard-lg">
        <div className="flex flex-col items-center border-b-[3px] border-ink bg-mint-soft px-6 py-8 text-center">
          <span className="flex size-16 items-center justify-center rounded-full border-[3px] border-ink bg-mint text-paper shadow-hard-sm">
            <CheckCircle2 className="size-8" strokeWidth={2.6} />
          </span>
          <h1 className="mt-4 text-3xl uppercase">Pre-order diterima!</h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
            Pesananmu berstatus <strong>menunggu konfirmasi kasir</strong>. Simpan{" "}
            <strong>kode lacak 5 karakter</strong> di bawah untuk memantau pesanan tanpa akun.
          </p>
        </div>

        <div className="p-5 sm:p-6">
          <div
            className="border-[3px] border-ink bg-ink p-4 text-center text-cream shadow-hard-sm"
            data-tracking-code={receipt.trackingCode}
          >
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.24em] text-butter">
              Kode lacak pesanan
            </p>
            <p className="mt-2 font-mono text-5xl font-bold tracking-[0.2em] text-butter">
              {receipt.trackingCode}
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => copy(receipt.trackingCode, "Kode lacak")}
                className="inline-flex items-center gap-1.5 border-2 border-cream bg-cream px-2.5 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-ink transition hover:bg-butter"
              >
                <Copy className="size-3" strokeWidth={3} />
                Salin kode
              </button>
              <Link href={`/track/${receipt.trackingCode}`} className="inline-flex">
                <span className="inline-flex items-center gap-1.5 border-2 border-cream bg-ink px-2.5 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-cream transition hover:bg-ink-soft">
                  Buka status
                </span>
              </Link>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-cream/70">
              Masukkan kode ini di halaman Lacak. Jangan bagikan kode kepada orang lain.
            </p>
          </div>

          <div className="mt-4 border-[3px] border-ink bg-butter-soft p-4 text-center shadow-hard-sm">
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.24em] text-ink-soft">
              Kode pesanan
            </p>
            <p className="mt-1 font-mono text-2xl font-bold tracking-tight">{receipt.code}</p>
            <button
              type="button"
              onClick={() => copy(receipt.code, "Kode pesanan")}
              className="mt-2 inline-flex items-center gap-1.5 border-2 border-ink bg-paper px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.14em] transition hover:bg-cream"
            >
              <Copy className="size-3" strokeWidth={3} />
              Salin kode pesanan
            </button>
          </div>

          <dl className="mt-4 grid gap-3 border-[3px] border-ink bg-paper p-4 text-xs sm:grid-cols-2">
            <div>
              <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
                Jadwal pengambilan
              </dt>
              <dd className="mt-1 font-semibold">
                {formatSlotLabel(receipt.pickupAt, timezone)}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
                Total dibayar di toko
              </dt>
              <dd className="mt-1 font-semibold">{formatIDR(receipt.totalAmount)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
                Status pembayaran
              </dt>
              <dd className="mt-1 font-semibold text-terracotta">
                Belum dibayar — bayar saat pengambilan
              </dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="button" onClick={onReset} variant="primary">
              <ArrowLeft className="size-4" strokeWidth={3} />
              Pesan lagi
            </Button>
            <Link href={`/track/${receipt.trackingCode}`} className="inline-flex">
              <Button type="button" variant="secondary">
                Lihat status pesanan
              </Button>
            </Link>
            <Link href="/lacak" className="inline-flex">
              <Button type="button" variant="secondary">
                Halaman lacak
              </Button>
            </Link>
          </div>

          <div className="mt-5 flex items-start gap-2 border-2 border-ink bg-cream px-3 py-2 text-[11px] leading-relaxed">
            <Check className="mt-0.5 size-3.5 shrink-0 text-mint" strokeWidth={4} />
            <span>
              Kasir akan mengonfirmasi pesananmu. Setelah dikonfirmasi, pesanan masuk antrean
              produksi saat mendekati jadwal pengambilan.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
