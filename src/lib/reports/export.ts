import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import * as XLSX from "xlsx";
import { formatDateTime } from "@/lib/format";
import type { SalesReport } from "@/lib/data/orders";
import {
  bucketLabel,
  dateRangeLabel,
  groupLabel,
  type ReportGroup,
} from "@/lib/reports/labels";
import type { PaymentMethod } from "@/lib/types";

export type ReportExportInput = {
  storeName: string;
  timezone: string;
  group: ReportGroup;
  fromKey: string;
  toKey: string;
  report: SalesReport;
  generatedAt?: Date;
};

function paymentLabel(method: PaymentMethod) {
  return method === "cash" ? "Tunai" : "QRIS manual";
}

function typeLabel(type: "walk_in" | "pre_order") {
  return type === "pre_order" ? "Pre-order" : "Walk-in";
}

function periodRange(input: ReportExportInput) {
  return dateRangeLabel(input.fromKey, input.toKey);
}

function generatedLabel(input: ReportExportInput) {
  return formatDateTime(input.generatedAt ?? new Date(), input.timezone);
}

function reportTotals(report: SalesReport) {
  const revenue = report.buckets.reduce((sum, bucket) => sum + bucket.revenue, 0);
  const profit = report.buckets.reduce((sum, bucket) => sum + bucket.profit, 0);
  const transactions = report.buckets.reduce((sum, bucket) => sum + bucket.transactions, 0);
  return {
    revenue,
    profit,
    transactions,
    average: transactions > 0 ? Math.round(revenue / transactions) : 0,
  };
}

// ---------------------------------------------------------------------------
// Excel
// ---------------------------------------------------------------------------

