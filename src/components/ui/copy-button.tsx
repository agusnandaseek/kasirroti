"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "@/components/ui/button";

export function CopyButton({
  value,
  label = "Salin",
  copiedLabel = "Tersalin",
  variant = "secondary",
  size = "sm",
  className,
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Disalin ke clipboard.");
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      toast.error("Gagal menyalin. Salin secara manual.");
    }
  }

  return (
    <button type="button" onClick={copy} className={buttonClasses({ variant, size, className })}>
      {copied ? (
        <Check className="size-3.5" strokeWidth={3} />
      ) : (
        <Copy className="size-3.5" strokeWidth={3} />
      )}
      {copied ? copiedLabel : label}
    </button>
  );
}
