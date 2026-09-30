import { describe, expect, it } from "vitest";
import { formatNoticeListDate, formatNoticeDetailDate } from "./format";

describe("notice date formatters", () => {
  it("formats the list date as yy.MM.dd", () => {
    expect(formatNoticeListDate("2026-06-29T00:00:00+09:00", "Asia/Seoul")).toBe("26.06.29");
  });

  it("formats the detail date as yyyy.MM.dd", () => {
    expect(formatNoticeDetailDate("2026-06-29T00:00:00+09:00", "Asia/Seoul")).toBe("2026.06.29");
  });

  it("shows the instant on the device's calendar rather than slicing the string", () => {
    // 2026-06-28T15:00Z is 29 June in Seoul and still 28 June in New York.
    expect(formatNoticeListDate("2026-06-28T15:00:00Z", "Asia/Seoul")).toBe("26.06.29");
    expect(formatNoticeDetailDate("2026-06-28T15:00:00Z", "America/New_York")).toBe("2026.06.28");
  });

  it("defaults to the device timezone", () => {
    const deviceDay = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date("2026-06-28T15:00:00Z"));
    expect(formatNoticeDetailDate("2026-06-28T15:00:00Z")).toBe(deviceDay.replace(/-/g, "."));
  });

  it("returns an empty string for missing or invalid dates (never throws)", () => {
    expect(formatNoticeListDate(undefined)).toBe("");
    expect(formatNoticeListDate(null)).toBe("");
    expect(formatNoticeListDate("not-a-date")).toBe("");
    expect(formatNoticeDetailDate("")).toBe("");
  });
});
