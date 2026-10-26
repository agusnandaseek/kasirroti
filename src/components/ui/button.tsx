import type { ComponentProps, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant =
  | "primary"
  | "ink"
  | "secondary"
  | "danger"
  | "success"
  | "ghost";

export type ButtonSize = "sm" | "md" | "lg" | "icon";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-butter text-ink hover:bg-[#ffd35c]",
  ink: "bg-ink text-cream hover:bg-ink-soft",
  secondary: "bg-paper text-ink hover:bg-butter-soft",
  danger: "bg-terracotta text-paper hover:bg-terracotta-deep",
  success: "bg-mint text-paper hover:bg-[#3f6b4b]",
  ghost: "border-transparent bg-transparent text-ink hover:border-ink hover:bg-paper",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 gap-1.5 px-3 text-[10px] tracking-[0.12em]",
  md: "h-11 gap-2 px-4 text-[11px] tracking-[0.12em]",
  lg: "h-14 gap-2.5 px-6 text-xs tracking-[0.14em]",
  icon: "h-11 w-11",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(
    "press inline-flex select-none items-center justify-center border-[3px] border-ink font-bold uppercase shadow-hard-sm disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none",
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  loading = false,
  children,
  ...props
}: ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children?: ReactNode;
}) {
  return (
    <button
      className={buttonClasses({ variant, size, className })}
      disabled={props.disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}
