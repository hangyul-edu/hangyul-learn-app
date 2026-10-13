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
});
