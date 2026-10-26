"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV_GROUPS, isAdminNavActive } from "@/lib/admin-nav";
import { usePreorderAlerts } from "@/components/layout/preorder-alert-provider";
import { cn } from "@/lib/utils";

export function AdminNav() {
  const pathname = usePathname();
  const { totalAlerts, pendingCount, dueSoonCount } = usePreorderAlerts();

  return (
    <nav aria-label="Menu admin" className="space-y-5">
      {ADMIN_NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 px-2 font-mono text-[8px] font-bold uppercase tracking-[0.24em] text-cream/35">
            {group.label}
          </p>
          <div className="space-y-1">
            {group.links.map((link) => {
              const active = isAdminNavActive(pathname, link.href);
              const isPreorder = link.href.includes("preorder");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex items-center gap-2.5 border-[3px] px-2.5 py-2 transition",
                    active
                      ? "border-cream/30 bg-butter text-ink"
                      : "border-transparent text-cream/65 hover:border-cream/15 hover:bg-cream/10 hover:text-cream",
                  )}
                >
                  <span
                    className={cn(
                      "relative flex size-7 shrink-0 items-center justify-center border-2 transition",
                      active
                        ? "border-ink bg-ink text-butter"
                        : "border-cream/20 text-cream/60 group-hover:border-cream/40 group-hover:text-cream",
                    )}
                  >
                    <link.icon className="size-3.5" strokeWidth={2.8} />
                    {isPreorder && totalAlerts > 0 ? (
                      <span className="absolute -right-1 -top-1 flex size-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-terracotta opacity-75" />
                        <span className="relative inline-flex size-2.5 rounded-full border border-ink bg-terracotta" />
                      </span>
                    ) : null}
                  </span>
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em]">
                    {link.label}
                  </span>
                  {isPreorder && totalAlerts > 0 ? (
                    <span
                      className="ml-auto inline-flex items-center justify-center border border-ink bg-terracotta px-1.5 py-0.5 font-mono text-[8px] font-bold text-paper"
                      title={`${pendingCount} menunggu konfirmasi, ${dueSoonCount} perlu dibuat`}
                    >
                      {totalAlerts}
                    </span>
                  ) : active ? (
                    <span aria-hidden className="ml-auto size-1.5 rounded-full bg-ink" />
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
