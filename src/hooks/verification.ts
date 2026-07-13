import { useCallback, useEffect, useRef, useState } from "react";
import { secondsUntil } from "../lib/format";
import { errorMessage } from "../lib/http";
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
      setError(errorMessage(e));
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
      setExpiresAt(null);
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
