"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function AutoRefresh({
  intervalMs = 15000,
  enabled = true,
  label = "Auto-refresh",
}: {
  intervalMs?: number;
  enabled?: boolean;
  label?: string;
}) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const refresh = () => {
      setRefreshing(true);
      router.refresh();
      window.setTimeout(() => setRefreshing(false), 900);
    };

    const id = window.setInterval(refresh, intervalMs);

    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, intervalMs, router]);

  if (!enabled) return null;

  return (
    <span
      className="inline-flex size-6 items-center justify-center text-muted"
      title={`${label} setiap ${Math.round(intervalMs / 1000)} detik`}
      aria-label={`${label} setiap ${Math.round(intervalMs / 1000)} detik`}
      role="status"
    >
      <RefreshCw className={`size-3 ${refreshing ? "animate-spin" : ""}`} strokeWidth={3} />
    </span>
  );
}
