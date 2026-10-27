"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { deleteOrderAction } from "@/app/cashier/orders/actions";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, Select, Textarea } from "@/components/ui/field";
import { DELETE_REASON_OPTIONS } from "@/lib/order-deletion";
import { formatIDR } from "@/lib/format";
import type { OrderType } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DeleteOrderButton({
  orderId,
  code,
  orderType,
  totalAmount,
  redirectTo,
  size = "sm",
  variant = "danger",
  label = "Hapus transaksi",
  className,
  fullWidth = false,
}: {
  orderId: string;
  code: string;
  orderType: OrderType;
  totalAmount: number;
  redirectTo?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
  label?: string;
  className?: string;
  fullWidth?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reasonCode, setReasonCode] = useState("");
  const [reasonNote, setReasonNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isWalkIn = orderType === "walk_in";

  function reset() {
    setReasonCode("");
    setReasonNote("");
    setError(null);
  }

  async function submit() {
    if (!reasonCode) {
      setError("Pilih alasan penghapusan terlebih dahulu.");
      return;
    }

    setError(null);
    setPending(true);
    const result = await deleteOrderAction(orderId, reasonCode, reasonNote);
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setOpen(false);
    reset();

    const stockMessage =
      result.data.stockRestored && result.data.unitsRestored > 0
        ? ` Stok ${result.data.unitsRestored} item dikembalikan.`
        : "";
    toast.success(`${result.data.orderCode} dihapus permanen.${stockMessage}`);

    if (redirectTo) {
      router.replace(redirectTo);
    }
    router.refresh();
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={cn(fullWidth && "w-full", className)}
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <Trash2 className="size-3.5" strokeWidth={3} />
        {label}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (pending) return;
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-terracotta">
              {code} · {isWalkIn ? "Walk-in" : "Pre-order"}
            </p>
            <DialogTitle>Hapus transaksi?</DialogTitle>
            <DialogDescription>
              Transaksi <strong>{formatIDR(totalAmount)}</strong> akan dihapus permanen dari
              riwayat penjualan, laporan, dan antrean. Tindakan ini tidak bisa diurungkan.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-start gap-2 border-[3px] border-ink bg-[#fdeae6] p-3 text-[11px] leading-relaxed text-danger">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={2.8} />
            <span>
              {isWalkIn
                ? "Stok produk pada transaksi ini akan dikembalikan otomatis sesuai jumlah item yang terjual."
                : "Pre-order tidak memotong stok, jadi tidak ada stok yang dikembalikan."}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            <Field label="Alasan penghapusan" htmlFor="delete-reason" required>
              <Select
                id="delete-reason"
                value={reasonCode}
                onChange={(event) => {
                  setReasonCode(event.target.value);
                  setError(null);
                }}
                disabled={pending}
              >
                <option value="">Pilih alasan…</option>
                {DELETE_REASON_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label={reasonCode === "other" ? "Catatan alasan" : "Catatan tambahan (opsional)"}
              htmlFor="delete-note"
              required={reasonCode === "other"}
              hint={
                reasonCode === "other"
                  ? "Jelaskan alasan penghapusan minimal 5 karakter."
                  : "Boleh dikosongkan. Catatan ini tersimpan di log penghapusan."
              }
              error={error ?? undefined}
            >
              <Textarea
                id="delete-note"
                value={reasonNote}
                onChange={(event) => {
                  setReasonNote(event.target.value);
                  setError(null);
                }}
                maxLength={500}
                placeholder="Contoh: salah pilih produk saat input di kasir."
                disabled={pending}
              />
            </Field>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={submit}
              loading={pending}
              disabled={!reasonCode}
            >
              <Trash2 className="size-4" strokeWidth={3} />
              Hapus permanen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
