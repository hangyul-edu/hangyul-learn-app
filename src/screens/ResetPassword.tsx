import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { authApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import { passwordProblem } from "../lib/validation";

/**
 * "비밀번호 재설정" — second stage of password reset. Consumes the short-lived
 * reset-authorization token issued by FindPassword (via navigation state, never
 * persisted / never in the URL), collects the new password + confirmation, and
 * calls the existing reset API. On success it replaces the stack to login so
 * Back can't return to the consumed form.
 *
 * Reuses the `.findemail` root (tokens / scroll / back / spacer) with
 * `.resetpw__*` for the faithful field + button treatment.
 */
export function ResetPassword() {
  const nav = useNavigate();
  const toast = useToast();
  const location = useLocation();
  const resetToken = (location.state as { reset_token?: string } | null)?.reset_token;

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  // Opened without a valid reset token → back to the recovery form.
  if (!resetToken) return <Navigate to="/forgot" state={{ mode: "password" }} replace />;

  const pwProblem = passwordProblem(pw);
  const mismatch = pw2.length > 0 && pw !== pw2;
  const canSubmit = !pwProblem && pw2.length > 0 && pw === pw2 && !busy;

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    setBusy(true);
    try {
      await authApi.resetPassword(resetToken!, pw, pw2);
      // Clear sensitive values, then replace the stack to login.
      setPw("");
      setPw2("");
      toast.success("비밀번호를 변경했어요");
      nav("/login", { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen findemail resetpw">
      <form className="findemail__scroll" onSubmit={submit}>
        <div className="findemail__inner">
          <button type="button" className="findemail__back" onClick={() => nav(-1)} aria-label="뒤로">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <h1 className="findemail__title">비밀번호 재설정</h1>

          {/* New password */}
          <div className="resetpw__field resetpw__field--first">
            <label className="resetpw__label" htmlFor="rp-pw">
              비밀번호
            </label>
            <input
              id="rp-pw"
              className={`resetpw__input ${touched && pwProblem ? "is-error" : ""}`}
              type="password"
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              placeholder="영어, 숫자, 특수문자 포함 8자리 이상을 입력하세요"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
            />
            {touched && pwProblem && <p className="findemail__err">{pwProblem}</p>}
          </div>

          {/* Confirm password */}
          <div className="resetpw__field resetpw__field--second">
            <label className="resetpw__label" htmlFor="rp-pw2">
              비밀번호 재입력
            </label>
            <input
              id="rp-pw2"
              className={`resetpw__input ${mismatch ? "is-error" : ""}`}
              type="password"
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              placeholder="비밀번호를 다시 입력하세요"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
            />
            {mismatch && <p className="findemail__err">비밀번호가 일치하지 않아요.</p>}
          </div>

          <div className="findemail__spacer" />

          <button
            type="submit"
            className="resetpw__submit"
            disabled={!canSubmit}
            aria-disabled={!canSubmit}
            aria-label="비밀번호 재설정하기"
          >
            {busy ? <span className="spinner" style={{ width: 22, height: 22, borderWidth: 2.5 }} /> : "비밀번호 재설정하기"}
          </button>
        </div>
      </form>
    </div>
  );
}
