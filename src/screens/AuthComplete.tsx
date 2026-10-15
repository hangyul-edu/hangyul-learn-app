import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation, type TranslationKey } from "../i18n";
import { authApi } from "../api/endpoints";
import { useLoginFlow } from "../hooks/loginFlow";
import {
  REAUTH_RETURN_TO,
  savePendingReauth,
  takeClientVerifier,
  takeSocialPurpose,
} from "../hooks/socialLogin";
import { isSignupPending, savePendingSignup, SOCIAL_SIGNUP_PHONE_PATH } from "../hooks/socialSignup";
import { LoadingState, ErrorState } from "../components/ui/states";
import type { SocialProvider } from "../lib/types";

/**
 * Landing page for the social-login callback. The backend has already verified
 * the provider identity; it redirected here with a single-use `login_code` (or
 * a `social_error`). We swap the code — together with the verifier saved when
 * this browser started the login — for the real tokens and route the user
 * onward via the normal login flow. A first sign-in whose email matched no
 * account gets a sign-up ticket instead: no account exists yet, and the phone
 * step decides which account it signs in to.
 *
 * A re-authentication (`purpose=reauth`, confirming an account deletion)
 * lands here too, with a `reauth_code` instead: it is passed — with the
 * verifier — to the More screen, which completes the deletion.
 */
const ERROR_TEXT: Record<string, TranslationKey> = {
  cancelled: "authComplete.cancelled",
  invalid_state: "authComplete.invalidState",
  not_configured: "authComplete.notConfigured",
  provider_unavailable: "authComplete.providerUnavailable",
  email_registered: "authComplete.emailRegistered",
  account_inactive: "authComplete.accountInactive",
  login_failed: "authComplete.loginFailed",
};

export function AuthComplete() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const completeLogin = useLoginFlow();
  const nav = useNavigate();
  const ran = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const socialError = params.get("social_error");
    const loginCode = params.get("login_code");
    const reauthCode = params.get("reauth_code");
    // Always consume the verifier, so a stale one never outlives this attempt.
    const verifier = takeClientVerifier();
    const purpose = takeSocialPurpose();
    if (purpose === "reauth" || reauthCode) {
      // A re-authentication to confirm an account deletion: no session is
      // issued. Hand the outcome to the More screen, which finishes (or
      // explains) the deletion.
      const provider = params.get("provider") as SocialProvider | null;
      if (reauthCode && verifier && provider && !socialError) {
        savePendingReauth({ provider, reauth_code: reauthCode, client_verifier: verifier });
      } else {
        savePendingReauth({ error: socialError || "login_failed" });
      }
      nav(REAUTH_RETURN_TO, { replace: true });
      return;
    }
    if (socialError) {
      setError(socialError);
      return;
    }
    if (!loginCode || !verifier) {
      // No verifier: this browser did not start the login (or lost its
      // storage) — never redeem someone else's login code.
      setError(loginCode ? "invalid_state" : "login_failed");
      return;
    }
    (async () => {
      try {
        const res = await authApi.socialExchange(loginCode, verifier);
        if (isSignupPending(res)) {
          savePendingSignup(res);
          nav(SOCIAL_SIGNUP_PHONE_PATH, { replace: true });
          return;
        }
        await completeLogin(res, true); // stores tokens + routes by next_step
      } catch {
        setError("login_failed");
      }
    })();
    // Intentionally run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="screen">
        <div className="screen__body" style={{ display: "grid", placeItems: "center" }}>
          <ErrorState
            message={t(ERROR_TEXT[error] ?? ERROR_TEXT.login_failed)}
            onRetry={() => nav("/welcome", { replace: true })}
          />
        </div>
      </div>
    );
  }
  return (
    <div className="screen">
      <div className="screen__body" style={{ display: "grid", placeItems: "center" }}>
        <LoadingState text={t("authComplete.loading")} />
      </div>
    </div>
  );
}
