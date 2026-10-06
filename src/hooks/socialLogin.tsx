import { authApi } from "../api/endpoints";
import type { SocialProvider } from "../lib/types";

/**
 * Social sign-in for the auth landing.
 *
 * `start(provider)` performs a full-page navigation to the backend's
 * `/auth/social/{provider}/start`, which redirects the browser to the
 * provider's **real** authorization screen. The provider returns to our
 * callback, the backend exchanges the code + issues our session server-side,
 * and the browser lands on `/auth/complete` where the one-time login code is
 * swapped for tokens (see `AuthComplete`). There is no token to paste.
 *
 * Browser binding: before leaving, we generate a random `client_verifier`,
 * keep it in this browser's storage and send only its SHA-256
 * (`client_challenge`). `/auth/complete` must present the verifier to redeem
 * the login code, so a login link someone else started (login CSRF) cannot
 * sign this browser in to their account.
 */

const VERIFIER_KEY = "hg-social-verifier";

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A 43-character URL-safe random value (32 bytes of entropy). */
export function newClientVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

/** BASE64URL(SHA-256(verifier)) without padding — what the server stores. */
export async function clientChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

// localStorage (not sessionStorage) so the value survives a provider that
// hands the login back in a new tab (e.g. app-to-web on mobile). Storage can
// be unavailable (private mode, blocked site data); then the login simply
// cannot be completed and the completion screen says so.
function storeVerifier(verifier: string): void {
  try {
    window.localStorage.setItem(VERIFIER_KEY, verifier);
  } catch {
    /* storage unavailable */
  }
}

/** Read and forget the verifier saved by `start` (single use). */
export function takeClientVerifier(): string | null {
  try {
    const value = window.localStorage.getItem(VERIFIER_KEY);
    window.localStorage.removeItem(VERIFIER_KEY);
    return value;
  } catch {
    return null;
  }
}

/* ---- Re-authentication (confirming an account deletion) ----
 *
 * An account created by social login has no password, so deleting it is
 * confirmed by signing in with the provider again. On the web that is the
 * same redirect round trip with `purpose=reauth`: the backend verifies the
 * identity but issues no session, and `/auth/complete` receives a single-use
 * `reauth_code`. It hands that code (with this browser's verifier) to the More
 * screen through sessionStorage, which then calls DELETE /auth/account.
 */

const PURPOSE_KEY = "hg-social-purpose";
const PENDING_REAUTH_KEY = "hg-withdraw-reauth";
/** Where the More screen lives; the round trip returns here. */
export const REAUTH_RETURN_TO = "/profile";

/** A re-authentication result waiting for the More screen. */
export type PendingReauth =
  | { provider: SocialProvider; reauth_code: string; client_verifier: string }
  | { error: string };

export async function startSocialReauth(provider: SocialProvider): Promise<void> {
  const verifier = newClientVerifier();
  storeVerifier(verifier);
  try {
    window.localStorage.setItem(PURPOSE_KEY, "reauth");
  } catch {
    /* storage unavailable */
  }
  const challenge = await clientChallenge(verifier);
  window.location.assign(authApi.socialStartUrl(provider, challenge, REAUTH_RETURN_TO, "reauth"));
}

/** Read and forget why this browser last left for the provider. */
export function takeSocialPurpose(): "login" | "reauth" {
  try {
    const value = window.localStorage.getItem(PURPOSE_KEY);
    window.localStorage.removeItem(PURPOSE_KEY);
    return value === "reauth" ? "reauth" : "login";
  } catch {
    return "login";
  }
}

export function savePendingReauth(pending: PendingReauth): void {
  try {
    window.sessionStorage.setItem(PENDING_REAUTH_KEY, JSON.stringify(pending));
  } catch {
    /* storage unavailable */
  }
}

/** Read and forget the pending re-authentication (single use). */
export function takePendingReauth(): PendingReauth | null {
  try {
    const raw = window.sessionStorage.getItem(PENDING_REAUTH_KEY);
    window.sessionStorage.removeItem(PENDING_REAUTH_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as PendingReauth;
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

export function useSocialLogin(): { start: (provider: SocialProvider) => Promise<void> } {
  async function start(provider: SocialProvider) {
    const verifier = newClientVerifier();
    storeVerifier(verifier);
    takeSocialPurpose(); // a plain login: drop any stale re-auth marker
    const challenge = await clientChallenge(verifier);
    // Leave the SPA and enter the provider's authorization flow. `return_to`
    // is a same-site path the backend validates against open redirects.
    window.location.assign(authApi.socialStartUrl(provider, challenge, "/"));
  }

  return { start };
}