export function buildXlsxReport(input: ReportExportInput): Uint8Array {
  const { report, storeName, timezone } = input;
  const totals = reportTotals(report);
  const best = report.buckets.reduce<(typeof report.buckets)[number] | null>(
    (current, bucket) => (!current || bucket.revenue > current.revenue ? bucket : current),
    null,
  );

  const workbook = XLSX.utils.book_new();

  const summary: (string | number)[][] = [
    [storeName],
    ["Laporan Penjualan"],
    ["Periode", periodRange(input)],
    ["Kelompok", groupLabel(input.group)],
    ["Dibuat", `${generatedLabel(input)} (${timezone})`],
    [],
    ["Omzet tercatat (Rp)", totals.revenue],
    ["Keuntungan (Rp)", totals.profit],
    ["Jumlah transaksi", totals.transactions],
    ["Rata-rata per transaksi (Rp)", totals.average],
    [
      "Periode terbaik",
      best ? `${bucketLabel(best.bucket, input.group)} (Rp ${best.revenue.toLocaleString("id-ID")})` : "-",
    ],
    [],
    [
      "Catatan",
      "Omzet hanya dihitung dari pembayaran yang tercatat. Keuntungan memakai harga modal saat pesanan dibuat; produk tanpa modal dihitung Rp0.",
    ],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summary);
  summarySheet["!cols"] = [{ wch: 34 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Ringkasan");

  const cashierRows: (string | number)[][] = [
    ["Kasir", "Transaksi", "Tunai", "QRIS", "Omzet (Rp)", "Keuntungan (Rp)", "Rata-rata (Rp)"],
    ...report.cashiers.map((row) => [
      row.name,
      row.transactions,
      row.cashTransactions,
      row.qrisTransactions,
      row.revenue,
      row.profit,
      row.transactions > 0 ? Math.round(row.revenue / row.transactions) : 0,
    ]),
  ];
  cashierRows.push([
    "Total",
    report.cashiers.reduce((sum, row) => sum + row.transactions, 0),
    report.cashiers.reduce((sum, row) => sum + row.cashTransactions, 0),
    report.cashiers.reduce((sum, row) => sum + row.qrisTransactions, 0),
    totals.revenue,
    totals.profit,
    totals.average,
  ]);
  const cashierSheet = XLSX.utils.aoa_to_sheet(cashierRows);
  cashierSheet["!cols"] = [
    { wch: 26 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 16 },
    { wch: 18 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(workbook, cashierSheet, "Per Kasir");

  const bucketRows: (string | number)[][] = [
    ["Kode", "Periode", "Transaksi", "Omzet (Rp)", "Keuntungan (Rp)", "Rata-rata (Rp)"],
    ...report.buckets.map((bucket) => [
      bucket.bucket,
      bucketLabel(bucket.bucket, input.group),
      bucket.transactions,
      bucket.revenue,
      bucket.profit,
      bucket.transactions > 0 ? Math.round(bucket.revenue / bucket.transactions) : 0,
    ]),
  ];
  bucketRows.push([
    "",
    "Total",
    totals.transactions,
    totals.revenue,
    totals.profit,
    totals.average,
  ]);
  const bucketSheet = XLSX.utils.aoa_to_sheet(bucketRows);
  bucketSheet["!cols"] = [
    { wch: 12 },
    { wch: 28 },
    { wch: 12 },
    { wch: 16 },
    { wch: 18 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(workbook, bucketSheet, "Rekap Periode");

  const sellerRows: (string | number)[][] = [
    ["Peringkat", "Produk", "Kuantitas", "Omzet (Rp)"],
    ...report.bestSellers.map((item, index) => [index + 1, item.name, item.quantity, item.revenue]),
  ];
  const sellerSheet = XLSX.utils.aoa_to_sheet(sellerRows);
  sellerSheet["!cols"] = [{ wch: 11 }, { wch: 36 }, { wch: 12 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(workbook, sellerSheet, "Produk Terlaris");

  const transactionRows: (string | number)[][] = [
    [
      "Kode pesanan",
      "Jenis",
      "Pelanggan",
      "Kasir",
      "Metode",
      "Nominal (Rp)",
      "Keuntungan (Rp)",
      "Dibayar pada",
    ],
    ...report.transactions.map((row) => [
      row.orderCode,
      typeLabel(row.orderType),
      row.customerName,
      row.cashierName,
      paymentLabel(row.method),
      row.amount,
      row.profit,
      formatDateTime(row.paidAt, timezone),
    ]),
  ];
  const transactionSheet = XLSX.utils.aoa_to_sheet(transactionRows);
  transactionSheet["!cols"] = [
    { wch: 15 },
    { wch: 12 },
    { wch: 28 },
    { wch: 24 },
    { wch: 14 },
    { wch: 15 },
    { wch: 18 },
    { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(workbook, transactionSheet, "Transaksi");

  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
  return new Uint8Array(buffer);
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const INK = rgb(0.09, 0.07, 0.06);
const MUTED = rgb(0.42, 0.4, 0.38);
const RULE = rgb(0.78, 0.75, 0.71);
const CREAM = rgb(0.98, 0.96, 0.92);
const BUTTER = rgb(1, 0.94, 0.72);

const CHARACTER_MAP: Record<string, string> = {
  "\u00a0": " ",
  "\u2192": "->",
  "\u00b7": "-",
  "\u2014": "-",
  "\u2013": "-",
  "\u2026": "...",
  "\u201c": '"',
  "\u201d": '"',
  "\u2018": "'",
  "\u2019": "'",
  "\u2022": "-",
};

/** Keep text inside the WinAnsi range supported by the standard PDF fonts. */
function pdfText(value: string) {
  return value.replace(/[^\x20-\x7e\xa0-\xff]/g, (character) => CHARACTER_MAP[character] ?? "?");
}

function fitText(value: string, font: PDFFont, size: number, maxWidth: number) {
  const clean = pdfText(value);
  if (font.widthOfTextAtSize(clean, size) <= maxWidth) return clean;

  let truncated = clean;
  while (truncated.length > 1 && font.widthOfTextAtSize(`${truncated}...`, size) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated.trimEnd()}...`;
}

type PdfColumn = {
  header: string;
  width: number;
  align?: "left" | "right";
};

type PdfRow = {
  cells: string[];
  bold?: boolean;
  fill?: boolean;
};

class PdfReport {
  private page: PDFPage;
  private y = PAGE_HEIGHT - MARGIN;
  private pages: PDFPage[] = [];
  private readonly title: string;

  constructor(
    private readonly doc: PDFDocument,
    private readonly font: PDFFont,
    private readonly bold: PDFFont,
    title: string,
  ) {
    this.title = title;
    this.page = this.newPage(false);
  }

  private newPage(withHeader = true) {
    const page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.pages.push(page);
    this.page = page;
    this.y = PAGE_HEIGHT - MARGIN;

    if (withHeader) {
      this.page.drawText(pdfText(this.title), {
        x: MARGIN,
        y: this.y - 8,
        size: 8,
        font: this.bold,
        color: MUTED,
      });
      this.page.drawLine({
        start: { x: MARGIN, y: this.y - 14 },
        end: { x: PAGE_WIDTH - MARGIN, y: this.y - 14 },
        thickness: 0.8,
        color: RULE,
      });
      this.y -= 30;
    }

    return page;
  }

  private ensure(height: number) {
    if (this.y - height >= MARGIN + 20) return;
    this.newPage();
  }

  heading(text: string) {
    this.ensure(34);
    this.page.drawText(pdfText(text.toUpperCase()), {
      x: MARGIN,
      y: this.y - 10,
      size: 10,
      font: this.bold,
      color: INK,
    });
    this.page.drawLine({
      start: { x: MARGIN, y: this.y - 16 },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y - 16 },
      thickness: 1.4,
      color: INK,
    });
    this.y -= 28;
  }

  note(text: string) {
    this.ensure(18);
    this.page.drawText(fitText(text, this.font, 8, CONTENT_WIDTH), {
      x: MARGIN,
      y: this.y - 9,
      size: 8,
      font: this.font,
      color: MUTED,
    });
    this.y -= 18;
  }

  private summaryCards(cards: { label: string; value: string }[]) {
    const gap = 10;
    const width = (CONTENT_WIDTH - gap * (cards.length - 1)) / cards.length;
    const height = 52;
    this.ensure(height + 16);
    const top = this.y;

    cards.forEach((card, index) => {
      const x = MARGIN + index * (width + gap);
      this.page.drawRectangle({
        x,
        y: top - height,
        width,
        height,
        borderColor: INK,
        borderWidth: 1.1,
        color: index === 0 ? BUTTER : CREAM,
      });
      this.page.drawText(fitText(card.label.toUpperCase(), this.font, 6.5, width - 16), {
        x: x + 8,
        y: top - 16,
        size: 6.5,
        font: this.font,
        color: MUTED,
      });
      this.page.drawText(fitText(card.value, this.bold, 13, width - 16), {
        x: x + 8,
        y: top - 38,
        size: 13,
        font: this.bold,
        color: INK,
      });
    });

    this.y = top - height - 20;
  }

  private drawTableHeader(columns: PdfColumn[], height = 18) {
    this.page.drawRectangle({
      x: MARGIN,
      y: this.y - height,
      width: CONTENT_WIDTH,
      height,
      color: INK,
    });

    let offset = 0;
    for (const column of columns) {
      const text = fitText(column.header.toUpperCase(), this.bold, 7, column.width - 10);
      const textWidth = this.bold.widthOfTextAtSize(text, 7);
      const x =
        column.align === "right"
          ? MARGIN + offset + column.width - 5 - textWidth
          : MARGIN + offset + 5;
      this.page.drawText(text, {
        x,
        y: this.y - height + 5.7,
        size: 7,
        font: this.bold,
        color: rgb(1, 0.98, 0.94),
      });
      offset += column.width;
    }

    this.y -= height;
  }

  table(columns: PdfColumn[], rows: PdfRow[], options: { total?: boolean } = {}) {
    this.ensure(18 + 17);
    this.drawTableHeader(columns);

    const rowHeight = 17;
    for (const row of rows) {
      if (this.y - rowHeight < MARGIN + 20) {
        this.newPage();
        this.drawTableHeader(columns);
      }

      const font = row.bold ? this.bold : this.font;
      const size = 8;

      if (row.fill) {
        this.page.drawRectangle({
          x: MARGIN,
          y: this.y - rowHeight,
          width: CONTENT_WIDTH,
          height: rowHeight,
          color: CREAM,
        });
      }

      let offset = 0;
      row.cells.forEach((cell, index) => {
        const column = columns[index];
        if (!column) return;

        const text = fitText(cell, font, size, column.width - 10);
        const textWidth = font.widthOfTextAtSize(text, size);
        const x =
          column.align === "right"
            ? MARGIN + offset + column.width - 5 - textWidth
            : MARGIN + offset + 5;

        this.page.drawText(text, {
          x,
          y: this.y - rowHeight + (rowHeight - size) / 2 + 1.5,
          size,
          font,
          color: INK,
        });
        offset += column.width;
      });

      this.page.drawLine({
        start: { x: MARGIN, y: this.y - rowHeight },
        end: { x: MARGIN + CONTENT_WIDTH, y: this.y - rowHeight },
        thickness: 0.5,
        color: RULE,
      });
      this.y -= rowHeight;
    }

    if (options.total && rows.length > 0) {
      // A visual gap so the total row is easy to spot.
      this.y -= 2;
    }

    this.y -= 16;
  }

  finish() {
    const total = this.pages.length;
    this.pages.forEach((page, index) => {
      page.drawLine({
        start: { x: MARGIN, y: MARGIN - 8 },
        end: { x: PAGE_WIDTH - MARGIN, y: MARGIN - 8 },
        thickness: 0.6,
        color: RULE,
      });
      page.drawText("RotiPOS - laporan dibuat otomatis", {
        x: MARGIN,
        y: MARGIN - 22,
        size: 7,
        font: this.font,
        color: MUTED,
      });
      const label = `Halaman ${index + 1} / ${total}`;
      page.drawText(label, {
        x: PAGE_WIDTH - MARGIN - this.font.widthOfTextAtSize(label, 7),
        y: MARGIN - 22,
        size: 7,
        font: this.font,
        color: MUTED,
      });
    });
  }

  get currentPage() {
    return this.page;
  }

  setY(value: number) {
    this.y = value;
  }

  summary(cards: { label: string; value: string }[]) {
    this.summaryCards(cards);
  }

  drawAt(x: number, y: number, text: string, size: number, font: PDFFont, color = INK) {
    this.page.drawText(fitText(text, font, size, PAGE_WIDTH - MARGIN - x), {
      x,
      y,
      size,
      font,
      color,
    });
  }
}

export async function buildPdfReport(input: ReportExportInput): Promise<Uint8Array> {
  const { report, storeName, timezone } = input;
  const totals = reportTotals(report);
  const best = report.buckets.reduce<(typeof report.buckets)[number] | null>(
    (current, bucket) => (!current || bucket.revenue > current.revenue ? bucket : current),
    null,
  );

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  doc.setTitle(`Laporan Penjualan ${periodRange(input)}`);
  doc.setAuthor(storeName);
  doc.setSubject("Laporan penjualan RotiPOS");
  doc.setCreationDate(input.generatedAt ?? new Date());

  const pdf = new PdfReport(doc, font, bold, `Laporan Penjualan - ${storeName}`);

  // Hero
  pdf.drawAt(MARGIN, PAGE_HEIGHT - MARGIN - 6, storeName.toUpperCase(), 9, bold, MUTED);
  pdf.drawAt(MARGIN, PAGE_HEIGHT - MARGIN - 34, "Laporan Penjualan", 24, bold, INK);
  const periodLine = `${periodRange(input)}  |  ${groupLabel(input.group)}`;
  pdf.drawAt(MARGIN, PAGE_HEIGHT - MARGIN - 52, periodLine, 10, font, MUTED);

  const generated = `Dibuat ${generatedLabel(input)} (${timezone})`;
  pdf.drawAt(
    PAGE_WIDTH - MARGIN - font.widthOfTextAtSize(pdfText(generated), 8),
    PAGE_HEIGHT - MARGIN - 6,
    generated,
    8,
    font,
    MUTED,
  );

  const heroPage = pdf.currentPage;
  heroPage.drawLine({
    start: { x: MARGIN, y: PAGE_HEIGHT - MARGIN - 64 },
    end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - MARGIN - 64 },
    thickness: 2.4,
    color: INK,
  });
  pdf.setY(PAGE_HEIGHT - MARGIN - 86);

  pdf.summary([
    { label: "Omzet tercatat", value: `Rp ${totals.revenue.toLocaleString("id-ID")}` },
    { label: "Keuntungan", value: `Rp ${totals.profit.toLocaleString("id-ID")}` },
    { label: "Transaksi", value: String(totals.transactions) },
    { label: "Rata-rata / transaksi", value: `Rp ${totals.average.toLocaleString("id-ID")}` },
    {
      label: "Periode terbaik",
      value: best ? bucketLabel(best.bucket, input.group) : "-",
    },
  ]);

  if (report.transactions.length === 0) {
    pdf.heading("Rincian");
    pdf.note("Belum ada pembayaran tercatat pada rentang ini. Pre-order yang belum dibayar tidak termasuk omzet.");
  } else {
    pdf.heading("Transaksi per kasir");
    pdf.table(
      [
        { header: "Kasir", width: 170 },
        { header: "Transaksi", width: 55, align: "right" },
        { header: "Tunai", width: 50, align: "right" },
        { header: "QRIS", width: 50, align: "right" },
        { header: "Omzet", width: 150, align: "right" },
        { header: "Keuntungan", width: 150, align: "right" },
        { header: "Rata-rata", width: 136.89, align: "right" },
      ],
      report.cashiers.map((row) => ({
        cells: [
          row.name,
          String(row.transactions),
          String(row.cashTransactions),
          String(row.qrisTransactions),
          `Rp ${row.revenue.toLocaleString("id-ID")}`,
          `Rp ${row.profit.toLocaleString("id-ID")}`,
          `Rp ${(row.transactions > 0 ? Math.round(row.revenue / row.transactions) : 0).toLocaleString("id-ID")}`,
        ],
      })),
    );

    pdf.heading(`Rincian per ${input.group === "month" ? "bulan" : "hari"}`);
    pdf.table(
      [
        { header: "Periode", width: 180 },
        { header: "Transaksi", width: 60, align: "right" },
        { header: "Omzet", width: 190, align: "right" },
        { header: "Keuntungan", width: 170, align: "right" },
        { header: "Rata-rata", width: 161.89, align: "right" },
      ],
      report.buckets.map((bucket) => ({
        cells: [
          bucketLabel(bucket.bucket, input.group),
          String(bucket.transactions),
          `Rp ${bucket.revenue.toLocaleString("id-ID")}`,
          `Rp ${bucket.profit.toLocaleString("id-ID")}`,
          `Rp ${(bucket.transactions > 0 ? Math.round(bucket.revenue / bucket.transactions) : 0).toLocaleString("id-ID")}`,
        ],
      })),
      { total: true },
    );

    if (report.bestSellers.length > 0) {
      pdf.heading("Produk terlaris");
      pdf.table(
        [
          { header: "Produk", width: 401.89 },
          { header: "Kuantitas", width: 120, align: "right" },
          { header: "Omzet", width: 240, align: "right" },
        ],
        report.bestSellers.map((item) => ({
          cells: [item.name, `${item.quantity} pcs`, `Rp ${item.revenue.toLocaleString("id-ID")}`],
        })),
      );
    }

    pdf.heading("Rincian transaksi");
    pdf.table(
      [
        { header: "Kode", width: 60 },
        { header: "Jenis", width: 50 },
        { header: "Pelanggan", width: 140 },
        { header: "Kasir", width: 110 },
        { header: "Metode", width: 58 },
        { header: "Nominal", width: 85, align: "right" },
        { header: "Untung", width: 85, align: "right" },
        { header: "Dibayar", width: 173.89 },
      ],
      report.transactions.map((row) => ({
        cells: [
          row.orderCode,
          typeLabel(row.orderType),
          row.customerName,
          row.cashierName,
          paymentLabel(row.method),
          `Rp ${row.amount.toLocaleString("id-ID")}`,
          `Rp ${row.profit.toLocaleString("id-ID")}`,
          formatDateTime(row.paidAt, timezone),
        ],
      })),
    );

    pdf.note(
      "Keuntungan = omzet - harga modal yang tercatat saat pesanan dibuat. Produk tanpa modal dihitung Rp0.",
    );
  }

  pdf.finish();
  return doc.save();
}
