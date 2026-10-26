import { describe, expect, it } from "vitest";
import {
  buildPickupDays,
  formatSlotLabel,
  isPickupSlotScheduled,
  isValidPickupSlot,
  zonedTimeToUtc,
} from "@/lib/slots";
import type { StoreSettingsView } from "@/lib/types";

const DAYS_OPEN: StoreSettingsView["businessHours"] = {
  "0": { closed: false, open: "08:00", close: "20:00" },
  "1": { closed: false, open: "08:00", close: "20:00" },
  "2": { closed: false, open: "08:00", close: "20:00" },
  "3": { closed: false, open: "08:00", close: "20:00" },
  "4": { closed: false, open: "08:00", close: "20:00" },
  "5": { closed: false, open: "08:00", close: "20:00" },
  "6": { closed: false, open: "08:00", close: "20:00" },
};

const settings: StoreSettingsView = {
  storeName: "RotiPOS",
  timezone: "Asia/Jakarta",
  businessHours: DAYS_OPEN,
  slotIntervalMinutes: 30,
  minPreorderMinutes: 60,
  manualQrisEnabled: false,
};

// Monday 26 October 2026, 08:00 in Jakarta (01:00 UTC).
const MONDAY_MORNING = new Date("2026-10-26T01:00:00.000Z");

describe("buildPickupDays", () => {
  it("builds 7 days of 30-minute slots starting from tomorrow (H+1)", () => {
    const days = buildPickupDays(settings, MONDAY_MORNING);

    expect(days).toHaveLength(7);
    expect(days[0].dateKey).toBe("2026-10-27");
    expect(days[0].weekday).toBe("Selasa");
    expect(days[0].dateLabel).toBe("Sel, 27 Oktober");
    expect(days[0].relativeLabel).toBe("Besok");
    expect(days[1].relativeLabel).toBe("Lusa");
    expect(days[2].relativeLabel).toBeNull();

    const slots = days[0].slots;
    // Starts from opening time 08:00 because it's tomorrow
    expect(slots[0].label).toBe("08:00");
    expect(slots[0].value).toBe("2026-10-27T01:00:00.000Z");
    expect(slots.at(-1)?.label).toBe("19:30");
    // 08:00 through 19:30 inclusive (24 slots)
    expect(slots).toHaveLength(24);
  });

  it("skips closed weekdays", () => {
    const withMondayClosed: StoreSettingsView = {
      ...settings,
      businessHours: {
        ...DAYS_OPEN,
        "1": { closed: true },
      },
    };

    const days = buildPickupDays(withMondayClosed, MONDAY_MORNING);
    expect(days).toHaveLength(6);
    expect(days.some((day) => day.weekday === "Senin")).toBe(false);
  });

  it("drops days whose slots are all inside the lead time or in the past", () => {
    // 23:30 Jakarta on Monday; the next bookable slot starts Tuesday 08:00 (tomorrow).
    const lateNight = new Date("2026-10-26T16:30:00.000Z");
    const days = buildPickupDays(settings, lateNight);

    expect(days).toHaveLength(7);
    expect(days[0].dateKey).toBe("2026-10-27");
    expect(days[0].relativeLabel).toBe("Besok");
    expect(days[0].slots[0].label).toBe("08:00");
  });

  it("returns no days when the store is closed every day", () => {
    const closed: StoreSettingsView = {
      ...settings,
      businessHours: Object.fromEntries(
        Object.keys(DAYS_OPEN).map((key) => [key, { closed: true }]),
      ),
    };

    expect(buildPickupDays(closed, MONDAY_MORNING)).toEqual([]);
  });

  it("enforces a minimum 5-minute slot interval", () => {
    const days = buildPickupDays(
      { ...settings, slotIntervalMinutes: 1, minPreorderMinutes: 0 },
      MONDAY_MORNING,
    );

    // 08:00–20:00 every 5 minutes.
    expect(days[0].slots).toHaveLength(144);
    expect(days[0].slots[1].label).toBe("08:05");
  });

  it("supports custom day counts", () => {
    expect(buildPickupDays(settings, MONDAY_MORNING, 3)).toHaveLength(3);
  });
});

describe("isValidPickupSlot", () => {
  it("accepts a slot from the generated grid starting tomorrow", () => {
    expect(isValidPickupSlot(new Date("2026-10-27T03:00:00.000Z"), settings, MONDAY_MORNING)).toBe(
      true,
    );
  });

  it("rejects sameday slots", () => {
    expect(isValidPickupSlot(new Date("2026-10-26T03:00:00.000Z"), settings, MONDAY_MORNING)).toBe(
      false,
    );
  });

  it("rejects an offset that is not on the slot grid", () => {
    expect(
      isValidPickupSlot(new Date("2026-10-27T03:15:00.000Z"), settings, MONDAY_MORNING),
    ).toBe(false);
  });

  it("rejects slots in the past or inside the lead time", () => {
    expect(isValidPickupSlot(new Date("2026-10-26T01:00:00.000Z"), settings, MONDAY_MORNING)).toBe(
      false,
    );
    expect(isValidPickupSlot(new Date("2026-10-26T01:30:00.000Z"), settings, MONDAY_MORNING)).toBe(
      false,
    );
  });

  it("rejects an invalid date", () => {
    expect(isValidPickupSlot(new Date("not-a-date"), settings, MONDAY_MORNING)).toBe(false);
  });
});

describe("isPickupSlotScheduled", () => {
  it("accepts slots on the grid without re-applying lead time", () => {
    // 30 minutes from now: no longer bookable, but still a valid promise.
    expect(isPickupSlotScheduled(new Date("2026-10-26T01:30:00.000Z"), settings)).toBe(true);
    expect(isPickupSlotScheduled(new Date("2026-10-26T12:00:00.000Z"), settings)).toBe(true);
  });

  it("rejects off-grid times and closed days", () => {
    expect(isPickupSlotScheduled(new Date("2026-10-26T01:15:00.000Z"), settings)).toBe(false);

    const closedMonday: StoreSettingsView = {
      ...settings,
      businessHours: { ...DAYS_OPEN, "1": { closed: true } },
    };
    expect(isPickupSlotScheduled(new Date("2026-10-26T03:00:00.000Z"), closedMonday)).toBe(false);
  });

  it("rejects times outside opening hours", () => {
    expect(isPickupSlotScheduled(new Date("2026-10-26T00:30:00.000Z"), settings)).toBe(false);
    expect(isPickupSlotScheduled(new Date("2026-10-26T13:00:00.000Z"), settings)).toBe(false);
  });

  it("rejects invalid dates", () => {
    expect(isPickupSlotScheduled(new Date("nope"), settings)).toBe(false);
  });
});

describe("zonedTimeToUtc", () => {
  it("converts Jakarta wall-clock time to UTC", () => {
    expect(zonedTimeToUtc("2026-10-26 08:00:00", "Asia/Jakarta").toISOString()).toBe(
      "2026-10-26T01:00:00.000Z",
    );
  });

  it("respects a different timezone", () => {
    expect(zonedTimeToUtc("2026-10-26 08:00:00", "Asia/Makassar").toISOString()).toBe(
      "2026-10-26T00:00:00.000Z",
    );
  });

  it("round-trips through formatSlotLabel", () => {
    const iso = zonedTimeToUtc("2026-10-26 09:30:00", "Asia/Jakarta").toISOString();
    const label = formatSlotLabel(iso, "Asia/Jakarta");

    expect(label).toContain("Senin");
    expect(label).toContain("26 Oktober");
    expect(label).toContain("09.30");
  });
});
