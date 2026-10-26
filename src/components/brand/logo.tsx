import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  href = "/",
  size = "md",
  className,
}: {
  href?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const markSizes = {
    sm: "size-8 text-base",
    md: "size-10 text-xl",
    lg: "size-14 text-3xl",
  };
  const textSizes = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-3xl",
  };

  const content = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "relative flex shrink-0 items-center justify-center border-[3px] border-ink bg-butter font-display leading-none shadow-hard-sm",
          markSizes[size],
        )}
        aria-hidden
      >
        <span className="absolute -right-1 -top-1 size-2.5 rounded-full border-2 border-ink bg-paper" />
        R
      </span>
      <span className="flex flex-col leading-none">
        <span className={cn("font-display uppercase tracking-tight", textSizes[size])}>
          Roti<span className="text-terracotta">POS</span>
        </span>
        {size !== "sm" ? (
          <span className="mt-1 font-mono text-[8px] font-semibold uppercase tracking-[0.24em] text-muted">
            Pesan · Ambil · Nikmati
          </span>
        ) : null}
      </span>
    </span>
  );

  if (!href) return content;

  return (
    <Link href={href} className="inline-flex focus-visible:outline-offset-4">
      {content}
    </Link>
  );
}
