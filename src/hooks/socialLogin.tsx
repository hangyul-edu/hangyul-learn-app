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

export function useSocialLogin(): { start: (provider: SocialProvider) => Promise<void> } {
  async function start(provider: SocialProvider) {
    const verifier = newClientVerifier();
    storeVerifier(verifier);
    const challenge = await clientChallenge(verifier);
    // Leave the SPA and enter the provider's authorization flow. `return_to`
    // is a same-site path the backend validates against open redirects.
    window.location.assign(authApi.socialStartUrl(provider, challenge, "/"));
  }

  return { start };
}
