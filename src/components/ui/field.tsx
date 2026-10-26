import type { ComponentProps, ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const controlClasses =
  "w-full border-[3px] border-ink bg-paper px-3 text-sm text-ink shadow-[inset_0_0_0_0] placeholder:text-muted/60 focus:bg-white focus-visible:outline-none focus-visible:ring-0 aria-[invalid=true]:bg-[#fdeae6] disabled:cursor-not-allowed disabled:opacity-60";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(controlClasses, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(controlClasses, "min-h-24 resize-y py-2.5 leading-relaxed", className)}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        controlClasses,
        "h-11 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23171310%22 stroke-width=%223%22><path d=%22M6 9l6 6 6-6%22/></svg>')] bg-[length:16px_16px] bg-[right_12px_center] bg-no-repeat pr-10",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({
  className,
  required,
  children,
  ...props
}: ComponentProps<"label"> & { required?: boolean }) {
  return (
    <label
      className={cn(
        "mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-soft",
        className,
      )}
      {...props}
    >
      {children}
      {required ? <span className="ml-1 text-terracotta">*</span> : null}
    </label>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <Label htmlFor={htmlFor} required={required}>
        {label}
      </Label>
      {children}
      {hint && !error ? (
        <p className="mt-1.5 text-[11px] leading-snug text-muted">{hint}</p>
      ) : null}
      {error ? (
        <p className="mt-1.5 text-[11px] font-semibold leading-snug text-danger">{error}</p>
      ) : null}
    </div>
  );
}

export function Checkbox({
  className,
  label,
  ...props
}: ComponentProps<"input"> & { label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
      <span className="relative inline-flex size-5 shrink-0 items-center justify-center">
        <input
          type="checkbox"
          className={cn(
            "peer size-5 shrink-0 cursor-pointer appearance-none border-[3px] border-ink bg-paper transition checked:bg-butter disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          {...props}
        />
        <Check
          aria-hidden
          className="pointer-events-none absolute size-3.5 text-ink opacity-0 transition-opacity peer-checked:opacity-100"
          strokeWidth={4}
        />
      </span>
      <span>{label}</span>
    </label>
  );
}
