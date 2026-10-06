import { useCallback, useEffect, useRef, useState } from "react";
import { secondsUntil } from "../lib/format";
import { ApiError, errorMessage } from "../lib/http";
import { resolveMessage } from "../i18n/current";
import type { VerificationStart, VerificationConfirm } from "../lib/types";

/**
 * Inline "request a code → enter 6 digits → confirm" verification, used by the
 * sign-up screen for phone and email independently.
 *
 * Wraps the existing verification APIs (`authApi.startPhone/confirmPhone`,
 * `authApi.startEmail/confirmEmail`) — no request logic is duplicated here. The
 * countdown (`secondsLeft`) is derived from the server's `expires_at`, and the
 * resend cooldown from `resend_available_at`, so the timer duration and cooldown
 * come from the backend, not invented locally.
 *
 * `requested` is the canonical gate for the code UI: every screen renders its
 * code input, timer and confirm button ONLY while it is true. It flips on the
 * server's `verification_id`, which is assigned inside `request()`'s success
 * path, so:
 *   - before any request the field does not exist and no timer runs;
 *   - a FAILED request leaves it false, so the UI stays in its pre-request state
 *     and only `error` changes;
 *   - re-requesting overwrites `expires_at`, restarting the countdown, while
 *     `cooldown` (from `resend_available_at`) blocks spamming;
 *   - `reset()` — called when a verified identity field is edited — takes the UI
 *     back to hidden so a stale code or token can never be submitted.
 */
export function useVerification(opts: {
  start: () => Promise<VerificationStart>;
  confirm: (verificationId: string, code: string) => Promise<VerificationConfirm>;
}) {
  const { start, confirm } = opts;
  const [vid, setVid] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [verified, setVerified] = useState(false);
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const startRef = useRef(start);
  const confirmRef = useRef(confirm);
  startRef.current = start;
  confirmRef.current = confirm;

  // Countdown for the code lifetime (drives the MM:SS timer inside the input).
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setSecondsLeft(secondsUntil(expiresAt));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  // Resend cooldown ticker.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  /** Clear all verification state — call when a verified input (phone/country/
   *  name) changes so a stale code/token can't be reused. */
  const reset = useCallback(() => {
    setVid(null);
    setCode("");
    setExpiresAt(null);
    setSecondsLeft(0);
    setCooldown(0);
    setVerified(false);
    setToken("");
    setError(null);
  }, []);

  const request = useCallback(async () => {
    if (sending || cooldown > 0) return;
    setSending(true);
    setError(null);
    setCode("");
    setVerified(false);
    setToken("");
    try {
      const res = await startRef.current();
      setVid(res.verification_id);
      setExpiresAt(res.expires_at);
      setSecondsLeft(secondsUntil(res.expires_at));
      setCooldown(secondsUntil(res.resend_available_at) || 0);
    } catch (e) {
      // A number that can't receive SMS won't work on retry: say so in the
      // learner's language instead of the server's English wording.
      setError(
        e instanceof ApiError && e.code === "phone_number_undeliverable"
          ? resolveMessage("httpError.phoneUndeliverable")
          : errorMessage(e),
      );
    } finally {
      setSending(false);
    }
  }, [sending, cooldown]);

  const confirmCode = useCallback(async () => {
    if (!vid || code.length !== 6 || confirming || verified) return;
    setConfirming(true);
    setError(null);
    try {
      const res = await confirmRef.current(vid, code);
      setToken(res.verification_token);
      setVerified(true);
      // Clearing `expiresAt` tears down the ticking effect; zeroing the seconds
      // leaves no stale remainder behind it. Neither is what hides the timer —
      // `countdown` below does that — but a confirmed code genuinely has no
      // time left, so the state should not claim otherwise.
      setExpiresAt(null);
      setSecondsLeft(0);
    } catch (e) {
      setError(errorMessage(e));
      setCode("");
    } finally {
      setConfirming(false);
    }
  }, [vid, code, confirming, verified]);

  return {
    code,
    setCode,
    sending,
    confirming,
    /** true once a code has been requested (timer active / expired) */
    requested: !!vid,
    secondsLeft,
    /** MM:SS while the code is still pending, or null when nothing should show. */
    countdown: countdownLabel(secondsLeft, { requested: !!vid, verified }),
    cooldown,
    verified,
    token,
    error,
    request,
    confirmCode,
    reset,
  };
}

/** Format seconds as MM:SS (e.g. 180 → "03:00"). */
export function mmss(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

/**
 * The countdown label to render, or `null` when there is no countdown.
 *
 * A code that has been confirmed has no time left to run, so there is nothing
 * to show — not even `00:00`. Returning `null` rather than a zero string is
 * what keeps that out of the DOM: callers render the timer element only when
 * this is non-null, so a stale `secondsLeft` surviving one render past success
 * cannot appear either.
 *
 * Every verification flow shares this rule, including the ones that keep their
 * own timer state instead of using `useVerification`.
 */
export function countdownLabel(
  secondsLeft: number,
  { requested, verified }: { requested: boolean; verified: boolean },
): string | null {
  if (!requested || verified) return null;
  return mmss(secondsLeft);
}
