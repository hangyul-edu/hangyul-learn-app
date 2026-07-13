import { useNavigate } from "react-router-dom";
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
 *   이메일 찾기 / 비밀번호 찾기 → /forgot (email / password tab)
 * All content fits one mobile screen; flexible spacers absorb the slack so
 * short devices don't clip or scroll.
 */
export function Welcome() {
  const nav = useNavigate();
  const social = useSocialLogin();

  return (
    <div className="screen auth">
      <AuthDecor />

      <div className="auth__inner">
        <div className="auth__grow auth__grow--top" />

        <div className="auth__brand">
          <HangyulLogo />
          <p className="auth__tagline">작은 귤 한 조각처럼, 매일 한 문장씩</p>
        </div>

        <div className="auth__grow auth__grow--mid" />

        <div className="auth__actions">
          <button className="auth__btn auth__btn--primary" onClick={() => nav("/login")}>
            로그인
          </button>
          <button className="auth__btn auth__btn--outline" onClick={() => nav("/signup")}>
            회원가입
          </button>
          <button
            className="auth__btn auth__btn--outline"
            onClick={() => social.start("google")}
            aria-label="Google로 계속하기"
          >
            <span className="auth__btn-icon">
              <GoogleIcon />
            </span>
            Google로 계속하기
          </button>
          <button
            className="auth__btn auth__btn--apple"
            onClick={() => social.start("apple")}
            aria-label="Apple로 계속하기"
          >
            <span className="auth__btn-icon">
              <AppleIcon />
            </span>
            Apple로 계속하기
          </button>
        </div>

        <div className="auth__socials">
          <button
            className="auth__circle auth__circle--fb"
            onClick={() => social.start("facebook")}
            aria-label="Facebook으로 계속하기"
          >
            <FacebookIcon />
          </button>
          <button
            className="auth__circle auth__circle--kakao"
            onClick={() => social.start("kakao")}
            aria-label="Kakao로 계속하기"
          >
            <KakaoIcon />
          </button>
          <button
            className="auth__circle auth__circle--line"
            onClick={() => social.start("line")}
            aria-label="LINE으로 계속하기"
          >
            <LineIcon />
          </button>
        </div>

        <div className="auth__grow auth__grow--bottom" />

        <div className="auth__recovery">
          <button className="auth__link" onClick={() => nav("/forgot", { state: { mode: "email" } })}>
            이메일 찾기
          </button>
          <button className="auth__link" onClick={() => nav("/forgot", { state: { mode: "password" } })}>
            비밀번호 찾기
          </button>
        </div>
      </div>

      {social.element}
    </div>
  );
}
