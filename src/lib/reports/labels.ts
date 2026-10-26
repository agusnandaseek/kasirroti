/**
 * Shared, client-safe labels for report periods.
 */
const MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export type ReportGroup = "day" | "month";

export function monthName(month: number) {
  return MONTHS[month - 1] ?? String(month);
}

export function monthNameShort(month: number) {
  return MONTHS_SHORT[month - 1] ?? String(month);
}

export function bucketLabel(bucket: string, group: ReportGroup) {
  if (group === "month") {
    const [year, month] = bucket.split("-").map(Number);
    return `${monthName(month ?? 1)} ${year}`;
  }

  const date = new Date(`${bucket}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return bucket;
  const day = date.getUTCDate();
  const month = MONTHS[date.getUTCMonth()];
  const weekday = DAYS[date.getUTCDay()];
  return `${weekday}, ${day} ${month}`;
}

export function shortBucketLabel(bucket: string, group: ReportGroup) {
  if (group === "month") return bucketLabel(bucket, "month").slice(0, 3);
  const date = new Date(`${bucket}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return bucket;
  return String(date.getUTCDate());
}

export function groupLabel(group: ReportGroup) {
  return group === "month" ? "Bulanan" : "Harian";
}

export function dateKeyLabel(key: string) {
  const date = new Date(`${key}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return key;
  return `${date.getUTCDate()} ${monthName(date.getUTCMonth() + 1)} ${date.getUTCFullYear()}`;
}

export function dateRangeLabel(fromKey: string, toKey: string) {
  if (fromKey === toKey) return dateKeyLabel(fromKey);
  return `${dateKeyLabel(fromKey)} - ${dateKeyLabel(toKey)}`;
}
