import { beforeEach, describe, expect, it } from "vitest";
import { setCurrentLanguage } from "../i18n/current";
import { ApiError, NetworkError, errorMessage } from "./http";
import { currencyMismatchMessage, intlCardError, paymentDeclinedMessage, paymentErrorMessage } from "./paymentErrors";
import { failureModalKeys, noticeReasonKey } from "./paymentRecovery";

beforeEach(() => setCurrentLanguage("ko"));

describe("currency mismatch copy", () => {
  it("points a KRW card at the overseas-card flow for a USD plan", () => {
    const e = new ApiError(422, "subscription.currency_mismatch", "raw", { card_currency: "KRW", plan_currency: "USD" });
    expect(paymentErrorMessage(e)).toBe("이 카드는 원화(KRW)로만 결제돼요. 미국 달러(USD) 요금제는 해외 카드로 등록해 주세요.");
  });

  it("names both currencies otherwise, in English too", () => {
    setCurrentLanguage("en");
    const e = new ApiError(422, "payment_method.currency_mismatch", "raw", { card_currency: "USD", subscription_currency: "KRW" });
    expect(currencyMismatchMessage(e)).toBe(
      "This card can only be charged in US dollars (USD). Pay for a plan billed in Korean won (KRW) with a card charged in Korean won (KRW).",
    );
  });

  it("leaves other errors to errorMessage", () => {
    expect(currencyMismatchMessage(new ApiError(409, "conflict", "Already"))).toBeNull();
    const other = new ApiError(409, "conflict", "Already");
    expect(paymentErrorMessage(other)).toBe(errorMessage(other));
  });
});

describe("first-charge decline (402 subscription.payment_declined)", () => {
  it("explains the decline from the server's failure_class", () => {
    const e = new ApiError(402, "subscription.payment_declined", "raw", {
      invoice_id: "inv_1",
      failure_class: "insufficient_funds",
      failure_code: "EXCEED_MAX_AMOUNT",
    });
    expect(paymentErrorMessage(e)).toBe("잔액 부족으로 결제가 진행되지 않았어요 다른 결제수단을 선택하거나 잔액을 확인해 주세요");
  });

  it("falls back to the generic wording without a known class, and ignores other errors", () => {
    expect(paymentDeclinedMessage(new ApiError(402, "subscription.payment_declined", "raw"))).toBe(
      "구독료 결제가 진행되지 않았어요 다른 카드를 선택하거나 잠시 후 다시 시도해 주세요",
    );
    expect(paymentDeclinedMessage(new ApiError(409, "subscription.already_active", "raw"))).toBeNull();
  });
});

describe("intlCardError", () => {
  it("keeps the idempotency key only when the outcome is unknown", () => {
    expect(intlCardError(new NetworkError()).retrySameKey).toBe(true);
    expect(intlCardError(new ApiError(502, "payment_method.provider_unavailable", "x")).retrySameKey).toBe(true);
    expect(intlCardError(new ApiError(422, "payment_method.card_declined", "x")).retrySameKey).toBe(false);
  });

  it("points validation errors at their field", () => {
    const e = new ApiError(422, "validation_error", "x", undefined, [{ loc: ["body", "expiry_month"], type: "less_than_equal" }]);
    expect(intlCardError(e).field).toBe("expiry");
    const expired = new ApiError(422, "validation_error", "x", undefined, [
      { loc: ["body", "expiry_year"], type: "card_expired", msg: "card has expired" },
    ]);
    expect(intlCardError(expired)).toMatchObject({ field: "expiry", message: "유효기간이 지난 카드예요." });
    // Matched on type/loc, never on the wording of msg.
    const reworded = new ApiError(422, "validation_error", "x", undefined, [{ loc: ["body"], msg: "card has expired" }]);
    expect(intlCardError(reworded).field).toBeUndefined();
  });

  it("classifies not-configured and changed currencies", () => {
    expect(intlCardError(new ApiError(503, "payment_method.provider_not_configured", "x")).kind).toBe("unavailable");
    const changed = intlCardError(new ApiError(422, "payment_method.unsupported_currency", "x", { available_currencies: ["KRW"] }));
    expect(changed).toMatchObject({ kind: "currencies_changed", suggestCurrency: "KRW" });
  });
});

describe("billing recovery", () => {
  it("has its own copy for currency_mismatch", () => {
    expect(noticeReasonKey("currency_mismatch")).toBe("paymentRecovery.reasonCurrencyMismatch");
    expect(failureModalKeys("currency_mismatch")).toEqual(["paymentRecovery.failCurrencyTitle", "paymentRecovery.failCurrencySub"]);
  });
});
