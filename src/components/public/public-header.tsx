import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { buttonClasses } from "@/components/ui/button";

export function PublicHeader({ storeName }: { storeName: string }) {
  return (
    <header className="sticky top-0 z-40 border-b-[3px] border-ink bg-cream/95 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-4">
        <Logo href="/" />
        <div className="flex items-center gap-1 sm:gap-2">
          <span className="mr-1 hidden font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-muted md:inline">
            {storeName}
          </span>
          <Link
            href="/lacak"
            className={buttonClasses({ variant: "secondary", size: "sm" })}
          >
            Lacak
          </Link>
          <Link
            href="/preorder"
            className={buttonClasses({ variant: "ink", size: "sm" })}
          >
            Pre-order
          </Link>
        </div>
      </div>
    </header>
  );
}
