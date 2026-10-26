import Link from "next/link";
import {
  ArrowRight,
  Clock3,
  History,
  Search,
  ShieldCheck,
  User,
  UserCheck,
} from "lucide-react";
import { AutoRefresh } from "@/components/ui/auto-refresh";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireRole } from "@/lib/auth";
import { listActivityLogs } from "@/lib/data/logs";
import { getSettings } from "@/lib/data/settings";
import { formatDateTime } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  await requireRole(["admin"]);
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const status = params.status ?? "all";

  const settings = await getSettings();
  const logs = await listActivityLogs({ q, status });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sistem & Audit"
        title="Log Aktivitas"
        actions={<AutoRefresh label="Log auto-refresh" intervalMs={20000} />}
      />

      {/* Filter & Search Bar */}
      <Card className="p-3 sm:p-4">
        <form method="GET" className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Cari kode order, nama pemesan, nama staf, atau aksi..."
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <button type="submit" className={buttonClasses({ size: "md" })}>
              Cari Log
            </button>
            {q ? (
              <Link href="/admin/logs" className={buttonClasses({ variant: "ghost", size: "md" })}>
                Reset
              </Link>
            ) : null}
          </div>
        </form>
      </Card>

      {/* Logs Table / Feed */}
      {logs.length === 0 ? (
        <EmptyState
          icon={<History className="size-6" strokeWidth={2.6} />}
          title="Tidak ada log ditemukan"
          description={
            q
              ? "Tidak ada aktivitas yang cocok dengan kata kunci pencarian Anda."
              : "Belum ada aktivitas transaksi atau perubahan status yang tercatat di sistem."
          }
        />
      ) : (
        <div className="border-[3px] border-ink bg-paper shadow-hard-lg">
          <div className="border-b-[3px] border-ink bg-ink px-4 py-3 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-cream sm:px-6">
            Daftar Aktivitas ({logs.length} Kejadian Terakhir)
          </div>

          <div className="divide-y-2 divide-ink/20">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex flex-col gap-3 p-4 transition hover:bg-cream/40 sm:flex-row sm:items-center sm:justify-between sm:p-5"
              >
                {/* Left: Time & Action */}
                <div className="space-y-1 sm:max-w-md">
                  <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] text-muted">
                    <span className="inline-flex items-center gap-1 font-bold text-ink">
                      <Clock3 className="size-3" strokeWidth={2.8} />
                      {formatDateTime(log.timestamp, settings.timezone)} WIB
                    </span>
                    <span>·</span>
                    <Badge tone="outline" className="text-[8px]">
                      {log.orderType}
                    </Badge>
                  </div>

                  <p className="text-sm font-bold text-ink sm:text-base">{log.actionTitle}</p>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono font-bold text-terracotta">{log.orderCode}</span>
                    <span className="text-muted">({log.customerName})</span>
                    {log.fromStatus ? (
                      <span className="font-mono text-[9px] text-muted">
                        {log.fromStatus} → {log.toStatus}
                      </span>
                    ) : (
                      <StatusBadge status={log.toStatus as OrderStatus} />
                    )}
                  </div>

                  {log.notes ? (
                    <p className="mt-1 font-mono text-[10px] text-ink-soft bg-cream-deep/60 px-2 py-1 border border-ink/20">
                      Catatan: {log.notes}
                    </p>
                  ) : null}
                </div>

                {/* Right: Actor & Link */}
                <div className="flex items-center justify-between gap-3 border-t-2 border-dashed border-ink/20 pt-2 sm:border-t-0 sm:pt-0">
                  <div className="text-left sm:text-right">
                    <p className="font-mono text-[8px] font-bold uppercase tracking-[0.16em] text-muted">
                      Dilakukan Oleh
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5 sm:justify-end">
                      {log.actorType === "system" ? (
                        <ShieldCheck className="size-3.5 text-mint" strokeWidth={2.8} />
                      ) : log.actorRole === "Admin" ? (
                        <UserCheck className="size-3.5 text-butter" strokeWidth={2.8} />
                      ) : (
                        <User className="size-3.5 text-muted" strokeWidth={2.8} />
                      )}
                      <span className="text-xs font-bold text-ink">{log.actorName}</span>
                      {log.actorRole ? (
                        <Badge
                          tone={
                            log.actorRole === "Admin"
                              ? "butter"
                              : log.actorRole === "Kasir"
                                ? "mint"
                                : "outline"
                          }
                          className="px-1 py-0 text-[8px]"
                        >
                          {log.actorRole}
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  {log.orderId ? (
                    <Link
                      href={`/admin/orders/${log.orderId}`}
                      className={buttonClasses({
                        variant: "secondary",
                        size: "sm",
                        className: "h-8 px-2 text-[9px]",
                      })}
                      title="Lihat detail pesanan ini"
                    >
                      <ArrowRight className="size-3.5" strokeWidth={3} />
                      <span className="sr-only sm:not-sr-only sm:inline">Detail</span>
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
