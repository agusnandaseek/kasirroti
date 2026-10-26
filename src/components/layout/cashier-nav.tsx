"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, ShoppingBasket, Ticket } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/cashier/pos", label: "Kasir", icon: ShoppingBasket },
  { href: "/cashier/orders", label: "List Pesanan", icon: ClipboardList },
  { href: "/cashier/preorders", label: "Pre-order", icon: Ticket },
];

export function CashierNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Menu kasir"
      className="-mb-[3px] grid grid-cols-3 gap-1 sm:flex sm:gap-1.5"
    >
      {LINKS.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "group relative flex flex-col items-center justify-center gap-1 border-[3px] border-b-0 border-ink px-2 pb-2 pt-2.5 transition sm:flex-row sm:justify-start sm:gap-2 sm:px-4 sm:pb-2.5 sm:pt-2.5",
              active
                ? "bg-ink text-cream"
                : "bg-cream text-ink-soft hover:bg-butter-soft hover:text-ink",
            )}
            aria-current={active ? "page" : undefined}
          >
            <link.icon
              className={cn(
                "size-[18px] shrink-0 transition sm:size-4",
                active ? "text-butter" : "text-ink-soft group-hover:text-ink",
              )}
              strokeWidth={2.8}
            />
            <span className="font-mono text-[9px] font-bold uppercase leading-none tracking-[0.06em] sm:text-[10px] sm:tracking-[0.12em]">
              {link.label}
            </span>
            {active ? (
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-1 bg-butter"
              />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
