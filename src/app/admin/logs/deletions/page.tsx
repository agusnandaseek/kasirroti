import Link from "next/link";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { DeletionLogCard } from "@/components/admin/logs/deletion-log-card";
import { LogViewTabs } from "@/components/admin/logs/log-view-tabs";
import { AutoRefresh } from "@/components/ui/auto-refresh";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { listOrderDeletions, type DeletionTimeRange } from "@/lib/data/deletion-logs";
import { getSettings } from "@/lib/data/settings";
import { DELETE_REASON_OPTIONS } from "@/lib/order-deletion";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TIME_RANGES: { label: string; value: DeletionTimeRange }[] = [
  { label: "Semua", value: "all" },
  { label: "Hari Ini", value: "today" },
  { label: "Kemarin", value: "yesterday" },
  { label: "7 Hari", value: "7d" },
  { label: "30 Hari", value: "30d" },
];

const VALID_RANGES = new Set(TIME_RANGES.map((range) => range.value));
const VALID_REASONS = new Set<string>(DELETE_REASON_OPTIONS.map((reason) => reason.value));

export default async function AdminDeletionLogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    range?: string;
    reason?: string;
    page?: string;
  }>;
}) {
  await requireRole(["admin"]);
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const timeRange: DeletionTimeRange = VALID_RANGES.has(params.range as DeletionTimeRange)
    ? (params.range as DeletionTimeRange)
    : "all";
  const reason = params.reason && VALID_REASONS.has(params.reason) ? params.reason : "all";
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const settings = await getSettings();
  const { logs, totalCount, totalPages } = await listOrderDeletions({
    q,
    timeRange,
    reason,
    page,
    limit: 10,
    timezone: settings.timezone,
  });

  function buildUrl(overrides: Record<string, string | number | undefined>) {
    const search = new URLSearchParams();
    const merged = {
      q: q || undefined,
      range: timeRange !== "all" ? timeRange : undefined,
      reason: reason !== "all" ? reason : undefined,
      page: page > 1 ? page : undefined,
      ...overrides,
    };

    for (const [key, value] of Object.entries(merged)) {
      if (value !== undefined && value !== "") {
        search.set(key, String(value));
      }
    }

    const query = search.toString();
    return `/admin/logs/deletions${query ? `?${query}` : ""}`;
  }

  const hasFilters = Boolean(q) || timeRange !== "all" || reason !== "all";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sistem & Audit"
        title="Log Penghapusan Transaksi"
        actions={<AutoRefresh label="Auto-refresh" intervalMs={20000} />}
      />

      <LogViewTabs active="deletions" />

      <Card className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <form method="GET" className="flex flex-1 items-center gap-2">
            {timeRange !== "all" ? <input type="hidden" name="range" value={timeRange} /> : null}
            {reason !== "all" ? <input type="hidden" name="reason" value={reason} /> : null}

            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input
                name="q"
                defaultValue={q}
                placeholder="Cari kode order (W-000001, PO-...) atau nama pemesan..."
                className="pl-9"
              />
            </div>
            <button type="submit" className={buttonClasses({ size: "md" })}>
              Cari
            </button>
            {hasFilters ? (
              <Link
                href="/admin/logs/deletions"
                className={buttonClasses({
                  variant: "ghost",
                  size: "md",
                  className: "gap-1 px-2.5",
                })}
                title="Reset semua filter"
              >
                <RotateCcw className="size-4" />
                <span className="sr-only sm:not-sr-only">Reset</span>
              </Link>
            ) : null}
          </form>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase text-muted">
              <Calendar className="size-3" strokeWidth={2.8} />
              Waktu:
            </span>
            {TIME_RANGES.map((range) => {
              const active = timeRange === range.value;
              return (
                <Link
                  key={range.value}
                  href={buildUrl({ range: range.value, page: 1 })}
                  className={cn(
                    "border-2 border-ink px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] transition",
                    active
                      ? "bg-terracotta text-paper shadow-hard-xs"
                      : "bg-paper text-ink hover:bg-cream-deep",
                  )}
                >
                  {range.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t-2 border-dashed border-ink/20 pt-3 text-xs">
          <span className="font-mono text-[10px] font-bold uppercase text-muted">Alasan:</span>
          <Link
            href={buildUrl({ reason: "all", page: 1 })}
            className={cn(
              "rounded-full border border-ink/40 px-2 py-0.5 text-[10px] font-semibold transition",
              reason === "all"
                ? "bg-ink font-bold text-cream"
                : "bg-paper text-ink-soft hover:border-ink hover:text-ink",
            )}
          >
            Semua
          </Link>
          {DELETE_REASON_OPTIONS.map((option) => {
            const active = reason === option.value;
            return (
              <Link
                key={option.value}
                href={buildUrl({ reason: option.value, page: 1 })}
                className={cn(
                  "rounded-full border border-ink/40 px-2 py-0.5 text-[10px] font-semibold transition",
                  active
                    ? "bg-ink font-bold text-cream"
                    : "bg-paper text-ink-soft hover:border-ink hover:text-ink",
                )}
              >
                {option.label}
              </Link>
            );
          })}
        </div>
      </Card>

      {logs.length === 0 ? (
        <EmptyState
          icon={<Trash2 className="size-6" strokeWidth={2.6} />}
          title="Belum ada transaksi dihapus"
          description={
            hasFilters
              ? "Tidak ada penghapusan yang cocok dengan filter atau kata kunci ini."
              : "Setiap transaksi yang dihapus oleh kasir atau admin akan tercatat di sini beserta alasannya."
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
              Menampilkan {logs.length} dari total {totalCount} penghapusan
            </p>
            <p className="hidden font-mono text-[9px] text-muted sm:block">
              Klik kartu untuk melihat rincian dan pelaku penghapusan
            </p>
          </div>

          <div className="space-y-3">
            {logs.map((log) => (
              <DeletionLogCard key={log.id} log={log} timezone={settings.timezone} />
            ))}
          </div>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between border-[3px] border-ink bg-paper p-3 shadow-hard-sm">
              <Link
                href={buildUrl({ page: page - 1 })}
                className={cn(
                  buttonClasses({
                    variant: "secondary",
                    size: "sm",
                    className: "gap-1 text-xs",
                  }),
                  page <= 1 && "pointer-events-none opacity-40",
                )}
                aria-disabled={page <= 1}
              >
                <ChevronLeft className="size-4" />
                Sebelumnya
              </Link>

              <span className="font-mono text-xs font-bold text-ink">
                Halaman {page} dari {totalPages}
              </span>

              <Link
                href={buildUrl({ page: page + 1 })}
                className={cn(
                  buttonClasses({
                    variant: "secondary",
                    size: "sm",
                    className: "gap-1 text-xs",
                  }),
                  page >= totalPages && "pointer-events-none opacity-40",
                )}
                aria-disabled={page >= totalPages}
              >
                Selanjutnya
                <ChevronRight className="size-4" />
              </Link>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
