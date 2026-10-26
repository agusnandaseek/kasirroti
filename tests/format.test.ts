import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDateTime,
  formatIDR,
  formatPickupDistance,
  formatRelativeMinutes,
  getMonthRange,
  getTodayRange,
  isPastPickup,
} from "@/lib/format";

describe("formatIDR", () => {
  it("formats whole rupiah without decimals", () => {
    expect(formatIDR(25000).replace(/\s/g, "")).toBe("Rp25.000");
    expect(formatIDR(0).replace(/\s/g, "")).toBe("Rp0");
    expect(formatIDR(1250000).replace(/\s/g, "")).toBe("Rp1.250.000");
  });

  it("accepts bigint input", () => {
    expect(formatIDR(BigInt(50000)).replace(/\s/g, "")).toBe("Rp50.000");
  });
});

describe("date formatting in store timezone", () => {
  const instant = "2026-10-26T01:05:00.000Z";

  it("formats date and time in Asia/Jakarta", () => {
    expect(formatDateTime(instant, "Asia/Jakarta")).toContain("26 Okt 2026");
    expect(formatDateTime(instant, "Asia/Jakarta")).toContain("08:05");
    expect(formatDate(instant, "Asia/Jakarta")).toContain("26 Okt 2026");
  });

  it("rolls the date over at midnight Jakarta time", () => {
    const late = "2026-10-26T18:30:00.000Z";
    expect(formatDateTime(late, "Asia/Jakarta")).toContain("27 Okt 2026");
    expect(formatDateTime(late, "Asia/Jakarta")).toContain("01:30");
  });
});

describe("formatRelativeMinutes", () => {
  const now = new Date("2026-10-26T10:00:00.000Z");

  it("describes recent timestamps", () => {
    expect(formatRelativeMinutes(new Date("2026-10-26T09:59:30.000Z"), now)).toBe("baru saja");
    expect(formatRelativeMinutes(new Date("2026-10-26T09:55:00.000Z"), now)).toBe("5 menit lalu");
    expect(formatRelativeMinutes(new Date("2026-10-26T07:00:00.000Z"), now)).toBe("3 jam lalu");
    expect(formatRelativeMinutes(new Date("2026-10-24T10:00:00.000Z"), now)).toBe("2 hari lalu");
  });

  it("treats future timestamps as just now", () => {
    expect(formatRelativeMinutes(new Date("2026-10-26T10:05:00.000Z"), now)).toBe("baru saja");
  });
});

describe("formatPickupDistance", () => {
  const now = new Date("2026-10-26T10:00:00.000Z");

  it("describes upcoming pickups", () => {
    expect(formatPickupDistance(new Date("2026-10-26T10:00:10.000Z"), now)).toBe("sekarang");
    expect(formatPickupDistance(new Date("2026-10-26T10:45:00.000Z"), now)).toBe("45 menit lagi");
    expect(formatPickupDistance(new Date("2026-10-26T12:30:00.000Z"), now)).toBe(
      "2 jam 30 menit lagi",
    );
    expect(formatPickupDistance(new Date("2026-10-26T13:00:00.000Z"), now)).toBe("3 jam lagi");
  });

  it("describes past pickups", () => {
    expect(formatPickupDistance(new Date("2026-10-26T09:40:00.000Z"), now)).toBe(
      "lewat 20 menit",
    );
    expect(formatPickupDistance(new Date("2026-10-26T08:30:00.000Z"), now)).toBe(
      "lewat 1 jam 30 menit",
    );
  });
});

describe("getTodayRange", () => {
  it("uses the store date key and a 24-hour window", () => {
    const instant = new Date("2026-10-26T18:00:00.000Z");
    const range = getTodayRange("Asia/Jakarta", instant);

    expect(range.dateKey).toBe("2026-10-27");
    expect(range.start.toISOString()).toBe("2026-10-26T17:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-10-27T17:00:00.000Z");
    expect(range.end.getTime() - range.start.getTime()).toBe(86_400_000);
  });
});

describe("getMonthRange", () => {
  it("returns the first day of the current Jakarta month through next month", () => {
    const instant = new Date("2026-12-15T05:00:00.000Z");
    const range = getMonthRange("Asia/Jakarta", instant);

    expect(range.monthKey).toBe("2026-12");
    expect(range.start.toISOString()).toBe("2026-11-30T17:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-12-31T17:00:00.000Z");
  });
});

describe("isPastPickup", () => {
  it("compares pickup time against now", () => {
    const now = new Date("2026-10-26T10:00:00.000Z");
    expect(isPastPickup("2026-10-26T09:59:00.000Z", now)).toBe(true);
    expect(isPastPickup("2026-10-26T10:01:00.000Z", now)).toBe(false);
  });
});
