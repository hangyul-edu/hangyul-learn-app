import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { HangyulLogo, CitrusOutline } from "../components/brand/AuthBrand";
import { authApi } from "../api/endpoints";
import { useLoginFlow } from "../hooks/loginFlow";
import { ApiError, errorMessage } from "../lib/http";

/**
 * Login screen — faithful single-screen reproduction of the reference:
 * back chevron, centered Hangyul logo + slogan, left-aligned 로그인 heading,
 * filled email/password fields, a dark 자동로그인 checkbox, an orange login
 * button, and a centered 이메일 찾기 / 비밀번호 찾기 / 회원가입 link row.
 *
 * All authentication logic is preserved: email/password state, auto-login
 * (default on), busy/loading guard, error handling (incl. 401), and the
 * existing login API + post-login routing via useLoginFlow.
 */
export function Login() {
  const nav = useNavigate();
  const completeLogin = useLoginFlow();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [autoLogin, setAutoLogin] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!email.trim() || !password) {
      setErr("이메일과 비밀번호를 입력해 주세요.");
      return;
    }
    setBusy(true);
    try {
      const token = await authApi.login(email.trim(), password, autoLogin);
      await completeLogin(token, autoLogin);
    } catch (e2) {
      setErr(e2 instanceof ApiError && e2.status === 401 ? "이메일 또는 비밀번호가 올바르지 않아요." : errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen login">
      <div className="login__decor" aria-hidden="true">
        <div className="login__glow" />
        <CitrusOutline className="login__citrus login__citrus--tr" size={150} />
        <CitrusOutline className="login__citrus login__citrus--ml" size={120} />
        <CitrusOutline className="login__citrus login__citrus--br" size={180} />
      </div>

      <div className="login__scroll">
        <div className="login__inner">
          <button className="login__back" onClick={() => nav(-1)} aria-label="뒤로">
            <svg width="27" height="27" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="login__brand">
            <HangyulLogo />
            <p className="auth__tagline">작은 귤 한 조각처럼, 매일 한 문장씩</p>
          </div>

          <h1 className="login__heading">로그인</h1>

          <form className="login__form" onSubmit={submit}>
            <div className="login__field">
              <label className="login__label" htmlFor="login-email">
                이메일
              </label>
              <input
                id="login-email"
                className="login__input"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="이메일을 입력해주세요"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="login__field">
              <label className="login__label" htmlFor="login-password">
                비밀번호
              </label>
              <input
                id="login-password"
                className="login__input"
                type="password"
                autoComplete="current-password"
                placeholder="비밀번호를 입력해주세요"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {err && <div className="login__error">⚠ {err}</div>}

            <button
              type="button"
              className="login__check"
              role="checkbox"
              aria-checked={autoLogin}
              onClick={() => setAutoLogin((v) => !v)}
            >
              <span className={`login__check-box ${autoLogin ? "is-on" : ""}`} aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12.5l4.5 4.5L19 7.5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="login__check-label">자동로그인</span>
            </button>

            <button className="login__submit" type="submit" disabled={busy} aria-label="로그인">
              {busy ? <span className="spinner" style={{ width: 22, height: 22, borderWidth: 2.5 }} /> : "로그인"}
            </button>
          </form>

          <div className="login__links">
            <button className="login__link" onClick={() => nav("/forgot", { state: { mode: "email" } })}>
              이메일 찾기
            </button>
            <button className="login__link" onClick={() => nav("/forgot", { state: { mode: "password" } })}>
              비밀번호 찾기
            </button>
            <button className="login__link" onClick={() => nav("/signup")}>
              회원가입
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
