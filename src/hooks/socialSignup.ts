import type { SocialLoginResponse, SocialProvider, SocialSignupPending } from "../lib/types";

/**
 * A first social sign-in whose email matched no account creates nothing: the
 * server hands back a sign-up ticket, and the phone step verifies a number
 * before any account exists. The ticket waits here between the sign-in and
 * that step — in this tab's sessionStorage (survives a reload, never another
 * tab), and only until it is used, abandoned or expired.
 */
export const SOCIAL_SIGNUP_PHONE_PATH = "/signup/phone";

const KEY = "hg-social-signup";

export interface PendingSocialSignup {
  signupToken: string;
  provider: SocialProvider;
  /** Epoch ms after which the server no longer accepts the ticket. */
  expiresAt: number;
}

export function isSignupPending(res: SocialLoginResponse): res is SocialSignupPending {
  return "signup_token" in res;
}

export function savePendingSignup(pending: SocialSignupPending): void {
  const value: PendingSocialSignup = {
    signupToken: pending.signup_token,
    provider: pending.provider,
    expiresAt: Date.now() + pending.expires_in * 1000,
  };
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    /* storage blocked: the phone step then asks to sign in again */
  }
}

/** The ticket of the sign-up in progress, or null (none, or expired). */
export function loadPendingSignup(): PendingSocialSignup | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as PendingSocialSignup;
    if (!value.signupToken || !(value.expiresAt > Date.now())) {
      window.sessionStorage.removeItem(KEY);
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export function clearPendingSignup(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* nothing stored */
  }
}
