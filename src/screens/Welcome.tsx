import { useNavigate } from "react-router-dom";
import { useTranslation } from "../i18n";
import {
  HangyulLogo,
  AuthDecor,
  GoogleIcon,
  AppleIcon,
  FacebookIcon,
  KakaoIcon,
  LineIcon,
} from "../components/brand/AuthBrand";
import { useSocialLogin } from "../hooks/socialLogin";

/**
 * Single-screen authentication landing — the first screen an unauthenticated
 * user sees. Every action routes to its existing flow:
 *   로그인 → /login · 회원가입 → /signup · social → useSocialLogin
 *   이메일 찾기 / 비밀번호 찾기 → /forgot (email / password mode)
 * All content fits one mobile screen; flexible spacers absorb the slack so
 * short devices don't clip or scroll.
 */
export function Welcome() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const social = useSocialLogin();

  return (
    <div className="screen auth">
      <AuthDecor />

      <div className="auth__inner">
        <div className="auth__grow auth__grow--top" />

        <div className="auth__brand">
          <HangyulLogo />
          <p className="auth__tagline">{t("login.tagline")}</p>
        </div>

        <div className="auth__grow auth__grow--mid" />

        <div className="auth__actions">
          <button className="auth__btn auth__btn--primary" onClick={() => nav("/login")}>
            {t("welcome.login")}
          </button>
          <button className="auth__btn auth__btn--outline" onClick={() => nav("/signup")}>
            {t("welcome.signup")}
          </button>
          <button
            className="auth__btn auth__btn--google"
            onClick={() => social.start("google")}
            aria-label={t("welcome.google")}
          >
            <span className="auth__btn-icon">
              <GoogleIcon />
            </span>
            {t("welcome.google")}
          </button>
          <button
            className="auth__btn auth__btn--apple"
            onClick={() => social.start("apple")}
            aria-label={t("welcome.apple")}
          >
            <span className="auth__btn-icon">
              <AppleIcon />
            </span>
            {t("welcome.apple")}
          </button>
        </div>

        <div className="auth__socials">
          <button
            className="auth__circle auth__circle--fb"
            onClick={() => social.start("facebook")}
            aria-label={t("welcome.facebook")}
          >
            <FacebookIcon />
          </button>
          <button
            className="auth__circle auth__circle--kakao"
            onClick={() => social.start("kakao")}
            aria-label={t("welcome.kakao")}
          >
            <KakaoIcon />
          </button>
          <button
            className="auth__circle auth__circle--line"
            onClick={() => social.start("line")}
            aria-label={t("welcome.line")}
          >
            <LineIcon />
          </button>
        </div>

        <div className="auth__grow auth__grow--bottom" />

        <div className="auth__recovery">
          <button className="auth__link" onClick={() => nav("/forgot", { state: { mode: "email" } })}>
            {t("login.findEmail")}
          </button>
          <button className="auth__link" onClick={() => nav("/forgot", { state: { mode: "password" } })}>
            {t("login.findPassword")}
          </button>
        </div>
      </div>
    </div>
  );
}
