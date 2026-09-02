import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../i18n";
import { AuthDecor, HangyulLogo } from "../components/brand/AuthBrand";
import { authApi } from "../api/endpoints";
import { useLoginFlow } from "../hooks/loginFlow";
import { ApiError, errorMessage } from "../lib/http";

/**
 * Login screen — AME-003 (Figma KO 1:3436 / EN 784:50343).
 *
 * Back chevron, centered Hangyul logo + tagline, a left-aligned heading,
 * Gray 1 filled email/password fields, a Gray 7 "stay logged in" checkbox, an
 * orange submit button, and a centered find-email / forgot-password / sign-up
 * link row. The two frames share this geometry exactly and differ only in copy.
 *
 * All authentication logic is preserved: email/password state, auto-login
 * (default on), busy/loading guard, error handling (incl. 401), and the
 * existing login API + post-login routing via useLoginFlow.
 */
export function Login() {
  const { t } = useTranslation();
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
      setErr(t("login.missingFields"));
      return;
    }
    setBusy(true);
    try {
      const token = await authApi.login(email.trim(), password, autoLogin);
      await completeLogin(token, autoLogin);
    } catch (e2) {
      setErr(e2 instanceof ApiError && e2.status === 401 ? t("login.invalidCredentials") : errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen login">
      {/* The SAME background component the Login/Sign-up selection screen uses,
          so the two screens are pixel-identical behind the UI and the transition
          is seamless. AME-003's own decor group (37:6847) sits 2 left and 4 down
          from AME-002's, and the glow 10 further left; that difference is
          deliberately not reproduced — one shared implementation was asked for. */}
      <AuthDecor />

      <div className="login__scroll">
        <div className="login__inner">
          <button className="login__back" onClick={() => nav(-1)} aria-label={t("common.back")}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="login__brand">
            <HangyulLogo />
            <p className="auth__tagline">{t("login.tagline")}</p>
          </div>

          <h1 className="login__heading">{t("login.heading")}</h1>

          <form className="login__form" onSubmit={submit}>
            <div className="login__field">
              <label className="login__label" htmlFor="login-email">
                {t("login.emailLabel")}
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
                placeholder={t("login.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="login__field">
              <label className="login__label" htmlFor="login-password">
                {t("login.passwordLabel")}
              </label>
              <input
                id="login-password"
                className="login__input"
                type="password"
                autoComplete="current-password"
                placeholder={t("login.passwordPlaceholder")}
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
              <span className="login__check-label">{t("login.autoLogin")}</span>
            </button>

            <button className="login__submit" type="submit" disabled={busy} aria-label={t("login.submit")}>
              {busy ? <span className="spinner" style={{ width: 22, height: 22, borderWidth: 2.5 }} /> : t("login.submit")}
            </button>
          </form>

          <div className="login__links">
            <button className="login__link" onClick={() => nav("/forgot", { state: { mode: "email" } })}>
              {t("login.findEmail")}
            </button>
            <button className="login__link" onClick={() => nav("/forgot", { state: { mode: "password" } })}>
              {t("login.findPassword")}
            </button>
            <button className="login__link" onClick={() => nav("/signup")}>
              {t("login.signup")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
