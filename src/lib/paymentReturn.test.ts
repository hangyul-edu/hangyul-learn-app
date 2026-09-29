import { beforeEach, describe, expect, it } from "vitest";
import {
  hasReturnParams,
  naverValuesFromText,
  parseRegistrationReturn,
  savePendingRegistration,
  takePendingRegistration,
} from "./paymentReturn";

beforeEach(() => sessionStorage.clear());

describe("parseRegistrationReturn", () => {
  it("reads Toss card's success and failure redirects", () => {
    expect(parseRegistrationReturn("toss_card", "?customerKey=c&authKey=a")).toEqual({ kind: "toss_card", authKey: "a" });
    expect(parseRegistrationReturn("toss_card", "?code=PAY_PROCESS_CANCELED&message=m")).toEqual({ kind: "failed", message: "m" });
    expect(parseRegistrationReturn("toss_card", "?foo=1")).toBeNull();
  });

  it("reads Naver Pay's resultCode redirect", () => {
    expect(parseRegistrationReturn("naver_pay", "?resultCode=Success&reserveId=r&tempReceiptId=t")).toEqual({
      kind: "naver_pay",
      reserveId: "r",
      tempReceiptId: "t",
    });
    expect(parseRegistrationReturn("naver_pay", "?resultCode=UserCancel&resultMessage=x&reserveId=r")).toEqual({ kind: "failed", message: "x" });
    // Success without tempReceiptId cannot be approved.
    expect(parseRegistrationReturn("naver_pay", "?resultCode=Success&reserveId=r")).toEqual({ kind: "failed", message: null });
  });

  it("recognises any provider's return query", () => {
    expect(hasReturnParams("?authKey=a")).toBe(true);
    expect(hasReturnParams("?resultCode=Success")).toBe(true);
    expect(hasReturnParams("?tab=cards")).toBe(false);
  });
});

describe("pending registration", () => {
  it("is read once", () => {
    savePendingRegistration({ provider: "naver_pay", intentId: "pmi_1" });
    expect(takePendingRegistration()).toEqual({ provider: "naver_pay", intentId: "pmi_1" });
    expect(takePendingRegistration()).toBeNull();
  });
});

describe("naverValuesFromText", () => {
  it("takes a pasted address, a query, or two values", () => {
    expect(naverValuesFromText("https://a/b?resultCode=Success&reserveId=r&tempReceiptId=t")).toEqual({ reserveId: "r", tempReceiptId: "t" });
    expect(naverValuesFromText("reserveId=r&tempReceiptId=t")).toEqual({ reserveId: "r", tempReceiptId: "t" });
    expect(naverValuesFromText("r, t")).toEqual({ reserveId: "r", tempReceiptId: "t" });
    expect(naverValuesFromText("r")).toBeNull();
  });
});
