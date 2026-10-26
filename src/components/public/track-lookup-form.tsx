"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { isTrackingCodeFormat, normalizeTrackingCode } from "@/lib/token-format";
import { cn } from "@/lib/utils";

export function TrackLookupForm({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = normalizeTrackingCode(value);

    if (!code) {
      setError("Masukkan kode lacak 5 karakter terlebih dahulu.");
      return;
    }

    if (!isTrackingCodeFormat(code)) {
      setError("Kode lacak terdiri dari 5 karakter (huruf/angka, tanpa I, O, 0, 1).");
      return;
    }

    setError(null);
    router.push(`/track/${code}`);
  }

  return (
    <form onSubmit={submit} className={cn("w-full", className)} noValidate>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
            strokeWidth={3}
          />
          <Input
            value={value}
            onChange={(event) => {
              setValue(event.target.value.toUpperCase());
              setError(null);
            }}
            placeholder="Contoh: AB7K2"
            aria-label="Kode lacak 5 karakter"
            aria-invalid={Boolean(error)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={8}
            className={cn(
              "h-11 pl-9 font-mono text-base font-bold uppercase tracking-[0.2em]",
              compact && "text-sm",
            )}
          />
        </div>
        <Button type="submit" variant={compact ? "ink" : "primary"} className="shrink-0">
          Lacak
          <ArrowRight className="size-3.5" strokeWidth={3} />
        </Button>
      </div>
      {error ? (
        <p className="mt-2 text-[11px] font-semibold text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
