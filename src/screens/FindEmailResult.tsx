import { Navigate, useLocation, useNavigate } from "react-router-dom";

/**
 * Successful "이메일 찾기" result — shows the account email (already masked by
 * the backend's recover_email endpoint) and routes onward. The masked value
 * arrives via navigation state from FindEmail; it is not persisted anywhere.
 *
 * Reuses the `.findemail` root for the shared tokens / scroll / back / bottom
 * button, with `.feres__*` for the result-specific text.
 */
export function FindEmailResult() {
  const nav = useNavigate();
  const location = useLocation();
  const email = (location.state as { email?: string } | null)?.email;

  // Guard: opened without a valid lookup result → back to the lookup form.
  if (!email) return <Navigate to="/forgot" state={{ mode: "email" }} replace />;

  return (
    <div className="screen findemail feres">
      <div className="findemail__scroll">
        <div className="findemail__inner">
          <button className="findemail__back" onClick={() => nav(-1)} aria-label="뒤로">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <h1 className="feres__title">이메일을 찾았어요!</h1>
          <p className="feres__subtitle">다음 이메일로 가입되어 있어요.</p>

          <p className="feres__email" aria-label={`가입된 이메일 ${email}`}>
            {email}
          </p>

          <div className="feres__prompt-row">
            <span className="feres__prompt">비밀번호를 잊으셨나요?</span>
            <button
              type="button"
              className="feres__link"
              onClick={() => nav("/forgot", { state: { mode: "password" } })}
            >
              비밀번호 찾기
            </button>
          </div>

          <div className="findemail__spacer" />

          <button
            type="button"
            className="findemail__submit"
            onClick={() => nav("/login", { replace: true })}
            aria-label="로그인하러 가기"
          >
            로그인하러 가기
          </button>
        </div>
      </div>
    </div>
  );
}
