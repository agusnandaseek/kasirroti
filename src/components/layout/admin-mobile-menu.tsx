"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { EllipsisVertical, ExternalLink, LogOut, X } from "lucide-react";
import { logoutAction } from "@/app/login/actions";
import { buttonClasses } from "@/components/ui/button";
import { ADMIN_NAV_GROUPS, isAdminNavActive } from "@/lib/admin-nav";
import { usePreorderAlerts } from "@/components/layout/preorder-alert-provider";
import { cn } from "@/lib/utils";

export function AdminMobileMenu({
  fullName,
  initials,
  storeName,
}: {
  fullName: string;
  initials: string;
  storeName: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { totalAlerts } = usePreorderAlerts();

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls="admin-mobile-menu"
        aria-label={open ? "Tutup menu admin" : "Buka menu admin"}
        className={buttonClasses({
          variant: open ? "ink" : "secondary",
          size: "sm",
          className: "relative size-9 px-0",
        })}
      >
        {open ? (
          <X className="size-4" strokeWidth={3} />
        ) : (
          <EllipsisVertical className="size-4" strokeWidth={3} />
        )}
        {!open && totalAlerts > 0 ? (
          <span className="absolute -right-1 -top-1 flex size-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-terracotta opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full border border-ink bg-terracotta" />
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          id="admin-mobile-menu"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(20rem,calc(100vw-1.5rem))] border-[3px] border-ink bg-paper shadow-hard"
        >
          <div className="flex items-center gap-2.5 border-b-[3px] border-ink bg-ink px-3 py-3 text-cream">
            <span className="flex size-9 shrink-0 items-center justify-center border-2 border-cream bg-butter font-display text-xs leading-none text-ink">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold">{fullName}</p>
              <p className="mt-0.5 truncate font-mono text-[8px] uppercase tracking-[0.14em] text-cream/55">
                Admin · {storeName}
              </p>
            </div>
          </div>

          <nav
            aria-label="Menu admin mobile"
            className="max-h-[min(58vh,25rem)] space-y-3 overflow-y-auto p-2.5"
          >
            {ADMIN_NAV_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="mb-1 px-1.5 font-mono text-[8px] font-bold uppercase tracking-[0.22em] text-muted">
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
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-2.5 border-2 px-2 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em] transition",
                          active
                            ? "border-ink bg-ink text-cream"
                            : "border-transparent text-ink-soft hover:border-ink hover:bg-butter-soft",
                        )}
                      >
                        <span className="relative">
                          <link.icon
                            className={cn("size-3.5", active ? "text-butter" : "text-muted")}
                            strokeWidth={2.8}
                          />
                          {isPreorder && totalAlerts > 0 ? (
                            <span className="absolute -right-1 -top-1 flex size-2">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-terracotta opacity-75" />
                              <span className="relative inline-flex size-2 rounded-full border border-ink bg-terracotta" />
                            </span>
                          ) : null}
                        </span>
                        {link.label}
                        {isPreorder && totalAlerts > 0 ? (
                          <span className="ml-auto border border-ink bg-terracotta px-1.5 py-0.5 text-[8px] font-bold text-paper">
                            {totalAlerts}
                          </span>
                        ) : active ? (
                          <span aria-hidden className="ml-auto size-1.5 rounded-full bg-butter" />
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="border-t-[3px] border-ink bg-cream p-2.5">
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/cashier/pos"
                onClick={() => setOpen(false)}
                className={buttonClasses({
                  variant: "secondary",
                  size: "sm",
                  className: "h-8 px-2 text-[9px]",
                })}
              >
                <ExternalLink className="size-3" strokeWidth={3} />
                Area kasir
              </Link>

              <form action={logoutAction}>
                <button
                  type="submit"
                  className={buttonClasses({
                    variant: "secondary",
                    size: "sm",
                    className: "h-8 w-full px-2 text-[9px]",
                  })}
                >
                  <LogOut className="size-3" strokeWidth={3} />
                  Keluar
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
