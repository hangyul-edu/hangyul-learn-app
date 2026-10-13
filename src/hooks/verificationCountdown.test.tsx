/**
 * A confirmed code shows no countdown — not even `00:00`.
 *
 * Every verification flow (sign-up phone, sign-up email, find-email,
 * find-password, change-phone, change-email) renders its timer from one rule,
 * `countdownLabel`. It returns `null` rather than a zero string so callers can
 * omit the element entirely: a timer that has nothing left to count should
 * disappear, and `00:00` reads as "your code just expired", which is the
 * opposite of what happened.
 *
 * `00:00` is still correct for a code that genuinely ran out unverified, so
 * these tests pin both halves of the rule.
 */
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { countdownLabel, mmss, useVerification } from "./verification";
import type { VerificationConfirm, VerificationStart } from "../lib/types";
import { ApiError } from "../lib/http";
import { resolveMessage } from "../i18n/current";

/* ------------------------------ the rule -------------------------------- */

describe("countdownLabel", () => {
  it("shows the remaining time while a code is pending", () => {
    expect(countdownLabel(180, { requested: true, verified: false })).toBe("03:00");
    expect(countdownLabel(9, { requested: true, verified: false })).toBe("00:09");
  });

  it("shows nothing before a code has been requested", () => {
    expect(countdownLabel(0, { requested: false, verified: false })).toBeNull();
    expect(countdownLabel(180, { requested: false, verified: false })).toBeNull();
  });

  it("shows nothing once the code is confirmed", () => {
    expect(countdownLabel(42, { requested: true, verified: true })).toBeNull();
  });

  it("shows nothing when success lands exactly as the timer reaches zero", () => {
    // The boundary the bug lived on: 0 seconds left AND verified.
    expect(countdownLabel(0, { requested: true, verified: true })).toBeNull();
  });

  it("still shows 00:00 for a code that expired without being confirmed", () => {
    // Not the bug — this is the state 00:00 is actually meant to describe.
    expect(countdownLabel(0, { requested: true, verified: false })).toBe("00:00");
  });

  it("never emits a negative or malformed label", () => {
    expect(mmss(-5)).toBe("00:00");
    expect(countdownLabel(-5, { requested: true, verified: false })).toBe("00:00");
  });
});

/* ------------------------- the hook that uses it ------------------------- */

function inSeconds(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

/** Renders the hook and exposes its value, plus the code input it needs. */
function mountVerification(opts: {
  expiresInSeconds: number;
  confirm?: () => Promise<VerificationConfirm>;
}) {
  const api: { current: ReturnType<typeof useVerification> | null } = { current: null };
  const start = vi.fn(
    async (): Promise<VerificationStart> => ({
      verification_id: "evr_1",
      expires_at: inSeconds(opts.expiresInSeconds),
      resend_available_at: inSeconds(0),
    }),
  );
  const confirm =
    opts.confirm ?? (async (): Promise<VerificationConfirm> => ({ verification_token: "tok" }));

  function Screen() {
    api.current = useVerification({ start, confirm });
    return <span data-testid="countdown">{api.current.countdown ?? ""}</span>;
  }
  const view = render(<Screen />);
  return { api, view, start };
}

async function requestAndConfirm(api: {
  current: ReturnType<typeof useVerification> | null;
}) {
  await act(async () => {
    await api.current!.request();
  });
  act(() => api.current!.setCode("123456"));
  await act(async () => {
    await api.current!.confirmCode();
  });
}

describe("useVerification", () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it("counts down while the code is pending", async () => {
    const { api, view } = mountVerification({ expiresInSeconds: 180 });

    await act(async () => {
      await api.current!.request();
    });

    expect(api.current!.countdown).toBe("03:00");
    expect(view.getByTestId("countdown").textContent).toBe("03:00");
  });

  it("stops showing a countdown the moment the code is confirmed", async () => {
    const { api, view } = mountVerification({ expiresInSeconds: 180 });

    await requestAndConfirm(api);

    expect(api.current!.verified).toBe(true);
    expect(api.current!.countdown).toBeNull();
    expect(view.getByTestId("countdown").textContent).toBe("");
  });

  it("leaves no stale seconds behind after success", async () => {
    const { api } = mountVerification({ expiresInSeconds: 180 });

    await requestAndConfirm(api);

    expect(api.current!.secondsLeft).toBe(0);
  });

  it("never renders 00:00 once verified, even as the clock runs past expiry", async () => {
    // Success one second before expiry, then let real time march past it: a
    // ticker left running would repaint the timer at 00:00.
    const { api, view } = mountVerification({ expiresInSeconds: 1 });

    await requestAndConfirm(api);
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(view.getByTestId("countdown").textContent).toBe("");
    expect(api.current!.countdown).toBeNull();
  });

  it("keeps counting when confirmation fails, so the learner can retry", async () => {
    const { api, view } = mountVerification({
      expiresInSeconds: 180,
      confirm: () => Promise.reject(new Error("invalid code")),
    });

    await requestAndConfirm(api);

    expect(api.current!.verified).toBe(false);
    expect(view.getByTestId("countdown").textContent).toMatch(/^0[23]:\d\d$/);
  });

  it("hides the countdown again after reset", async () => {
    const { api, view } = mountVerification({ expiresInSeconds: 180 });
    await act(async () => {
      await api.current!.request();
    });

    act(() => api.current!.reset());

    expect(view.getByTestId("countdown").textContent).toBe("");
  });
});

describe("useVerification errors", () => {
  it("explains a number that cannot receive SMS in the learner's language", async () => {
    const api: { current: ReturnType<typeof useVerification> | null } = { current: null };
    const start = vi.fn(async (): Promise<VerificationStart> => {
      throw new ApiError(422, "phone_number_undeliverable", "This phone number cannot receive a verification SMS.");
    });
    function Screen() {
      api.current = useVerification({ start, confirm: vi.fn() });
      return null;
    }
    render(<Screen />);
    await act(async () => {
      await api.current!.request();
    });
    expect(api.current!.error).toBe(resolveMessage("httpError.phoneUndeliverable"));
    expect(api.current!.error).not.toContain("cannot receive a verification SMS");
  });

  it("runs the resend countdown from the server's cooldown answer", async () => {
    const api: { current: ReturnType<typeof useVerification> | null } = { current: null };
    const start = vi.fn(async (): Promise<VerificationStart> => {
      throw new ApiError(429, "rate_limited", "Please wait 42 seconds before requesting another code.", {
        reason: "resend_cooldown",
        retry_after_seconds: 42,
        resend_available_at: new Date(Date.now() + 42_000).toISOString(),
      });
    });
    function Screen() {
      api.current = useVerification({ start, confirm: vi.fn() });
      return null;
    }
    render(<Screen />);
    await act(async () => {
      await api.current!.request();
    });
    expect(api.current!.cooldown).toBe(42);
    expect(api.current!.error).toContain("42");
  });
});
