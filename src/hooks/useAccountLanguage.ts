import { useEffect, useRef } from "react";
import { settingsApi } from "../api/endpoints";
import { useI18n } from "../i18n";
import { normalizeLanguage } from "../lib/language";
import { useAuth } from "./auth";

/**
 * Keeps the app's display language equal to the signed-in account's.
 *
 * Language Settings shows the account's `app_language` as selected, so the
 * app must be displayed in that same language. It used to be only a seed: the
 * first-run picker always stores a device language, which then won forever —
 * so after signing out and in (another account on the device, a change made
 * on another device, a new account still on the server default) the app was
 * in English while the settings page had 한국어 selected.
 *
 * Now, once the profile is loaded:
 *   - an account still in setup (no nickname yet — it was just created) takes
 *     the language picked on this device, saved to the account, so a new
 *     member keeps the language they chose before signing up;
 *   - any other account's language is applied to the app (and stored on the
 *     device for the next cold start).
 *
 * If saving a new account's language fails, nothing changes and it is tried
 * again on the next profile update; once setup is done the account's language
 * applies regardless, so the two can't stay apart.
 */
export function useAccountLanguage(): void {
  const { me, setMe } = useAuth();
  const { language, setLanguage } = useI18n();
  // Read through refs: the effect must re-run only when who is signed in or
  // their saved language changes — not when the app switches language, and
  // not on every render (`setMe` is a fresh function each time).
  const latest = useRef({ language, setLanguage, setMe });
  latest.current = { language, setLanguage, setMe };

  const signedIn = !!me;
  const account = me?.app_language;
  const settingUp = signedIn && !me?.nickname;
  const userId = me?.user_id;

  useEffect(() => {
    if (!signedIn || account == null) return;
    const accountLanguage = normalizeLanguage(account);
    const device = latest.current.language;
    if (accountLanguage === device) return;
    if (!settingUp) {
      latest.current.setLanguage(accountLanguage);
      return;
    }
    let cancelled = false;
    settingsApi
      .setLanguage(device)
      .then((res) => {
        // Signed out (or another account) meanwhile: the cleanup cancelled it.
        if (!cancelled) latest.current.setMe((prev) => ({ ...prev!, app_language: res.app_language }));
      })
      .catch(() => {
        /* retried on the next profile update; setup's end applies the account's */
      });
    return () => {
      cancelled = true;
    };
  }, [signedIn, userId, account, settingUp]);
}
