import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { authApi } from "../api/endpoints";
import { useLoginFlow } from "../hooks/loginFlow";
import { LoadingState, ErrorState } from "../components/ui/states";

/**
 * Landing page for the social-login callback. The backend has already verified
 * the provider identity and issued our session; it redirected here with a
 * single-use `login_code` (or a `social_error`). We swap the code for the real
 * tokens and route the user onward via the normal login flow.
 */
const ERROR_TEXT: Record<string, string> = {
  cancelled: "로그인을 취소했어요.",
  invalid_state: "로그인 세션이 만료되었어요. 다시 시도해 주세요.",
  not_configured: "이 제공자의 로그인이 아직 설정되지 않았어요.",
  login_failed: "로그인을 완료하지 못했어요. 다시 시도해 주세요.",
};

export function AuthComplete() {
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
            message={ERROR_TEXT[error] ?? ERROR_TEXT.login_failed}
            onRetry={() => nav("/welcome", { replace: true })}
          />
        </div>
      </div>
    );
  }
  return (
    <div className="screen">
      <div className="screen__body" style={{ display: "grid", placeItems: "center" }}>
        <LoadingState text="로그인 중…" />
      </div>
    </div>
  );
}
