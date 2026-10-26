import { afterEach, describe, expect, it, vi } from "vitest";
import {
  dateKeyNow,
  isDateKey,
  resolveDateRange,
  resolveMonthRange,
  shiftDateKey,
} from "@/lib/ranges";

afterEach(() => {
  vi.useRealTimers();
});

describe("isDateKey", () => {
  it("accepts a real ISO date key", () => {
    expect(isDateKey("2026-10-26")).toBe(true);
    expect(isDateKey("2028-02-29")).toBe(true);
  });

  it("rejects malformed or impossible dates", () => {
    expect(isDateKey("2026-02-30")).toBe(false);
    expect(isDateKey("2026-13-01")).toBe(false);
    expect(isDateKey("26-10-2026")).toBe(false);
    expect(isDateKey("2026-1-01")).toBe(false);
    expect(isDateKey(undefined)).toBe(false);
    expect(isDateKey(20261026)).toBe(false);
  });
});

describe("shiftDateKey", () => {
  it("moves across month and year boundaries", () => {
    expect(shiftDateKey("2026-10-31", 1)).toBe("2026-11-01");
    expect(shiftDateKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDateKey("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("handles leap days", () => {
    expect(shiftDateKey("2028-02-28", 1)).toBe("2028-02-29");
    expect(shiftDateKey("2027-02-28", 1)).toBe("2027-03-01");
  });
});

describe("dateKeyNow", () => {
  it("uses the store timezone, not the server timezone", () => {
    const instant = new Date("2026-10-26T18:00:00.000Z");
    expect(dateKeyNow("Asia/Jakarta", instant)).toBe("2026-10-27");
    expect(dateKeyNow("UTC", instant)).toBe("2026-10-26");
    expect(dateKeyNow("America/New_York", instant)).toBe("2026-10-26");
  });
});

describe("resolveDateRange", () => {
  it("turns inclusive date keys into a half-open UTC range", () => {
    const range = resolveDateRange({
      from: "2026-10-01",
      to: "2026-10-26",
      timezone: "Asia/Jakarta",
    });

    expect(range.fromKey).toBe("2026-10-01");
    expect(range.toKey).toBe("2026-10-26");
    expect(range.from.toISOString()).toBe("2026-09-30T17:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-10-26T17:00:00.000Z");
  });

  it("swaps reversed input instead of returning an empty range", () => {
    const range = resolveDateRange({
      from: "2026-10-26",
      to: "2026-10-01",
      timezone: "Asia/Jakarta",
    });

    expect(range.fromKey).toBe("2026-10-01");
    expect(range.toKey).toBe("2026-10-26");
  });

  it("falls back to the last N days for missing or invalid input", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-26T05:00:00.000Z"));

    const range = resolveDateRange({
      from: "bogus",
      to: "2026-02-30",
      timezone: "Asia/Jakarta",
      defaultDays: 7,
    });

    expect(range.fromKey).toBe("2026-10-20");
    expect(range.toKey).toBe("2026-10-26");
    expect(range.from.toISOString()).toBe("2026-10-19T17:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-10-26T17:00:00.000Z");
  });

  it("keeps a single supplied bound and computes the other from today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-26T05:00:00.000Z"));

    const range = resolveDateRange({
      from: "2026-10-01",
      timezone: "Asia/Jakarta",
    });

    expect(range.fromKey).toBe("2026-10-01");
    expect(range.toKey).toBe("2026-10-26");
  });
});

describe("resolveMonthRange", () => {
  it("defaults to the start of the current month through today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-26T05:00:00.000Z"));

    const range = resolveMonthRange({ timezone: "Asia/Jakarta" });
    expect(range.fromKey).toBe("2026-10-01");
    expect(range.toKey).toBe("2026-10-26");
  });

  it("respects explicit bounds", () => {
    const range = resolveMonthRange({
      from: "2026-01-01",
      to: "2026-03-31",
      timezone: "Asia/Jakarta",
    });

    expect(range.from.toISOString()).toBe("2025-12-31T17:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-03-31T17:00:00.000Z");
  });
});
