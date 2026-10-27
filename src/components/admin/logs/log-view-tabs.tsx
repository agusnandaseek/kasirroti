import Link from "next/link";
import { Trash2, History } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/logs", label: "Log Transaksi", icon: History, key: "transactions" },
  {
    href: "/admin/logs/deletions",
    label: "Penghapusan",
    icon: Trash2,
    key: "deletions",
  },
] as const;

export function LogViewTabs({ active }: { active: (typeof TABS)[number]["key"] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex items-center gap-1.5 border-[3px] border-ink px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition",
              isActive
                ? "bg-ink text-cream shadow-hard-xs"
                : "bg-paper text-ink hover:bg-cream-deep",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="size-3.5" strokeWidth={3} />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
