import { beforeEach, describe, expect, it } from "vitest";
import {
  hasReturnParams,
  parseRegistrationReturn,
  savePendingRegistration,
  takePendingRegistration,
} from "./paymentReturn";

beforeEach(() => sessionStorage.clear());

const pending = { provider: "naver_pay" as const, intentId: "pmi_1", customerKey: "cus_abc" };

describe("parseRegistrationReturn", () => {
  it("reads a Toss window's success redirect (card, Toss Pay, Naver Pay alike)", () => {
    expect(parseRegistrationReturn(pending, "?customerKey=cus_abc&authKey=a")).toEqual({
      kind: "authorized",
      authKey: "a",
      customerKey: "cus_abc",
    });
  });

  it("reads the failure redirect", () => {
    expect(parseRegistrationReturn(pending, "?code=PAY_PROCESS_CANCELED&message=m")).toEqual({
      kind: "failed",
      code: "PAY_PROCESS_CANCELED",
      message: "m",
    });
    expect(parseRegistrationReturn(pending, "?foo=1")).toBeNull();
  });

  it("refuses a return for another customerKey than the window was opened with", () => {
    expect(parseRegistrationReturn(pending, "?customerKey=cus_other&authKey=a")).toEqual({
      kind: "failed",
      code: "CUSTOMER_KEY_MISMATCH",
      message: null,
    });
    expect(parseRegistrationReturn(pending, "?authKey=a")).toMatchObject({ kind: "failed" });
  });

  it("recognises a window's return query", () => {
    expect(hasReturnParams("?authKey=a")).toBe(true);
    expect(hasReturnParams("?code=x")).toBe(true);
    expect(hasReturnParams("?tab=cards")).toBe(false);
  });
});

describe("pending registration", () => {
  it("is read once", () => {
    savePendingRegistration(pending);
    expect(takePendingRegistration()).toEqual(pending);
    expect(takePendingRegistration()).toBeNull();
  });
});
