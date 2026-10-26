import { formatInTimeZone } from "date-fns-tz";
import { zonedTimeToUtc } from "@/lib/slots";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function dateKeyNow(timezone: string, now = new Date()) {
  return formatInTimeZone(now, timezone, "yyyy-MM-dd");
}

export function shiftDateKey(key: string, days: number) {
  const date = new Date(`${key}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_KEY.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export type ResolvedRange = {
  fromKey: string;
  toKey: string;
  from: Date;
  to: Date;
};

/**
 * Resolves an inclusive date-key range into a half-open UTC range for queries.
 * Invalid or reversed input falls back to the last `defaultDays` days.
 */
export function resolveDateRange({
  from,
  to,
  timezone,
  defaultDays = 7,
}: {
  from?: string;
  to?: string;
  timezone: string;
  defaultDays?: number;
}): ResolvedRange {
  const today = dateKeyNow(timezone);
  let fromKey = isDateKey(from) ? from : shiftDateKey(today, -(defaultDays - 1));
  let toKey = isDateKey(to) ? to : today;

  if (fromKey > toKey) {
    [fromKey, toKey] = [toKey, fromKey];
  }

  return {
    fromKey,
    toKey,
    from: zonedTimeToUtc(`${fromKey} 00:00:00`, timezone),
    to: zonedTimeToUtc(`${shiftDateKey(toKey, 1)} 00:00:00`, timezone),
  };
}

export function resolveMonthRange({
  from,
  to,
  timezone,
}: {
  from?: string;
  to?: string;
  timezone: string;
}): ResolvedRange {
  const today = dateKeyNow(timezone);
  const monthStart = `${today.slice(0, 7)}-01`;

  return resolveDateRange({
    from: from ?? monthStart,
    to: to ?? today,
    timezone,
    defaultDays: 30,
  });
}
