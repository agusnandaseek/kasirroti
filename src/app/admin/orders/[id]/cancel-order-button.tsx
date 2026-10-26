"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { cancelOrderAction } from "@/app/cashier/orders/actions";
import { formatIDR } from "@/lib/format";

export function CancelOrderButton({
  orderId,
  code,
  paid,
  totalAmount,
}: {
  orderId: string;
  code: string;
  paid: boolean;
  totalAmount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setPending(true);
    const result = await cancelOrderAction(orderId, reason);
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setOpen(false);
    toast.success(`${code} dibatalkan.`);
    router.refresh();
  }

  return (
    <>
      <Button
        type="button"
        variant="danger"
        size="sm"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <Ban className="size-3.5" strokeWidth={3} />
        Batalkan
      </Button>

      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-terracotta">
              {code}
            </p>
            <DialogTitle>Batalkan pesanan?</DialogTitle>
            <DialogDescription>
              Pelanggan akan melihat status dibatalkan beserta alasannya pada halaman tracking.
              Tindakan ini tidak bisa diurungkan.
            </DialogDescription>
          </DialogHeader>

          {paid ? (
            <div className="flex items-start gap-2 border-[3px] border-ink bg-[#fdeae6] p-3 text-[11px] leading-relaxed text-danger">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={2.8} />
              <span>
                Pesanan ini sudah lunas sebesar <strong>{formatIDR(totalAmount)}</strong>.
                Pembatalan tidak menghapus catatan pembayaran dan tidak memproses refund otomatis.
                Lakukan pengembalian dana secara manual di luar sistem.
              </span>
            </div>
          ) : null}

          <div className="mt-3">
            <Field
              label="Alasan pembatalan"
              htmlFor="cancel-reason"
              required
              error={error ?? undefined}
              hint="Contoh: stok habis atau pelanggan tidak dapat dihubungi."
            >
              <Textarea
                id="cancel-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                maxLength={300}
                aria-invalid={Boolean(error)}
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
              Kembali
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={submit}
              loading={pending}
              disabled={reason.trim().length < 3}
            >
              Ya, batalkan pesanan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
