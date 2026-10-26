import Link from "next/link";
import { cn } from "@/lib/utils";

export type FilterTab = {
  href: string;
  label: string;
  count?: number;
  active: boolean;
};

export function FilterTabs({ tabs, className }: { tabs: FilterTab[]; className?: string }) {
  return (
    <div
      className={cn(
        "flex w-full flex-wrap gap-1 border-[3px] border-ink bg-paper p-1 shadow-hard-sm sm:w-auto sm:flex-nowrap",
        className,
      )}
    >
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={cn(
            "flex flex-1 shrink-0 items-center justify-center gap-2 whitespace-nowrap px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.1em] transition",
            tab.active ? "bg-ink text-cream" : "text-muted hover:bg-cream hover:text-ink",
          )}
        >
          {tab.label}
          {typeof tab.count === "number" ? (
            <span
              className={cn(
                "inline-flex min-w-[18px] items-center justify-center border px-1 font-mono text-[9px]",
                tab.active ? "border-cream/40 text-butter" : "border-ink/25 text-ink-soft",
              )}
            >
              {tab.count}
            </span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
