import Link from "next/link";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  History,
  RotateCcw,
  Search,
} from "lucide-react";
import { AutoRefresh } from "@/components/ui/auto-refresh";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { LogViewTabs } from "@/components/admin/logs/log-view-tabs";
import { TransactionLogCard } from "@/components/admin/logs/transaction-log-card";
import { requireRole } from "@/lib/auth";
import { listTransactionLogs, type TimeRangeFilter } from "@/lib/data/logs";
import { getSettings } from "@/lib/data/settings";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TIME_RANGES: { label: string; value: TimeRangeFilter }[] = [
  { label: "Semua", value: "all" },
  { label: "Hari Ini", value: "today" },
  { label: "Kemarin", value: "yesterday" },
  { label: "7 Hari", value: "7d" },
  { label: "30 Hari", value: "30d" },
];

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    range?: string;
    status?: string;
    page?: string;
  }>;
}) {
  await requireRole(["admin"]);
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const timeRange = (params.range as TimeRangeFilter) || "all";
  const status = params.status ?? "all";
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const settings = await getSettings();
  const { logs, totalCount, totalPages } = await listTransactionLogs({
    q,
    timeRange,
    status,
    page,
    limit: 10,
    timezone: settings.timezone,
  });

  // Helper to construct query params preserving others
  function buildUrl(overrides: Record<string, string | number | undefined>) {
    const p = new URLSearchParams();
    const merged = {
      q: q || undefined,
      range: timeRange !== "all" ? timeRange : undefined,
      status: status !== "all" ? status : undefined,
      page: page > 1 ? page : undefined,
      ...overrides,
    };

    for (const [key, val] of Object.entries(merged)) {
      if (val !== undefined && val !== "") {
        p.set(key, String(val));
      }
    }
    const query = p.toString();
    return `/admin/logs${query ? `?${query}` : ""}`;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sistem & Audit"
        title="Log Aktivitas Transaksi"
        actions={<AutoRefresh label="Auto-refresh" intervalMs={20000} />}
      />

      <LogViewTabs active="transactions" />

      {/* Filter Bar */}
      <Card className="space-y-4 p-4 sm:p-5">
        {/* Top: Search and Time Range Tabs */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Search Input */}
          <form method="GET" className="flex flex-1 items-center gap-2">
            {timeRange !== "all" ? (
              <input type="hidden" name="range" value={timeRange} />
            ) : null}
            {status !== "all" ? (
              <input type="hidden" name="status" value={status} />
            ) : null}

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
            {q || timeRange !== "all" || status !== "all" ? (
              <Link
                href="/admin/logs"
                className={buttonClasses({ variant: "ghost", size: "md", className: "gap-1 px-2.5" })}
                title="Reset semua filter"
              >
                <RotateCcw className="size-4" />
                <span className="sr-only sm:not-sr-only">Reset</span>
              </Link>
            ) : null}
          </form>

          {/* Time Range Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase text-muted">
              <Calendar className="size-3" strokeWidth={2.8} />
              Waktu:
            </span>
            {TIME_RANGES.map((r) => {
              const active = timeRange === r.value;
              return (
                <Link
                  key={r.value}
                  href={buildUrl({ range: r.value, page: 1 })}
                  className={cn(
                    "border-2 border-ink px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] transition",
                    active
                      ? "bg-terracotta text-paper shadow-hard-xs"
                      : "bg-paper text-ink hover:bg-cream-deep",
                  )}
                >
                  {r.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Bottom: Status Quick Filter */}
        <div className="flex flex-wrap items-center gap-2 border-t-2 border-dashed border-ink/20 pt-3 text-xs">
          <span className="font-mono text-[10px] font-bold uppercase text-muted">
            Status:
          </span>
          {[
            { label: "Semua", value: "all" },
            { label: "Selesai", value: "completed" },
            { label: "Siap Diambil", value: "ready" },
            { label: "Diproses", value: "preparing" },
            { label: "Dalam Antrean", value: "queued" },
            { label: "Menunggu Konfirmasi", value: "pending_confirmation" },
            { label: "Dibatalkan", value: "cancelled" },
          ].map((s) => {
            const active = status === s.value;
            return (
              <Link
                key={s.value}
                href={buildUrl({ status: s.value, page: 1 })}
                className={cn(
                  "rounded-full border border-ink/40 px-2 py-0.5 text-[10px] font-semibold transition",
                  active
                    ? "bg-ink font-bold text-cream"
                    : "bg-paper text-ink-soft hover:border-ink hover:text-ink",
                )}
              >
                {s.label}
              </Link>
            );
          })}
        </div>
      </Card>

      {/* Main Content: Grouped Transaction Logs */}
      {logs.length === 0 ? (
        <EmptyState
          icon={<History className="size-6" strokeWidth={2.6} />}
          title="Tidak ada log transaksi ditemukan"
          description={
            q || timeRange !== "all" || status !== "all"
              ? "Tidak ada transaksi yang cocok dengan filter atau kata kunci Anda."
              : "Belum ada transaksi yang tercatat di sistem."
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
              Menampilkan {logs.length} dari total {totalCount} transaksi
            </p>
            <p className="font-mono text-[9px] text-muted">
              Klik pada transaksi untuk melihat detail kronologi kejadian
            </p>
          </div>

          <div className="space-y-3">
            {logs.map((log) => (
              <TransactionLogCard
                key={log.id}
                log={log}
                timezone={settings.timezone}
              />
            ))}
          </div>

          {/* Pagination Controls */}
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
