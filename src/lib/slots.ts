import type { BusinessHours, StoreSettingsView } from "@/lib/types";

const WEEKDAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const WEEKDAYS_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
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

export type PickupSlot = {
  /** ISO timestamp in UTC. */
  value: string;
  /** HH:mm in store timezone. */
  label: string;
};

export type PickupDay = {
  dateKey: string;
  weekday: string;
  dateLabel: string;
  relativeLabel: string | null;
  slots: PickupSlot[];
};

function addDaysToKey(key: string, days: number) {
  const date = new Date(`${key}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dayOfWeek(key: string) {
  return new Date(`${key}T12:00:00.000Z`).getUTCDay();
}

function minutesFromTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function timeFromMinutes(total: number) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function hoursFor(businessHours: BusinessHours, weekday: number) {
  return businessHours[String(weekday)] ?? { closed: true };
}

/**
 * Builds bookable pickup slots from store hours, slot interval and lead time.
 * Pure function: safe to import from client components.
 */
export function buildPickupDays(
  settings: Pick<StoreSettingsView, "timezone" | "businessHours" | "slotIntervalMinutes" | "minPreorderMinutes">,
  now = new Date(),
  dayCount = 7,
): PickupDay[] {
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: settings.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const earliest = new Date(now.getTime() + settings.minPreorderMinutes * 60_000);
  const days: PickupDay[] = [];

  for (let offset = 0; offset < dayCount; offset += 1) {
    const dateKey = addDaysToKey(todayKey, offset);
    const weekday = dayOfWeek(dateKey);
    const hours = hoursFor(settings.businessHours, weekday);
    if (hours.closed || !hours.open || !hours.close) continue;

    const open = minutesFromTime(hours.open);
    const close = minutesFromTime(hours.close);
    const interval = Math.max(5, settings.slotIntervalMinutes);
    const slots: PickupSlot[] = [];

    for (let minutes = open; minutes < close; minutes += interval) {
      const wallClock = `${dateKey} ${timeFromMinutes(minutes)}:00`;
      const slotDate = zonedTimeToUtc(wallClock, settings.timezone);
      if (slotDate.getTime() < earliest.getTime()) continue;
      slots.push({
        value: slotDate.toISOString(),
        label: timeFromMinutes(minutes),
      });
    }

    if (slots.length === 0) continue;

    const dayNumber = Number(dateKey.slice(8, 10));
    days.push({
      dateKey,
      weekday: WEEKDAYS[weekday],
      dateLabel: `${WEEKDAYS_SHORT[weekday]}, ${dayNumber} ${MONTHS[Number(dateKey.slice(5, 7)) - 1]}`,
      relativeLabel: offset === 0 ? "Hari ini" : offset === 1 ? "Besok" : null,
      slots,
    });
  }

  return days;
}

export function isValidPickupSlot(
  pickupAt: Date,
  settings: Pick<StoreSettingsView, "timezone" | "businessHours" | "slotIntervalMinutes" | "minPreorderMinutes">,
  now = new Date(),
) {
  if (Number.isNaN(pickupAt.getTime())) return false;
  const days = buildPickupDays(settings, now, 7);
  const stamp = Math.floor(pickupAt.getTime() / 60_000);
  return days.some((day) => day.slots.some((slot) => Math.floor(new Date(slot.value).getTime() / 60_000) === stamp));
}

/**
 * Validates that a pickup timestamp still falls on an open day and on the
 * configured slot grid. Unlike isValidPickupSlot, this does not re-apply the
 * lead time, because lead time is enforced when the customer books the slot.
 * Used when a cashier confirms an existing pre-order.
 */
export function isPickupSlotScheduled(
  pickupAt: Date,
  settings: Pick<StoreSettingsView, "timezone" | "businessHours" | "slotIntervalMinutes">,
) {
  if (Number.isNaN(pickupAt.getTime())) return false;

  const dateKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: settings.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(pickupAt);
  const hours = hoursFor(settings.businessHours, dayOfWeek(dateKey));
  if (hours.closed || !hours.open || !hours.close) return false;

  const open = zonedTimeToUtc(`${dateKey} ${hours.open}:00`, settings.timezone);
  const close = zonedTimeToUtc(`${dateKey} ${hours.close}:00`, settings.timezone);
  const minutesFromOpen = (pickupAt.getTime() - open.getTime()) / 60_000;
  const interval = Math.max(5, settings.slotIntervalMinutes);

  if (minutesFromOpen < 0) return false;
  if (pickupAt.getTime() >= close.getTime()) return false;

  return minutesFromOpen % interval === 0;
}

/**
 * Converts a wall-clock time in a specific IANA timezone into a UTC Date.
 * Uses Intl so it works in both server and browser without extra deps.
 */
export function zonedTimeToUtc(wallClock: string, timezone: string) {
  const [datePart, timePart = "00:00:00"] = wallClock.split(" ");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second = 0] = timePart.split(":").map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const partsToStamp = (date: Date) => {
    const parts = formatter.formatToParts(date);
    const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return Date.UTC(
      Number(lookup.year),
      Number(lookup.month) - 1,
      Number(lookup.day),
      Number(lookup.hour),
      Number(lookup.minute),
      Number(lookup.second),
    );
  };

  let candidate = new Date(utcGuess);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = partsToStamp(candidate);
    const delta = utcGuess - actual;
    if (delta === 0) break;
    candidate = new Date(candidate.getTime() + delta);
  }

  return candidate;
}

export function formatSlotLabel(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}
