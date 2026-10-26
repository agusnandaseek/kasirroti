import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone =
  | "ink"
  | "butter"
  | "terracotta"
  | "mint"
  | "sky"
  | "muted"
  | "outline";

const tones: Record<BadgeTone, string> = {
  ink: "bg-ink text-cream",
  butter: "bg-butter text-ink",
  terracotta: "bg-terracotta text-paper",
  mint: "bg-mint text-paper",
  sky: "bg-sky text-ink",
  muted: "bg-cream-deep text-ink-soft",
  outline: "bg-paper text-ink",
};

export function Badge({
  tone = "outline",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border-2 border-ink px-2 py-0.5 font-mono text-[9px] font-bold uppercase leading-4 tracking-[0.16em]",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
