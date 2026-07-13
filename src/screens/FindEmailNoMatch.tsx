import { Navigate, useLocation, useNavigate } from "react-router-dom";

/**
 * "No matching account" result — shown only when the email lookup returns the
 * backend's account-not-found result (404 `user_not_found`). It carries no
 * account data; a state marker guards against direct/stale navigation.
 *
 * Reuses the `.findemail` root (tokens / scroll / back / bottom button) with
 * `.fenm__*` for the result-specific text.
 */
export function FindEmailNoMatch() {
  const nav = useNavigate();
  const location = useLocation();
  const valid = (location.state as { noMatch?: boolean } | null)?.noMatch === true;

  // Opened without a valid account-not-found result → back to the lookup form.
  if (!valid) return <Navigate to="/forgot" state={{ mode: "email" }} replace />;

  return (
    <div className="screen findemail fenm">
      <div className="findemail__scroll">
        <div className="findemail__inner">
          <button className="findemail__back" onClick={() => nav(-1)} aria-label="뒤로">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <h1 className="fenm__title">
            일치하는 회원정보가
            <br />
            없어요
          </h1>
          <p className="fenm__desc">
            입력하신 회원정보와 일치하는 계정을 찾을 수 없어요
            <br />
            정보를 다시 확인해주세요
          </p>

          <div className="fenm__prompt-row">
            <span className="fenm__prompt">처음이신가요?</span>
            <button type="button" className="fenm__link" onClick={() => nav("/signup")}>
              회원가입하기
            </button>
          </div>

          <div className="findemail__spacer" />

          <button
            type="button"
            className="findemail__submit"
            onClick={() => nav(-1)}
            aria-label="다시 입력하기, 이메일 찾기 화면으로 돌아가기"
          >
            다시 입력하기
          </button>
        </div>
      </div>
    </div>
  );
}
