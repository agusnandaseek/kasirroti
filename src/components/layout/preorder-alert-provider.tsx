"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Bell, ArrowRight, Clock3 } from "lucide-react";

type AlertOrder = {
  id: string;
  code: string;
  name: string;
  createdAt?: string;
  pickupAt?: string;
};

type AlertData = {
  pendingCount: number;
  dueSoonCount: number;
  totalAlerts: number;
  pendingOrders: AlertOrder[];
  dueSoonOrders: AlertOrder[];
};

type PreorderAlertContextType = {
  pendingCount: number;
  dueSoonCount: number;
  totalAlerts: number;
  refresh: () => Promise<void>;
};

const PreorderAlertContext = createContext<PreorderAlertContextType>({
  pendingCount: 0,
  dueSoonCount: 0,
  totalAlerts: 0,
  refresh: async () => {},
});

export function usePreorderAlerts() {
  return useContext(PreorderAlertContext);
}

export function PreorderAlertProvider({
  children,
  role = "cashier",
}: {
  children: ReactNode;
  role?: "cashier" | "admin";
}) {
  const [data, setData] = useState<AlertData>({
    pendingCount: 0,
    dueSoonCount: 0,
    totalAlerts: 0,
    pendingOrders: [],
    dueSoonOrders: [],
  });

  const lastNotifiedIds = useRef<Set<string>>(new Set());
  const initialFetchDone = useRef(false);

  const fetchAlerts = async () => {
    try {
      const res = await fetch("/api/alerts/preorders", { cache: "no-store" });
      if (!res.ok) return;
      const json: AlertData = await res.json();
      setData(json);

      const targetUrl = role === "admin" ? "/admin/preorders" : "/cashier/preorders";

      // If initial fetch just finished, record IDs without spamming toasts
      if (!initialFetchDone.current) {
        initialFetchDone.current = true;
        json.pendingOrders.forEach((o) => lastNotifiedIds.current.add(o.id));
        json.dueSoonOrders.forEach((o) => lastNotifiedIds.current.add(o.id));

        // If there are already pending orders upon first load, show 1 gentle notice
        if (json.totalAlerts > 0) {
          toast(
            <div className="flex w-full items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center border-2 border-ink bg-terracotta text-paper">
                <Bell className="size-4" strokeWidth={2.8} />
              </span>
              <div className="flex-1">
                <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-terracotta">
                  Perhatian Pre-order
                </p>
                <p className="text-xs font-bold leading-snug">
                  Ada {json.pendingCount} pre-order menunggu dan {json.dueSoonCount} perlu dibuat.
                </p>
                <Link
                  href={targetUrl}
                  className="mt-2 inline-flex items-center gap-1 border-2 border-ink bg-ink px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-cream hover:bg-ink-soft"
                >
                  Buka Pre-order
                  <ArrowRight className="size-3" strokeWidth={3} />
                </Link>
              </div>
            </div>,
            { id: "initial-preorder-alert", duration: 8000 },
          );
        }
        return;
      }

      // Check for new pending orders
      for (const order of json.pendingOrders) {
        if (!lastNotifiedIds.current.has(order.id)) {
          lastNotifiedIds.current.add(order.id);
          toast(
            <div className="flex w-full items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center border-2 border-ink bg-terracotta text-paper">
                <Bell className="size-4 animate-bounce" strokeWidth={2.8} />
              </span>
              <div className="flex-1">
                <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-terracotta">
                  Pre-order Baru Masuk!
                </p>
                <p className="text-xs font-bold leading-snug">
                  {order.code} · {order.name} menunggu konfirmasi kasir.
                </p>
                <Link
                  href={targetUrl}
                  className="mt-2 inline-flex items-center gap-1 border-2 border-ink bg-ink px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-cream hover:bg-ink-soft"
                >
                  Konfirmasi Sekarang
                  <ArrowRight className="size-3" strokeWidth={3} />
                </Link>
              </div>
            </div>,
            { id: `new-order-${order.id}`, duration: 10000 },
          );
        }
      }

      // Check for due soon orders
      for (const order of json.dueSoonOrders) {
        const key = `due-${order.id}`;
        if (!lastNotifiedIds.current.has(key)) {
          lastNotifiedIds.current.add(key);
          toast(
            <div className="flex w-full items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center border-2 border-ink bg-butter text-ink">
                <Clock3 className="size-4 animate-spin" strokeWidth={2.8} />
              </span>
              <div className="flex-1">
                <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-terracotta">
                  Waktunya Membuat Pre-order!
                </p>
                <p className="text-xs font-bold leading-snug">
                  {order.code} · {order.name} mendekati jadwal pickup. Masukkan ke antrean!
                </p>
                <Link
                  href={`${targetUrl}?tab=scheduled`}
                  className="mt-2 inline-flex items-center gap-1 border-2 border-ink bg-terracotta px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-paper hover:bg-terracotta/90"
                >
                  Masukkan Antrean
                  <ArrowRight className="size-3" strokeWidth={3} />
                </Link>
              </div>
            </div>,
            { id: `due-order-${order.id}`, duration: 10000 },
          );
        }
      }
    } catch (e) {
      // Silently catch network failures during polling
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 15000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") fetchAlerts();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [role]);

  return (
    <PreorderAlertContext.Provider
      value={{
        pendingCount: data.pendingCount,
        dueSoonCount: data.dueSoonCount,
        totalAlerts: data.totalAlerts,
        refresh: fetchAlerts,
      }}
    >
      {children}
    </PreorderAlertContext.Provider>
  );
}
