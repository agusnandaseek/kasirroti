import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { id as localeId } from "date-fns/locale";

const idrFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function formatIDR(value: number | bigint) {
  return idrFormatter.format(Number(value));
}

export function formatDateTime(value: Date | string, timezone: string) {
  return formatInTimeZone(new Date(value), timezone, "d MMM yyyy, HH:mm", {
    locale: localeId,
  });
}

export function formatDate(value: Date | string, timezone: string) {
  return formatInTimeZone(new Date(value), timezone, "d MMM yyyy", {
    locale: localeId,
  });
}

export function formatDateLong(value: Date | string, timezone: string) {
  return formatInTimeZone(new Date(value), timezone, "EEEE, d MMMM yyyy", {
    locale: localeId,
  });
}

export function formatTime(value: Date | string, timezone: string) {
  return formatInTimeZone(new Date(value), timezone, "HH:mm");
}

export function formatRelativeMinutes(value: Date | string, now = new Date()) {
  const diff = Math.floor((now.getTime() - new Date(value).getTime()) / 60000);
  if (diff < 1) return "baru saja";
  if (diff < 60) return `${diff} menit lalu`;
  const hours = Math.floor(diff / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}

export function formatPickupDistance(value: Date | string, now = new Date()) {
  const diffMs = new Date(value).getTime() - now.getTime();
  const diffMinutes = Math.round(diffMs / 60000);
  const abs = Math.abs(diffMinutes);

  if (abs < 1) return "sekarang";
  if (abs < 60) return diffMinutes > 0 ? `${abs} menit lagi` : `lewat ${abs} menit`;
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  const label = minutes > 0 ? `${hours} jam ${minutes} menit` : `${hours} jam`;
  return diffMinutes > 0 ? `${label} lagi` : `lewat ${label}`;
}

export function getTodayRange(timezone: string, now = new Date()) {
  const dateKey = formatInTimeZone(now, timezone, "yyyy-MM-dd");
  const start = fromZonedTime(`${dateKey} 00:00:00`, timezone);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end, dateKey };
}

export function isPastPickup(value: Date | string, now = new Date()) {
  return new Date(value).getTime() < now.getTime();
}

export function getMonthRange(timezone: string, now = new Date()) {
  const monthKey = formatInTimeZone(now, timezone, "yyyy-MM");
  const start = fromZonedTime(`${monthKey}-01 00:00:00`, timezone);
  const [year, month] = monthKey.split("-").map(Number);
  const nextMonth =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const end = fromZonedTime(`${nextMonth} 00:00:00`, timezone);
  return { start, end, monthKey };
}
