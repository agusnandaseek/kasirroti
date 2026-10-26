"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  Check,
  Clock3,
  PackageCheck,
  Play,
  QrCode,
  TriangleAlert,
  X,
  Zap,
} from "lucide-react";
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
import {
  clearQueuePriorityAction,
  completeOrderAction,
  markReadyAction,
  prioritizeOrderAction,
  recordPaymentAction,
} from "@/app/cashier/orders/actions";
import { formatIDR } from "@/lib/format";
import type { OrderView } from "@/lib/types";
import { cn } from "@/lib/utils";

export function OrderActions({
  order,
  qrisEnabled,
  queueIndex,
  activeCode,
}: {
  order: OrderView;
  qrisEnabled: boolean;
  queueIndex?: number;
  activeCode?: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [method, setMethod] = useState<"cash" | "manual_qris">("cash");
  const [error, setError] = useState<string | null>(null);

  async function run(key: string, action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setPending(key);
    const result = await action();
    setPending(null);

    if (!result.ok) {
      toast.error(result.error ?? "Tindakan gagal.");
      return;
    }

    toast.success(success);
    router.refresh();
  }

  async function prioritize() {
    setPending("priority");
    const result = await prioritizeOrderAction(order.id);
    setPending(null);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    if (result.data.status === "preparing") {
      toast.success(`${order.code} langsung mulai diproses.`);
    } else if (result.data.alreadyExists) {
      toast.info(`${order.code} sudah menjadi prioritas berikutnya.`);
    } else {
      toast.success(
        result.data.activeCode
          ? `${order.code} diprioritaskan. Akan diproses setelah ${result.data.activeCode} selesai.`
          : `${order.code} diprioritaskan di antrean.`,
      );
    }
    router.refresh();
  }

  async function clearPriority() {
    setPending("clear-priority");
    const result = await clearQueuePriorityAction(order.id);
    setPending(null);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(`${order.code} kembali ke urutan FIFO.`);
    router.refresh();
  }

  async function complete() {
    setPending("complete");
    const result = await completeOrderAction(order.id);
    setPending(null);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(
      result.data.promotedCode
        ? `${order.code} selesai. ${result.data.promotedCode} otomatis mulai diproses.`
        : `${order.code} selesai.`,
    );
    router.refresh();
  }

  async function submitPayment() {
    setPending("pay");
    setError(null);
    const result = await recordPaymentAction(order.id, method);
    setPending(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setPayOpen(false);
    toast.success(`Pembayaran ${formatIDR(order.totalAmount)} tercatat.`);
    router.refresh();
  }

  return (
    <>
      <div className="flex w-full flex-wrap items-center gap-2">
        {order.status === "queued" && order.queuePriority ? (
          <div className="flex w-full flex-wrap items-center gap-1.5">
            <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 border-2 border-ink bg-butter px-2 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-ink">
              <Zap className="size-3 shrink-0" strokeWidth={3} />
              Prioritas berikutnya
              {activeCode ? <span className="truncate text-ink-soft">· setelah {activeCode}</span> : null}
            </span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              aria-label={`Batalkan prioritas ${order.code}`}
              loading={pending === "clear-priority"}
              onClick={clearPriority}
            >
              <X className="size-3.5" strokeWidth={3} />
              Batalkan
            </Button>
          </div>
        ) : order.status === "queued" ? (
          <div className="flex w-full flex-wrap items-center gap-1.5">
            <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 border-2 border-ink bg-cream px-2 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-ink-soft">
              <Clock3 className="size-3 shrink-0" strokeWidth={3} />
              {queueIndex === 1 ? "Berikutnya · antrean #1" : `Antrean #${queueIndex ?? "—"}`}
            </span>
            <Button
              type="button"
              size="sm"
              variant="ink"
              aria-label={`Proses ${order.code} sekarang`}
              loading={pending === "priority"}
              onClick={prioritize}
            >
              <Play className="size-3.5" strokeWidth={3} />
              Proses
            </Button>
          </div>
        ) : null}

        {order.status === "preparing" ? (
          <Button
            type="button"
            size="sm"
            className="w-full sm:w-auto"
            loading={pending === "ready"}
            onClick={() =>
              run("ready", () => markReadyAction(order.id), `${order.code} siap diambil.`)
            }
          >
            <PackageCheck className="size-3.5" strokeWidth={3} />
            Siap diambil
          </Button>
        ) : null}

        {order.status === "ready" ? (
          order.paymentStatus === "paid" ? (
            <Button
              type="button"
              variant="success"
              size="sm"
              className="w-full sm:w-auto"
              loading={pending === "complete"}
              onClick={complete}
            >
              <Check className="size-3.5" strokeWidth={3.5} />
              Selesaikan
            </Button>
          ) : (
            <Button
              type="button"
              variant="ink"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => setPayOpen(true)}
            >
              <Banknote className="size-3.5" strokeWidth={3} />
              Terima pembayaran
            </Button>
          )
        ) : null}

        {order.status === "ready" && order.paymentStatus === "unpaid" ? (
          <span className="inline-flex w-full items-center gap-1.5 border-2 border-ink bg-[#fdeae6] px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-danger">
            <TriangleAlert className="size-3" strokeWidth={3} />
            Selesaikan butuh lunas
          </span>
        ) : null}
      </div>

      <Dialog open={payOpen} onOpenChange={(open) => !pending && setPayOpen(open)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-terracotta">
              {order.code} · {order.type === "pre_order" ? "Pre-order" : "Walk-in"}
            </p>
            <DialogTitle>Terima pembayaran</DialogTitle>
            <DialogDescription>
              Catat pembayaran manual sebesar <strong>{formatIDR(order.totalAmount)}</strong>.
              Pastikan uang atau notifikasi QRIS sudah diterima sebelum menyimpan.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMethod("cash")}
              aria-pressed={method === "cash"}
              className={cn(
                "flex flex-col items-center gap-1.5 border-[3px] border-ink px-3 py-3 transition",
                method === "cash" ? "bg-butter shadow-hard-sm" : "bg-paper hover:bg-cream",
              )}
            >
              <Banknote className="size-5" strokeWidth={2.6} />
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em]">Tunai</span>
            </button>
            <button
              type="button"
              onClick={() => qrisEnabled && setMethod("manual_qris")}
              disabled={!qrisEnabled}
              aria-pressed={method === "manual_qris"}
              className={cn(
                "flex flex-col items-center gap-1.5 border-[3px] border-ink px-3 py-3 transition",
                method === "manual_qris" ? "bg-butter shadow-hard-sm" : "bg-paper hover:bg-cream",
                !qrisEnabled && "cursor-not-allowed opacity-40",
              )}
            >
              <QrCode className="size-5" strokeWidth={2.6} />
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em]">
                QRIS manual
              </span>
            </button>
          </div>

          {!qrisEnabled ? (
            <p className="mt-2 text-[10px] leading-relaxed text-muted">
              QRIS manual dinonaktifkan di pengaturan toko.
            </p>
          ) : null}

          <div className="mt-3 flex items-end justify-between border-[3px] border-ink bg-cream px-3 py-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em]">Total</span>
            <span className="font-display text-2xl">{formatIDR(order.totalAmount)}</span>
          </div>

          {error ? (
            <div
              role="alert"
              className="mt-3 border-[3px] border-ink bg-[#fdeae6] px-3 py-2 text-xs font-semibold text-danger"
            >
              {error}
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setPayOpen(false)} disabled={Boolean(pending)}>
              Batal
            </Button>
            <Button
              type="button"
              variant="success"
              onClick={submitPayment}
              loading={pending === "pay"}
            >
              <Check className="size-4" strokeWidth={3.5} />
              Simpan pembayaran
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
