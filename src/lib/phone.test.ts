import { describe, expect, it } from "vitest";
import {
  PHONE_COUNTRIES,
  adoptCountry,
  checkPhone,
  formatPhoneForDisplay,
  normalizeE164,
  phoneCountry,
  phoneExample,
  sanitizePhoneInput,
} from "./phone";

describe("phoneExample", () => {
  it("is each country's example mobile number as dialled at home, digits only", () => {
    expect(phoneExample("KR")).toMatch(/^010\d{8}$/);
    expect(phoneExample("US")).toBe("2015550123");
    expect(phoneExample("JP")).toBe("09012345678");
    expect(phoneExample("GB")).toBe("07400123456");
    expect(phoneExample("FR")).toBe("0612345678");
  });

  it("gives every supported country an example the phone fields accept", () => {
    for (const { code } of PHONE_COUNTRIES) {
      const example = phoneExample(code);
      expect(example, code).toMatch(/^\d+$/);
      expect(checkPhone(code, example).ok, `${code} ${example}`).toBe(true);
    }
  });

  it("falls back to the default country for an unknown code", () => {
    expect(phoneExample("ZZ")).toBe(phoneExample("KR"));
    expect(phoneExample(null)).toBe(phoneExample("KR"));
  });
});

describe("PHONE_COUNTRIES", () => {
  it("covers every country and territory with its calling code", () => {
    expect(PHONE_COUNTRIES.length).toBeGreaterThanOrEqual(240);
    const dial = (code: string) => PHONE_COUNTRIES.find((c) => c.code === code)?.dial;
    expect(dial("KR")).toBe("+82");
    expect(dial("US")).toBe("+1");
    expect(dial("CA")).toBe("+1"); // shared NANP code
    expect(dial("PR")).toBe("+1"); // territory under +1
    expect(dial("GU")).toBe("+1");
    expect(dial("RU")).toBe("+7");
    expect(dial("KZ")).toBe("+7");
    expect(dial("GB")).toBe("+44");
    expect(dial("GG")).toBe("+44");
    expect(dial("HK")).toBe("+852");
    expect(dial("MO")).toBe("+853");
    expect(dial("TW")).toBe("+886");
    expect(dial("XK")).toBe("+383");
    expect(dial("BQ")).toBe("+599");
    expect(dial("SX")).toBe("+1");
    expect(dial("AC")).toBe("+247");
    expect(new Set(PHONE_COUNTRIES.map((c) => c.code)).size).toBe(PHONE_COUNTRIES.length);
  });

  it("builds flags from the ISO code", () => {
    expect(phoneCountry("KR").flag).toBe("🇰🇷");
    expect(phoneCountry("GB").flag).toBe("🇬🇧");
  });

  it("falls back to Korea for an unknown or missing code", () => {
    expect(phoneCountry("ZZ").code).toBe("KR");
    expect(phoneCountry(null).code).toBe("KR");
  });
});

describe("sanitizePhoneInput", () => {
  it("keeps digits and a leading plus only", () => {
    expect(sanitizePhoneInput("+82 (10) 1234-5678")).toBe("+821012345678");
    expect(sanitizePhoneInput("010.1234.5678")).toBe("01012345678");
    expect(sanitizePhoneInput("１２3")).toBe("3"); // full-width digits are not \d
    expect(sanitizePhoneInput("＋44 7911")).toBe("+447911");
    expect(sanitizePhoneInput("12+34")).toBe("1234");
  });
});

describe("checkPhone", () => {
  it.each([
    ["KR", "01012345678", "+821012345678"],
    ["KR", "1012345678", "+821012345678"], // trunk 0 omitted
    ["KR", "010-1234-5678", "+821012345678"],
    ["KR", "+82 010 1234 5678", "+821012345678"], // trunk 0 after the code
    ["GB", "07911 123456", "+447911123456"],
    ["IT", "312 345 6789", "+393123456789"],
    ["JP", "090-1234-5678", "+819012345678"],
    ["US", "(201) 555-0123", "+12015550123"],
    ["DE", "0044 7911 123456", "+447911123456"], // IDD from Germany
    ["KR", "+1 201 555 0123", "+12015550123"], // international, other country
    ["CN", "13123456789", "+8613123456789"],
  ])("%s %s → %s", (country, input, e164) => {
    expect(checkPhone(country, input)).toMatchObject({ ok: true, e164 });
  });

  it.each([
    ["KR", "", "empty"],
    ["KR", "010123", "tooShort"],
    ["KR", "0101234567890123", "tooLong"],
    ["US", "555 123 4567", "invalid"], // 555 is not an area code
    ["KR", "0212345678", "invalid"], // Seoul landline: no SMS
    ["US", "800 234 5678", "invalid"], // toll-free: no SMS
    ["IT", "06 1234 5678", "invalid"], // Rome landline: no SMS
  ])("%s %s → %s", (country, input, problem) => {
    expect(checkPhone(country, input)).toEqual({ ok: false, problem });
  });

  it("reports the number's own country", () => {
    expect(checkPhone("US", "416 555 0123")).toMatchObject({ ok: true, country: "CA" });
  });
});

describe("adoptCountry", () => {
  it("switches the picker to a pasted number's calling code", () => {
    expect(adoptCountry("KR", "+44 7400 123456")).toEqual({ country: "GB", national: "07400123456" });
  });

  it("keeps the picker when the calling code already matches", () => {
    expect(adoptCountry("KR", "+82 10 1234 5678")).toEqual({ country: "KR", national: "01012345678" });
    expect(adoptCountry("US", "+1 416 555 0123")).toEqual({ country: "US", national: "4165550123" });
  });

  it("does nothing for national input or an incomplete international number", () => {
    expect(adoptCountry("KR", "01012345678")).toBeNull();
    expect(adoptCountry("KR", "+4479")).toBeNull();
  });
});

describe("normalizeE164", () => {
  it("matches the server's canonical form", () => {
    expect(normalizeE164("KR", "010-1234-5678")).toBe("+821012345678");
    expect(normalizeE164("IT", "312 345 6789")).toBe("+393123456789");
  });
  it("falls back to dial code + digits for an unrecognised number", () => {
    expect(normalizeE164("KR", "0001234")).toBe("+821234");
  });
});

describe("formatPhoneForDisplay", () => {
  it("shows Korean numbers domestically and others internationally", () => {
    expect(formatPhoneForDisplay("+821012345678")).toBe("010-1234-5678");
    expect(formatPhoneForDisplay("+12015550123")).toBe("+1 201 555 0123");
    expect(formatPhoneForDisplay("+447911123456")).toBe("+44 7911 123456");
  });
});
