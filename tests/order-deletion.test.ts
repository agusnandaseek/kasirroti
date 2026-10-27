import { describe, expect, it } from "vitest";
import { DELETE_REASON_OPTIONS, deleteReasonLabel } from "@/lib/order-deletion";

describe("deleteReasonLabel", () => {
  it("maps every deletion reason to its label", () => {
    for (const option of DELETE_REASON_OPTIONS) {
      expect(deleteReasonLabel(option.value)).toBe(option.label);
    }
  });

  it("falls back to the raw code for unknown reasons", () => {
    expect(deleteReasonLabel("legacy_reason")).toBe("legacy_reason");
  });
});
