import { describe, expect, it } from "vitest";
import {
  isTrackingCodeFormat,
  normalizeTrackingCode,
  TRACKING_CODE_LENGTH,
} from "@/lib/token-format";

describe("normalizeTrackingCode", () => {
  it("uppercases and strips spaces and dashes", () => {
    expect(normalizeTrackingCode(" ab7-k2 ")).toBe("AB7K2");
    expect(normalizeTrackingCode("AB 7 K2")).toBe("AB7K2");
  });
});

describe("isTrackingCodeFormat", () => {
  it("accepts exactly five unambiguous characters", () => {
    expect(TRACKING_CODE_LENGTH).toBe(5);
    expect(isTrackingCodeFormat("AB7K2")).toBe(true);
    expect(isTrackingCodeFormat("ZZZZZ")).toBe(true);
  });

  it("rejects wrong lengths", () => {
    expect(isTrackingCodeFormat("AB7K")).toBe(false);
    expect(isTrackingCodeFormat("AB7K23")).toBe(false);
    expect(isTrackingCodeFormat("")).toBe(false);
  });

  it("rejects ambiguous characters I, O, 0, and 1", () => {
    expect(isTrackingCodeFormat("ABIK2")).toBe(false);
    expect(isTrackingCodeFormat("ABOK2")).toBe(false);
    expect(isTrackingCodeFormat("AB0K2")).toBe(false);
    expect(isTrackingCodeFormat("AB1K2")).toBe(false);
  });

  it("rejects lowercase input and punctuation", () => {
    expect(isTrackingCodeFormat("ab7k2")).toBe(false);
    expect(isTrackingCodeFormat("AB-72")).toBe(false);
    expect(isTrackingCodeFormat("PO123")).toBe(false);
  });
});
