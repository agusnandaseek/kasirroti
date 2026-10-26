import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getSalesReport } from "@/lib/data/orders";
import { getSettings } from "@/lib/data/settings";
import { resolveMonthRange } from "@/lib/ranges";
import { buildPdfReport, buildXlsxReport } from "@/lib/reports/export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET(request: Request) {
  await requireRole(["admin"]);

  const url = new URL(request.url);
  const format = url.searchParams.get("format");
  if (format !== "xlsx" && format !== "pdf") {
    return NextResponse.json(
      { error: "Format harus xlsx atau pdf." },
      { status: 400 },
    );
  }

  const settings = await getSettings();
  const group = url.searchParams.get("group") === "month" ? "month" : "day";
  const range = resolveMonthRange({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    timezone: settings.timezone,
  });

  try {
    const report = await getSalesReport(range.from, range.to, group);
    const input = {
      storeName: settings.storeName,
      timezone: settings.timezone,
      group,
      fromKey: range.fromKey,
      toKey: range.toKey,
      report,
    } as const;

    const bytes =
      format === "xlsx" ? buildXlsxReport(input) : await buildPdfReport(input);

    const filename = `laporan-rotipos-${range.fromKey}_${range.toKey}.${format}`;
    const body = new Blob([new Uint8Array(bytes)], {
      type: format === "xlsx" ? XLSX_TYPE : "application/pdf",
    });

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": body.type,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[rotipos-report-export]", error);
    return NextResponse.json(
      { error: "Laporan gagal dibuat. Coba lagi." },
      { status: 500 },
    );
  }
}
