"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ImageOff,
  Minus,
  Package,
  Pencil,
  Plus,
  Search,
  ToggleLeft,
  ToggleRight,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  adjustProductStockAction,
  createProductAction,
  toggleProductAvailabilityAction,
  updateProductAction,
} from "./actions";
import { formatIDR } from "@/lib/format";
import type { ProductView } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ProductsManager({ products }: { products: ProductView[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProductView | null>(null);
  const [pending, setPending] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return products;
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(term) ||
        (product.description ?? "").toLowerCase().includes(term),
    );
  }, [products, query]);

  function openCreate() {
    setEditing(null);
    setError(null);
    setOpen(true);
  }

  function openEdit(product: ProductView) {
    setEditing(product);
    setError(null);
    setOpen(true);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const formData = new FormData(event.currentTarget);
    if (editing) formData.set("id", editing.id);

    const result = editing
      ? await updateProductAction(null, formData)
      : await createProductAction(null, formData);

    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setOpen(false);
    toast.success(editing ? "Produk diperbarui." : "Produk ditambahkan.");
    router.refresh();
  }

  async function toggle(product: ProductView) {
    setTogglingId(product.id);
    const result = await toggleProductAvailabilityAction(product.id, !product.isAvailable);
    setTogglingId(null);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(
      result.data.isAvailable
        ? `${product.name} ditandai tersedia.`
        : `${product.name} ditandai tidak tersedia.`,
    );
    router.refresh();
  }

  async function handleAdjustStock(product: ProductView, delta: number) {
    if (adjustingId) return;
    setAdjustingId(product.id);
    const result = await adjustProductStockAction(product.id, delta);
    setAdjustingId(null);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(
      `Stok ${product.name}: ${result.data.stock} item ${
        result.data.stock <= 0 ? "(Stok habis)" : ""
      }`,
    );
    router.refresh();
  }

  const available = products.filter((product) => product.isAvailable && product.stock > 0).length;
  const outOfStock = products.filter((product) => product.stock <= 0).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="mint">{available} siap jual</Badge>
          {outOfStock > 0 ? (
            <Badge tone="terracotta">{outOfStock} stok habis</Badge>
          ) : null}
          <Badge tone="outline">{products.length} total produk</Badge>
        </div>

        <Button type="button" size="sm" onClick={openCreate}>
          <Plus className="size-3.5" strokeWidth={3.5} />
          Tambah produk
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
          strokeWidth={3}
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari nama atau deskripsi…"
          aria-label="Cari produk"
          className="h-10 pl-9 text-xs"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="border-[3px] border-dashed border-ink/35 bg-paper/60 px-4 py-14 text-center">
          <Package className="mx-auto size-8 text-muted" strokeWidth={2.4} />
          <p className="mt-3 text-sm font-bold">Produk tidak ditemukan</p>
          <p className="mt-1 text-xs text-muted">
            Ubah kata kunci pencarian atau tambahkan produk baru.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((product) => {
            const expanded = expandedId === product.id;
            const margin =
              product.costPrice == null ? null : product.price - product.costPrice;
            const marginPercent =
              margin != null && product.price > 0
                ? Math.round((margin / product.price) * 100)
                : null;

            return (
              <article
                key={product.id}
                className="min-w-0 border-[3px] border-ink bg-paper shadow-hard-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : product.id)}
                    aria-expanded={expanded}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left transition hover:opacity-80"
                  >
                    <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden border-2 border-ink bg-butter-soft">
                      {product.imageUrl ? (
                        <Image
                          src={product.imageUrl}
                          alt={product.name}
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      ) : (
                        <ImageOff className="size-4 text-muted" strokeWidth={2.4} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold leading-tight">{product.name}</p>
                      <p className="mt-0.5 truncate font-mono text-[9px] uppercase tracking-[0.08em] text-muted">
                        {product.isAvailable ? "Aktif" : "Nonaktif"}
                        <span className="text-muted/50"> · </span>
                        {product.costPrice == null
                          ? "Modal belum diisi"
                          : `Modal ${formatIDR(product.costPrice)}`}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="font-mono text-xs font-bold">{formatIDR(product.price)}</p>
                      {margin != null ? (
                        <p
                          className={cn(
                            "mt-0.5 font-mono text-[9px] font-semibold",
                            margin >= 0 ? "text-mint" : "text-danger",
                          )}
                        >
                          Untung {formatIDR(margin)}
                          {marginPercent != null ? ` · ${marginPercent}%` : ""}
                        </p>
                      ) : (
                        <p className="mt-0.5 font-mono text-[9px] text-muted/70">—</p>
                      )}
                    </div>
                  </button>

                  {/* Quick Action Stock Controls */}
                  <div
                    className="flex items-center gap-1.5 border-l-2 border-dashed border-ink/25 pl-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => handleAdjustStock(product, -1)}
                      disabled={adjustingId === product.id || product.stock <= 0}
                      className="flex size-7 items-center justify-center border-2 border-ink bg-paper font-bold transition hover:bg-cream disabled:opacity-30"
                      title="Kurangi stok (-1)"
                      aria-label={`Kurangi stok ${product.name}`}
                    >
                      <Minus className="size-3" strokeWidth={3.5} />
                    </button>
                    <div
                      className={cn(
                        "flex min-w-10 flex-col items-center justify-center border-2 border-ink px-1.5 py-0.5 text-center font-mono",
                        product.stock <= 0
                          ? "bg-[#fdeae6] text-danger"
                          : product.stock < 5
                            ? "bg-butter text-ink"
                            : "bg-paper text-ink",
                      )}
                    >
                      <span className="text-xs font-bold leading-tight">{product.stock}</span>
                      <span className="text-[7px] uppercase tracking-wider text-muted">
                        {product.stock <= 0 ? "Habis" : "Stok"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAdjustStock(product, 1)}
                      disabled={adjustingId === product.id}
                      className="flex size-7 items-center justify-center border-2 border-ink bg-butter font-bold transition hover:bg-[#ffd35c] disabled:opacity-30"
                      title="Tambah stok (+1)"
                      aria-label={`Tambah stok ${product.name}`}
                    >
                      <Plus className="size-3" strokeWidth={3.5} />
                    </button>

                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : product.id)}
                      className="ml-1 p-1 text-muted hover:text-ink"
                      aria-label="Buka detail produk"
                    >
                      <ChevronDown
                        className={cn(
                          "size-4 shrink-0 transition-transform",
                          expanded && "rotate-180",
                        )}
                        strokeWidth={3}
                      />
                    </button>
                  </div>
                </div>

                {expanded ? (
                  <div className="border-t-2 border-dashed border-ink/25 px-3 py-3">
                    <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
                      <div className="relative hidden aspect-square items-center justify-center overflow-hidden border-2 border-ink bg-butter-soft sm:flex">
                        {product.imageUrl ? (
                          <Image
                            src={product.imageUrl}
                            alt={product.name}
                            fill
                            sizes="120px"
                            className="object-cover"
                          />
                        ) : (
                          <ImageOff className="size-6 text-muted" strokeWidth={2.4} />
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs leading-relaxed text-ink-soft">
                          {product.description ?? "Tanpa deskripsi."}
                        </p>

                        <dl className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                          {[
                            {
                              label: "Stok tersedia",
                              value: `${product.stock} item`,
                              tone:
                                product.stock <= 0
                                  ? "text-danger"
                                  : product.stock < 5
                                    ? "text-amber-700"
                                    : "text-mint",
                            },
                            { label: "Harga jual", value: formatIDR(product.price) },
                            {
                              label: "Harga modal",
                              value:
                                product.costPrice == null
                                  ? "Belum diisi"
                                  : formatIDR(product.costPrice),
                            },
                            {
                              label: "Untung / item",
                              value: margin == null ? "—" : formatIDR(margin),
                            },
                            {
                              label: "Margin",
                              value: marginPercent == null ? "—" : `${marginPercent}%`,
                            },
                          ].map((item) => (
                            <div
                              key={item.label}
                              className="border-2 border-ink/15 bg-cream/40 px-2 py-1.5"
                            >
                              <dt className="font-mono text-[8px] uppercase tracking-[0.08em] text-muted">
                                {item.label}
                              </dt>
                              <dd
                                className={cn(
                                  "mt-0.5 truncate font-mono text-[10px] font-bold",
                                  item.tone,
                                )}
                              >
                                {item.value}
                              </dd>
                            </div>
                          ))}
                        </dl>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {/* Quick bulk stock actions */}
                          <div className="flex items-center gap-1 border-2 border-ink bg-paper p-1">
                            <span className="px-1 font-mono text-[8px] font-bold uppercase text-muted">
                              Tambah stok:
                            </span>
                            {[
                              { label: "+5", delta: 5 },
                              { label: "+10", delta: 10 },
                              { label: "+20", delta: 20 },
                            ].map((btn) => (
                              <button
                                key={btn.label}
                                type="button"
                                onClick={() => handleAdjustStock(product, btn.delta)}
                                disabled={adjustingId === product.id}
                                className="border border-ink bg-butter-soft px-1.5 py-0.5 font-mono text-[9px] font-bold transition hover:bg-butter disabled:opacity-40"
                              >
                                {btn.label}
                              </button>
                            ))}
                          </div>

                          <Badge
                            tone={
                              product.stock <= 0
                                ? "terracotta"
                                : product.isAvailable
                                  ? "mint"
                                  : "muted"
                            }
                          >
                            {product.stock <= 0
                              ? "Stok Habis"
                              : product.isAvailable
                                ? "Tersedia"
                                : "Nonaktif"}
                          </Badge>
                          <button
                            type="button"
                            onClick={() => toggle(product)}
                            disabled={togglingId === product.id}
                            className={cn(
                              "inline-flex items-center gap-1.5 border-2 border-ink px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.08em] transition hover:bg-cream disabled:opacity-50",
                              product.isAvailable ? "bg-paper" : "bg-butter-soft",
                            )}
                          >
                            {product.isAvailable ? (
                              <ToggleRight className="size-3.5" strokeWidth={3} />
                            ) : (
                              <ToggleLeft className="size-3.5" strokeWidth={3} />
                            )}
                            {togglingId === product.id
                              ? "Menyimpan…"
                              : product.isAvailable
                                ? "Matikan"
                                : "Aktifkan"}
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(product)}
                            className="inline-flex items-center gap-1.5 border-2 border-ink bg-paper px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.08em] transition hover:bg-butter"
                          >
                            <Pencil className="size-3" strokeWidth={3} />
                            Edit
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-terracotta">
              {editing ? "Ubah produk" : "Produk baru"}
            </p>
            <DialogTitle>{editing ? editing.name : "Tambah produk"}</DialogTitle>
            <DialogDescription>
              Kelola informasi harga jual, modal, stok fisik, dan ketersediaan barang.
            </DialogDescription>
          </DialogHeader>

          <form key={editing?.id ?? "new"} onSubmit={submit} className="space-y-4">
            <Field label="Nama produk" htmlFor="name" required>
              <Input
                id="name"
                name="name"
                defaultValue={editing?.name ?? ""}
                placeholder="Contoh: Roti Sourdough"
                maxLength={100}
                required
              />
            </Field>

            <Field
              label="Deskripsi"
              htmlFor="description"
              hint="Opsional, tampil di halaman pre-order."
            >
              <Textarea
                id="description"
                name="description"
                defaultValue={editing?.description ?? ""}
                placeholder="Roti gandum dengan fermentasi alami…"
                maxLength={500}
                rows={3}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Harga jual (Rp)" htmlFor="price" required>
                <Input
                  id="price"
                  name="price"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={500}
                  defaultValue={editing?.price ?? ""}
                  placeholder="25000"
                  required
                />
              </Field>

              <Field
                label="Harga modal (Rp)"
                htmlFor="costPrice"
                hint="Opsional"
              >
                <Input
                  id="costPrice"
                  name="costPrice"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={500}
                  defaultValue={editing?.costPrice ?? ""}
                  placeholder="15000"
                />
              </Field>

              <Field
                label="Jumlah Stok"
                htmlFor="stock"
                required
                hint="Stok fisik"
              >
                <Input
                  id="stock"
                  name="stock"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  defaultValue={editing?.stock ?? 20}
                  required
                />
              </Field>
            </div>

            <Checkbox
              name="isAvailable"
              label="Tersedia untuk dijual"
              defaultChecked={editing ? editing.isAvailable : true}
            />

            <Field
              label="URL foto"
              htmlFor="imageUrl"
              hint="Opsional. Gunakan URL https:// yang dapat diakses publik."
            >
              <Input
                id="imageUrl"
                name="imageUrl"
                type="url"
                defaultValue={editing?.imageUrl ?? ""}
                placeholder="https://…"
              />
            </Field>

            {error ? (
              <div
                role="alert"
                className="flex items-start gap-2 border-[3px] border-ink bg-[#fdeae6] px-3 py-2 text-xs font-semibold leading-relaxed text-danger"
              >
                <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={2.8} />
                {error}
              </div>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Batal
              </Button>
              <Button type="submit" loading={pending}>
                {editing ? "Simpan perubahan" : "Tambah produk"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
