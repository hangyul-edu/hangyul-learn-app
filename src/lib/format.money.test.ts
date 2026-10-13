import { describe, expect, it } from "vitest";
import { formatMoney } from "./format";

// Amounts arrive in the currency's minor unit; KRW and JPY have none
// (src/modules/payment_methods/domain/currency.py).
describe("formatMoney", () => {
  it("treats KRW and JPY amounts as whole units", () => {
    expect(formatMoney(9900, "KRW")).toBe("₩9,900");
    expect(formatMoney(154800, "krw")).toBe("₩154,800");
    expect(formatMoney(1200, "JPY")).toContain("1,200");
  });

  it("divides USD cents into dollars and always names them US$", () => {
    expect(formatMoney(599, "USD")).toBe("US$5.99");
    expect(formatMoney(7188, "usd")).toBe("US$71.88");
    expect(formatMoney(15588, "USD")).toBe("US$155.88");
    expect(formatMoney(100000, "USD")).toBe("US$1,000.00");
    expect(formatMoney(0, "USD")).toBe("US$0.00");
  });

  it("uses the bare symbol only when asked (narrow)", () => {
    expect(formatMoney(599, "USD", { narrow: true })).toBe("$5.99");
    expect(formatMoney(15588, "USD", { narrow: true })).toBe("$155.88");
    expect(formatMoney(69000, "KRW", { narrow: true })).toBe("₩69,000");
    expect(formatMoney(69000, "KRW", { narrow: true, language: "en" })).toBe("₩69,000");
  });

  it("writes won after the number in Korean copy (narrow, ko)", () => {
    expect(formatMoney(9900, "KRW", { narrow: true, language: "ko" })).toBe("9,900원");
    expect(formatMoney(118800, "KRW", { narrow: true, language: "ko" })).toBe("118,800원");
    expect(formatMoney(599, "USD", { narrow: true, language: "ko" })).toBe("$5.99");
    expect(formatMoney(9900, "KRW", { language: "ko" })).toBe("₩9,900"); // not narrow: unchanged
  });
});
