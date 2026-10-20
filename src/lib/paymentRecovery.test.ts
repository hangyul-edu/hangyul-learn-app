import { describe, expect, it } from "vitest";
import { ApiError } from "./http";
import { failureModalKeys, noticeReasonKey, retryBlockedKey, retryRefusal } from "./paymentRecovery";

describe("failure classes", () => {
  it("treats an unreadable billing key as an unusable method (register it again)", () => {
    expect(noticeReasonKey("billing_key_unreadable")).toBe("paymentRecovery.reasonMethodRevoked");
    expect(failureModalKeys("billing_key_unreadable")).toEqual([
      "paymentRecovery.failUnusableTitle",
      "paymentRecovery.failUnusableSub",
    ]);
    expect(noticeReasonKey("something_new")).toBe("paymentRecovery.reasonGeneric");
  });
});

describe("retryBlockedKey", () => {
  it("maps each refusal reason to its explanation", () => {
    expect(retryBlockedKey("cooldown")).toBe("paymentRecovery.blockedCooldown");
    expect(retryBlockedKey("daily_limit")).toBe("paymentRecovery.blockedDailyLimit");
    expect(retryBlockedKey("attempt_cap")).toBe("paymentRecovery.blockedAttemptCap");
    expect(retryBlockedKey("in_progress")).toBe("paymentRecovery.blockedInProgress");
    expect(retryBlockedKey("no_payment_method")).toBe("paymentRecovery.blockedNeedsMethod");
    expect(retryBlockedKey("method_unusable")).toBe("paymentRecovery.blockedNeedsMethod");
    expect(retryBlockedKey("cancelled")).toBe("paymentRecovery.blockedCancelled");
    expect(retryBlockedKey("obsolete")).toBe("paymentRecovery.blockedClosed");
    expect(retryBlockedKey(null)).toBe("paymentRecovery.blockedClosed");
  });
});

describe("retryRefusal", () => {
  it("reads the reason and retry time of a limits refusal", () => {
    const e = new ApiError(429, "billing.retry_limit_reached", "x", {
      reason: "cooldown",
      retry_after: "2026-07-16T00:41:00Z",
    });
    expect(retryRefusal(e)).toEqual({ reason: "cooldown", retryAfter: "2026-07-16T00:41:00Z" });
  });

  it("covers the method and closed-invoice refusals", () => {
    expect(retryRefusal(new ApiError(409, "billing.retry_needs_new_method", "x", { reason: "no_payment_method" })))
      .toEqual({ reason: "no_payment_method", retryAfter: null });
    expect(retryRefusal(new ApiError(409, "billing.invoice_not_retryable", "x"))).toEqual({
      reason: "closed",
      retryAfter: null,
    });
  });

  it("is null for anything else (paid, in progress, network)", () => {
    expect(retryRefusal(new ApiError(409, "billing.cannot_retry_paid", "x"))).toBeNull();
    expect(retryRefusal(new ApiError(409, "billing.charge_in_progress", "x"))).toBeNull();
    expect(retryRefusal(new Error("boom"))).toBeNull();
    expect(retryRefusal(undefined)).toBeNull();
  });
});
