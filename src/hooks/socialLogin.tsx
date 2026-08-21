import { useState, type ReactNode } from "react";
import { authApi } from "../api/endpoints";
import type { SocialProvider } from "../lib/types";

/**
 * Social sign-in, shared by the auth landing and the login screen.
 *
 * `start(provider)` performs a full-page navigation to the backend's
 * `/auth/social/{provider}/start`, which redirects the browser to the
 * provider's **real** authorization screen. The provider returns to our
 * callback, the backend exchanges the code + issues our session server-side,
 * and the browser lands on `/auth/complete` where the one-time login code is
 * swapped for tokens (see `AuthComplete`). There is no token to paste.
 *
 * `element` is kept for call-site compatibility (previously a token sheet) and
 * is now `null`.
 */
export function useSocialLogin(): {
  start: (provider: SocialProvider) => void;
  busy: boolean;
  element: ReactNode;
} {
  const [busy, setBusy] = useState(false);

  function start(provider: SocialProvider) {
    setBusy(true);
    // Leave the SPA and enter the provider's authorization flow. `return_to`
    // is a same-site path the backend validates against open redirects.
    window.location.assign(authApi.socialStartUrl(provider, "/"));
  }

  return { start, busy, element: null };
}
