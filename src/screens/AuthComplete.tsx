import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation, type TranslationKey } from "../i18n";
import { authApi } from "../api/endpoints";
import { useLoginFlow } from "../hooks/loginFlow";
import { LoadingState, ErrorState } from "../components/ui/states";

/**
 * Landing page for the social-login callback. The backend has already verified
 * the provider identity and issued our session; it redirected here with a
 * single-use `login_code` (or a `social_error`). We swap the code for the real
 * tokens and route the user onward via the normal login flow.
 */
const ERROR_TEXT: Record<string, TranslationKey> = {
  cancelled: "authComplete.cancelled",
  invalid_state: "authComplete.invalidState",
  not_configured: "authComplete.notConfigured",
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
    if (socialError) {
      setError(socialError);
      return;
    }
    if (!loginCode) {
      setError("login_failed");
      return;
    }
    (async () => {
      try {
        const tokens = await authApi.socialExchange(loginCode);
        await completeLogin(tokens, true); // stores tokens + routes by next_step
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
