import { describe, expect, it } from "vitest";
import {
  birthDateValid,
  cardDigits,
  cardNumberValid,
  detectCardBrand,
  formatCardNumber,
  formatExpiryInput,
  isExpired,
  luhnValid,
  parseExpiry,
  validateInternationalCard,
} from "./cardInput";

describe("card number", () => {
  it("keeps digits only, capped at 19", () => {
    expect(cardDigits("4242-4242 4242 4242")).toBe("4242424242424242");
    expect(cardDigits("1".repeat(25))).toHaveLength(19);
  });

  it("applies the Luhn check the server applies", () => {
    expect(luhnValid("4242424242424242")).toBe(true);
    expect(luhnValid("5555555555554444")).toBe(true);
    expect(luhnValid("3530111333300000")).toBe(true);
    expect(luhnValid("4242424242424241")).toBe(false);
    expect(cardNumberValid("42424242")).toBe(false); // too short even if it checks out
  });

  it.each([
    ["4242", "visa"],
    ["5555", "mastercard"],
    ["2221", "mastercard"],
    ["2720", "mastercard"],
    ["3782", "amex"],
    ["3530", "jcb"],
    ["3056", "diners"],
    ["3600", "diners"],
    ["6011", "discover"],
    ["6445", "discover"],
    ["6500", "discover"],
    ["6200", "unionpay"],
    ["9999", null],
  ])("detects %s as %s", (prefix, brand) => {
    expect(detectCardBrand(prefix)).toBe(brand);
  });

  it("groups digits for display", () => {
    expect(formatCardNumber("4242424242424242")).toBe("4242 4242 4242 4242");
    expect(formatCardNumber("378282246310005")).toBe("3782 822463 10005");
    expect(formatCardNumber("424")).toBe("424");
  });
});

describe("expiry", () => {
  it("formats typing into MM/YY", () => {
    expect(formatExpiryInput("7")).toBe("07");
    expect(formatExpiryInput("073")).toBe("07/3");
    expect(formatExpiryInput("07/31")).toBe("07/31");
    expect(formatExpiryInput("073199")).toBe("07/31");
  });

  it("parses MM/YY to a four-digit year and rejects bad months", () => {
    expect(parseExpiry("07/31")).toEqual({ month: 7, year: 2031 });
    expect(parseExpiry("13/31")).toBeNull();
    expect(parseExpiry("0731")).toBeNull();
  });

  it("treats the current month as still valid", () => {
    const now = new Date(2026, 8, 29); // September 2026
    expect(isExpired(9, 2026, now)).toBe(false);
    expect(isExpired(8, 2026, now)).toBe(true);
    expect(isExpired(1, 2027, now)).toBe(false);
  });
});

describe("birth date", () => {
  it("accepts YYMMDD only", () => {
    expect(birthDateValid("900101")).toBe(true);
    expect(birthDateValid("901301")).toBe(false);
    expect(birthDateValid("900100")).toBe(false);
    expect(birthDateValid("19900101")).toBe(false);
  });
});

describe("validateInternationalCard", () => {
  const now = new Date(2026, 8, 29);
  const ok = { currency: "USD", cardNumber: "4242424242424242", expiry: "07/31", birthDate: "" };

  it("passes a complete form", () => {
    expect(validateInternationalCard(ok, false, now)).toEqual({});
  });

  it("reports each field's problem", () => {
    expect(validateInternationalCard({ ...ok, cardNumber: "" }, false, now)).toEqual({ cardNumber: "required" });
    expect(validateInternationalCard({ ...ok, cardNumber: "4242424242424241" }, false, now)).toEqual({ cardNumber: "invalid" });
    expect(validateInternationalCard({ ...ok, expiry: "08/26" }, false, now)).toEqual({ expiry: "expired" });
    expect(validateInternationalCard({ ...ok, expiry: "7" }, false, now)).toEqual({ expiry: "invalid" });
    expect(validateInternationalCard({ ...ok, currency: "" }, false, now)).toEqual({ currency: "required" });
  });

  it("requires the birth date only when asked", () => {
    expect(validateInternationalCard(ok, true, now)).toEqual({ birthDate: "required" });
    expect(validateInternationalCard({ ...ok, birthDate: "90010" }, true, now)).toEqual({ birthDate: "invalid" });
    expect(validateInternationalCard({ ...ok, birthDate: "900101" }, true, now)).toEqual({});
  });
});
