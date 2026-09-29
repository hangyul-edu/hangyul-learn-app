import { describe, expect, it } from "vitest";
import { formatMoney } from "./format";

// Amounts arrive in the currency's minor unit; KRW and JPY have none
// (src/modules/payment_methods/domain/currency.py).
describe("formatMoney", () => {
  it("treats KRW and JPY amounts as whole units", () => {
    expect(formatMoney(9900, "KRW")).toContain("9,900");
    expect(formatMoney(1200, "JPY")).toContain("1,200");
  });

  it("divides USD cents into dollars", () => {
    expect(formatMoney(599, "USD")).toContain("5.99");
  });
});
