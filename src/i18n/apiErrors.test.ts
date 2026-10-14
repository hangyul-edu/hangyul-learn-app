/**
 * Server errors reach members in the app's language: the server's English
 * `detail` is never shown, the problem's `details.reason` beats its `code`,
 * and a code the catalog doesn't know falls back to the status's message.
 */
import { afterEach, describe, expect, it } from "vitest";
import { ApiError, errorMessage, setErrorAudience } from "../lib/http";
import { setCurrentLanguage } from "./current";
import { apiErrorText } from "./apiErrors";
import { apiErrorsKo } from "./locales/apiErrors.ko";
import { apiErrorsEn } from "./locales/apiErrors.en";

afterEach(() => {
  setCurrentLanguage("ko");
  setErrorAudience("member");
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

});

describe("errorMessage in the admin portal", () => {
  it("words errors for operators in Korean, never the server's English", () => {
    setErrorAudience("admin");
    setCurrentLanguage("ko");
    const notEmpty = new ApiError(409, "conflict", "Course still has 2 series and 5 lecture(s); delete or move them first.", {
      reason: "course_not_empty",
      series: 2,
      lectures: 5,
    });
    expect(errorMessage(notEmpty)).toBe("과정에 시리즈 2개와 강의 5개가 남아 있어요. 먼저 삭제하거나 옮겨 주세요.");
  });

  it("falls back to the Korean member wording for errors members meet too", () => {
    setErrorAudience("admin");
    setCurrentLanguage("ko");
    expect(errorMessage(wrongCode)).toBe("인증번호가 맞지 않아요.");
    expect(errorMessage(new ApiError(404, "not_found", "Lecture 'x' not found."))).toBe("요청한 정보를 찾을 수 없어요.");
  });

  it("keeps the provider's own explanation where an operator needs it", () => {
    setErrorAudience("admin");
    const e = new ApiError(502, "llm.auth_failed", "OpenAI가 API 키를 거부했습니다. 키를 확인하세요.", {
      problem: "OpenAI가 API 키를 거부했습니다. 키를 확인하세요.",
    });
    expect(errorMessage(e)).toBe("AI 제공사가 요청을 거부했어요: OpenAI가 API 키를 거부했습니다. 키를 확인하세요.");
    // Without the explanation, the member's general sentence.
    expect(errorMessage(new ApiError(502, "llm.auth_failed", "x"))).toBe(apiErrorsKo.codes["llm.auth_failed"]);
  });

  it("joins a list into the sentence", () => {
    setErrorAudience("admin");
    const e = new ApiError(422, "settings.required_missing", "켜기 전에 필수 항목을 입력하세요.", {
      missing: ["Account ID", "API 토큰"],
    });
    expect(errorMessage(e)).toBe("켜기 전에 필수 항목을 입력해 주세요: Account ID, API 토큰");
    // An empty list leaves the slot unfilled: the code has no other sentence, so the status's.
    expect(errorMessage(new ApiError(422, "settings.required_missing", "x", { missing: [] }))).toBe(
      "요청을 처리하지 못했어요.",
    );
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
    expect(apiErrorText({ code: "auth.social_token_invalid" }, { language: "en" })).toBe(
      "We couldn't confirm your sign-in. Please try again.",
    );
  });
});
