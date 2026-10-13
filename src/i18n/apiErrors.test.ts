/**
 * Server errors reach members in the app's language: the server's English
 * `detail` is never shown, the problem's `details.reason` beats its `code`,
 * and a code the catalog doesn't know falls back to the status's message.
 */
import { afterEach, describe, expect, it } from "vitest";
import { ApiError, errorMessage, showServerErrorText } from "../lib/http";
import { setCurrentLanguage } from "./current";
import { apiErrorText } from "./apiErrors";
import { apiErrorsKo } from "./locales/apiErrors.ko";
import { apiErrorsEn } from "./locales/apiErrors.en";

afterEach(() => {
  setCurrentLanguage("ko");
  showServerErrorText(false);
});

const wrongCode = new ApiError(422, "phone_verification_failed", "Verification code is incorrect.", {
  reason: "code_incorrect",
});

describe("errorMessage for API errors", () => {
  it("shows the app's sentence in the selected language, not the server's English", () => {
    setCurrentLanguage("ko");
    expect(errorMessage(wrongCode)).toBe("인증번호가 맞지 않아요.");
    setCurrentLanguage("en");
    expect(errorMessage(wrongCode)).toBe("The code is incorrect.");
  });

  it("uses the code's sentence when the reason has none", () => {
    const e = new ApiError(422, "phone_verification_failed", "Phone verification token is invalid.");
    expect(errorMessage(e)).toBe(apiErrorsKo.codes.phone_verification_failed);
    const unknownReason = new ApiError(422, "phone_verification_failed", "x", { reason: "something_new" });
    expect(errorMessage(unknownReason)).toBe(apiErrorsKo.codes.phone_verification_failed);
  });

  it("fills the sentence from the problem's details", () => {
    const e = new ApiError(429, "rate_limited", "Please wait 42 seconds.", {
      reason: "resend_cooldown",
      retry_after_seconds: 42,
    });
    expect(errorMessage(e)).toBe("42초 후에 인증번호를 다시 요청할 수 있어요.");
  });

  it("never shows an unfilled slot: a reason missing its numbers falls back to the code", () => {
    const e = new ApiError(429, "rate_limited", "Please wait.", { reason: "resend_cooldown" });
    expect(errorMessage(e)).toBe(apiErrorsKo.codes.rate_limited);
  });

  it("gives an unknown code the message for its status", () => {
    expect(errorMessage(new ApiError(404, "brand_new_code", "No such thing."))).toBe("요청한 정보를 찾을 수 없어요.");
    expect(errorMessage(new ApiError(503, "brand_new_code", "Down."))).toBe(
      "일시적인 서버 오류예요. 잠시 후 다시 시도해 주세요.",
    );
    expect(errorMessage(new ApiError(400, "brand_new_code", "Bad."))).toBe("요청을 처리하지 못했어요.");
  });

  it("shows the server's own text in the admin portal", () => {
    showServerErrorText();
    expect(errorMessage(wrongCode)).toBe("Verification code is incorrect.");
  });
});

describe("the error catalogs", () => {
  it("cover the same codes and reasons in Korean and English, with the same slots", () => {
    const slots = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const part of ["codes", "reasons"] as const) {
      const ko = apiErrorsKo[part] as Record<string, string>;
      const en = apiErrorsEn[part] as Record<string, string>;
      expect(Object.keys(en).sort()).toEqual(Object.keys(ko).sort());
      for (const key of Object.keys(ko)) expect(slots(en[key]), key).toEqual(slots(ko[key]));
    }
  });

  it("looks up a dotted code as a whole", () => {
    expect(apiErrorText({ code: "auth.social_token_invalid" }, "en")).toBe(
      "We couldn't confirm your sign-in. Please try again.",
    );
  });
});
