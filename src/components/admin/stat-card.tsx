import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONES = {
  butter: "bg-butter-soft",
  ink: "bg-ink text-cream",
  paper: "bg-paper",
  mint: "bg-mint-soft",
  terracotta: "bg-terracotta text-paper",
} as const;

export function StatCard({
  icon,
  label,
  value,
  hint,
  tone = "paper",
  className,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col justify-between border-[3px] border-ink p-4 shadow-hard-sm",
        TONES[tone],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className={cn(
            "font-mono text-[9px] font-bold uppercase leading-tight tracking-[0.16em]",
            tone === "ink" || tone === "terracotta" ? "text-current/75" : "text-muted",
          )}
        >
          {label}
        </p>
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center border-2",
            tone === "ink" || tone === "terracotta"
              ? "border-current/40"
              : "border-ink bg-paper/60",
          )}
        >
          {icon}
        </span>
      </div>

      <div className="mt-4">
        <p className="font-display text-[26px] leading-none tracking-tight">{value}</p>
        {hint ? (
          <p
            className={cn(
              "mt-1.5 font-mono text-[9px] uppercase leading-snug tracking-[0.08em]",
              tone === "ink" || tone === "terracotta" ? "text-current/65" : "text-muted",
            )}
          >
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
