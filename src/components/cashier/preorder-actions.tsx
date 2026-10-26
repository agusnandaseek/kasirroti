"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ListPlus, X } from "lucide-react";
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
import {
  confirmPreorderAction,
  enqueuePreorderAction,
  rejectPreorderAction,
} from "@/app/cashier/preorders/actions";
import type { OrderStatus } from "@/lib/types";

export function PreorderActions({
  orderId,
  status,
  trackingCode,
}: {
  orderId: string;
  status: OrderStatus;
  trackingCode: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setPending("confirm");
    const result = await confirmPreorderAction(orderId);
    setPending(null);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(`${trackingCode} dikonfirmasi.`);
    router.refresh();
  }

  async function enqueue() {
    setPending("enqueue");
    const result = await enqueuePreorderAction(orderId);
    setPending(null);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(
      result.data.status === "preparing"
        ? `${trackingCode} langsung mulai diproses.`
        : `${trackingCode} masuk antrean produksi.`,
    );
    router.refresh();
  }

  async function submitReject() {
    setError(null);
    setPending("reject");
    const result = await rejectPreorderAction(orderId, reason);
    setPending(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setRejectOpen(false);
    setReason("");
    toast.success(`${trackingCode} ditolak.`);
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {status === "pending_confirmation" ? (
          <>
            <Button type="button" size="sm" loading={pending === "confirm"} onClick={confirm}>
              <Check className="size-3.5" strokeWidth={3.5} />
              Konfirmasi
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setError(null);
                setRejectOpen(true);
              }}
            >
              <X className="size-3.5" strokeWidth={3.5} />
              Tolak
            </Button>
          </>
        ) : null}

        {status === "confirmed" ? (
          <Button type="button" variant="ink" size="sm" loading={pending === "enqueue"} onClick={enqueue}>
            <ListPlus className="size-3.5" strokeWidth={3} />
            Masukkan ke antrean
          </Button>
        ) : null}
      </div>

      <Dialog open={rejectOpen} onOpenChange={(open) => !pending && setRejectOpen(open)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-terracotta">
              {trackingCode}
            </p>
            <DialogTitle>Tolak pre-order?</DialogTitle>
            <DialogDescription>
              Pelanggan akan melihat status ditolak pada halaman tracking. Tulis alasan singkat
              yang bisa dipahami pelanggan.
            </DialogDescription>
          </DialogHeader>

          <Field
            label="Alasan penolakan"
            htmlFor="reject-reason"
            required
            error={error ?? undefined}
            hint="Contoh: stok tidak tersedia pada jadwal tersebut."
          >
            <Textarea
              id="reject-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              maxLength={300}
              aria-invalid={Boolean(error)}
            />
          </Field>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRejectOpen(false)}
              disabled={Boolean(pending)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={submitReject}
              loading={pending === "reject"}
              disabled={reason.trim().length < 3}
            >
              Tolak pesanan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
