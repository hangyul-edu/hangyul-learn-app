import { describe, expect, it } from "vitest";
import { formatNoticeListDate, formatNoticeDetailDate } from "./format";

describe("notice date formatters", () => {
  it("formats the list date as yy.MM.dd in the display timezone", () => {
    expect(formatNoticeListDate("2026-06-29T00:00:00+09:00")).toBe("26.06.29");
  });

  it("formats the detail date as yyyy.MM.dd", () => {
    expect(formatNoticeDetailDate("2026-06-29T00:00:00+09:00")).toBe("2026.06.29");
  });

  it("converts to the product timezone (KST) rather than slicing the string", () => {
    // 2026-06-28T15:00Z == 2026-06-29 00:00 KST → the KST calendar day.
    expect(formatNoticeListDate("2026-06-28T15:00:00Z")).toBe("26.06.29");
    expect(formatNoticeDetailDate("2026-06-28T15:00:00Z")).toBe("2026.06.29");
  });

  it("returns an empty string for missing or invalid dates (never throws)", () => {
    expect(formatNoticeListDate(undefined)).toBe("");
    expect(formatNoticeListDate(null)).toBe("");
    expect(formatNoticeListDate("not-a-date")).toBe("");
    expect(formatNoticeDetailDate("")).toBe("");
  });
});
