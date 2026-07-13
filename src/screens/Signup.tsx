import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CountrySelect } from "../components/ui/CountrySelect";
import { authApi } from "../api/endpoints";
import { useLoginFlow } from "../hooks/loginFlow";
import { useToast } from "../hooks/toast";
import { useVerification, mmss } from "../hooks/verification";
import { errorMessage } from "../lib/http";
import { NATIONALITIES } from "../lib/format";

function passwordProblem(p: string): string | null {
  if (p.length < 8 || p.length > 64) return "8~64자로 입력해 주세요.";
  if (!/[a-zA-Z]/.test(p) || !/[0-9]/.test(p) || !/[^a-zA-Z0-9]/.test(p))
    return "영문·숫자·특수문자를 모두 포함해야 해요.";
  return null;
}
function emailValid(e: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
}

type AgreeKey = "age" | "terms" | "privacy" | "third";
const AGREEMENTS: { key: AgreeKey; label: string; underline?: boolean }[] = [
  { key: "age", label: "[필수] 만 14세 이상 (미만 시 법정대리인 동의)" },
  { key: "terms", label: "회원이용약관 (필수)", underline: true },
  { key: "privacy", label: "개인정보수집 및 이용동의 (필수)" },
  { key: "third", label: "개인정보 제 3자 제공 동의 (필수)" },
];

export function Signup() {
  const nav = useNavigate();
  const toast = useToast();
  const completeLogin = useLoginFlow();
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [country, setCountry] = useState("KR");
  const [localPhone, setLocalPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [agree, setAgree] = useState({ age: false, terms: false, privacy: false, third: false });

  const dial = useMemo(() => NATIONALITIES.find((n) => n.code === country)?.dial ?? "+82", [country]);
  const e164 = useMemo(() => `${dial}${localPhone.replace(/^0+/, "").replace(/\D/g, "")}`, [dial, localPhone]);

  const phoneV = useVerification({
    start: () => authApi.startPhone(e164, "signup"),
    confirm: authApi.confirmPhone,
  });
  const emailV = useVerification({
    start: () => authApi.startEmail(email.trim()),
    confirm: authApi.confirmEmail,
  });

  const allAgreed = agree.age && agree.terms && agree.privacy && agree.third;

  function requestPhone() {
    if (localPhone.replace(/\D/g, "").length < 7) {
      setErrors((x) => ({ ...x, phone: "휴대폰 번호를 정확히 입력해 주세요." }));
      return;
    }
    setErrors((x) => ({ ...x, phone: "" }));
    void phoneV.request();
  }
  function requestEmail() {
    if (!emailValid(email)) {
      setErrors((x) => ({ ...x, email: "올바른 이메일 형식이 아니에요." }));
      return;
    }
    setErrors((x) => ({ ...x, email: "" }));
    void emailV.request();
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (name.trim().length < 1) e.name = "이름을 입력해 주세요.";
    if (!phoneV.verified) e.phone = "휴대폰 인증을 완료해 주세요.";
    if (!emailV.verified) e.email = "이메일 인증을 완료해 주세요.";
    const pw = passwordProblem(password);
    if (pw) e.password = pw;
    if (password !== confirm) e.confirm = "비밀번호가 일치하지 않아요.";
    if (!allAgreed) e.agree = "필수 약관에 모두 동의해 주세요.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submitSignup() {
    if (busy) return;
    if (!validate()) {
      toast.error("입력 정보를 다시 확인해 주세요.");
      return;
    }
    setBusy(true);
    try {
      const res = await authApi.signup({
        name: name.trim(),
        email: email.trim(),
        password,
        confirm_password: confirm,
        phone: e164,
        phone_verification_token: phoneV.token,
        email_verification_token: emailV.token,
        nationality: country,
        age_consent: agree.age,
        terms_accepted: agree.terms,
        privacy_accepted: agree.privacy,
        third_party_accepted: agree.third,
        marketing_opt_in: false,
        service_notification_opt_in: false,
        ad_notification_opt_in: false,
      });
      if (res.requires_login) {
        const token = await authApi.login(email.trim(), password, true);
        await completeLogin(token, true);
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function toggleAll() {
    const next = !allAgreed;
    setAgree({ age: next, terms: next, privacy: next, third: next });
  }

  return (
    <div className="screen signup">
      <div className="signup__scroll">
        <div className="signup__inner">
          <button className="signup__back" onClick={() => nav(-1)} aria-label="뒤로">
            <svg width="25" height="25" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <h1 className="signup__title">회원가입</h1>
          <p className="signup__subtitle">아래 정보들을 입력해주세요.</p>

          {/* Name */}
          <div className="signup__field">
            <label className="signup__label" htmlFor="su-name">
              이름
            </label>
            <input
              id="su-name"
              className={`signup__input ${errors.name ? "is-error" : ""}`}
              placeholder="이름을 입력하세요"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setName((n) => n.trim())}
            />
            {errors.name && <p className="signup__err">{errors.name}</p>}
          </div>

          {/* Phone */}
          <div className="signup__field">
            <label className="signup__label" htmlFor="su-phone">
              휴대폰번호
            </label>
            <div className="signup__row">
              <CountrySelect value={country} onChange={setCountry} />
              <input
                id="su-phone"
                className={`signup__input signup__input--flex ${errors.phone ? "is-error" : ""}`}
                inputMode="numeric"
                autoComplete="tel"
                placeholder="'-'를 제외하고 입력하세요"
                aria-label="휴대폰 번호"
                value={localPhone}
                onChange={(e) => setLocalPhone(e.target.value.replace(/\D/g, ""))}
                disabled={phoneV.verified}
              />
              <button
                type="button"
                className="signup__pill"
                onClick={requestPhone}
                disabled={phoneV.sending || phoneV.cooldown > 0 || phoneV.verified}
                aria-label="휴대폰 인증번호 요청"
              >
                {phoneV.verified ? "인증완료" : phoneV.cooldown > 0 ? `${phoneV.cooldown}s` : "인증하기"}
              </button>
            </div>
            {errors.phone && <p className="signup__err">{errors.phone}</p>}
          </div>

          {/* Phone code */}
          <div className="signup__field">
            <label className="signup__label" htmlFor="su-phone-code">
              인증번호 입력
            </label>
            <div className="signup__row">
              <div className="signup__code signup__input--flex">
                <input
                  id="su-phone-code"
                  className="signup__code-input"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="인증번호 6자리를 입력하세요"
                  aria-label="휴대폰 인증번호"
                  value={phoneV.code}
                  onChange={(e) => phoneV.setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  disabled={!phoneV.requested || phoneV.verified}
                />
                <span className="signup__timer" aria-hidden="true">
                  {mmss(phoneV.requested && !phoneV.verified ? phoneV.secondsLeft : 0)}
                </span>
              </div>
              <button
                type="button"
                className="signup__pill signup__pill--sm"
                onClick={phoneV.confirmCode}
                disabled={phoneV.code.length !== 6 || phoneV.confirming || phoneV.verified}
                aria-label="휴대폰 인증번호 확인"
              >
                {phoneV.verified ? "완료" : "확인"}
              </button>
            </div>
            {phoneV.error && <p className="signup__err">{phoneV.error}</p>}
          </div>

          {/* Email */}
          <div className="signup__field">
            <label className="signup__label" htmlFor="su-email">
              이메일
            </label>
            <div className="signup__row">
              <input
                id="su-email"
                className={`signup__input signup__input--flex ${errors.email ? "is-error" : ""}`}
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="이메일을 입력하세요"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setEmail((v) => v.trim())}
                disabled={emailV.verified}
              />
              <button
                type="button"
                className="signup__pill"
                onClick={requestEmail}
                disabled={emailV.sending || emailV.cooldown > 0 || emailV.verified}
                aria-label="이메일 인증번호 요청"
              >
                {emailV.verified ? "인증완료" : emailV.cooldown > 0 ? `${emailV.cooldown}s` : "인증하기"}
              </button>
            </div>
            {errors.email && <p className="signup__err">{errors.email}</p>}
          </div>

          {/* Email code */}
          <div className="signup__field">
            <label className="signup__label" htmlFor="su-email-code">
              인증번호 입력
            </label>
            <div className="signup__row">
              <div className="signup__code signup__input--flex">
                <input
                  id="su-email-code"
                  className="signup__code-input"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="인증번호 6자리를 입력하세요"
                  aria-label="이메일 인증번호"
                  value={emailV.code}
                  onChange={(e) => emailV.setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  disabled={!emailV.requested || emailV.verified}
                />
                <span className="signup__timer" aria-hidden="true">
                  {mmss(emailV.requested && !emailV.verified ? emailV.secondsLeft : 0)}
                </span>
              </div>
              <button
                type="button"
                className="signup__pill signup__pill--sm"
                onClick={emailV.confirmCode}
                disabled={emailV.code.length !== 6 || emailV.confirming || emailV.verified}
                aria-label="이메일 인증번호 확인"
              >
                {emailV.verified ? "완료" : "확인"}
              </button>
            </div>
            {emailV.error && <p className="signup__err">{emailV.error}</p>}
          </div>

          {/* Password */}
          <div className="signup__field">
            <label className="signup__label" htmlFor="su-pw">
              비밀번호
            </label>
            <input
              id="su-pw"
              className={`signup__input ${errors.password ? "is-error" : ""}`}
              type="password"
              autoComplete="new-password"
              placeholder="영어, 숫자, 특수문자 포함 8자리 이상을 입력하세요"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {errors.password && <p className="signup__err">{errors.password}</p>}
          </div>

          {/* Password confirm */}
          <div className="signup__field">
            <label className="signup__label" htmlFor="su-pw2">
              비밀번호 확인
            </label>
            <input
              id="su-pw2"
              className={`signup__input ${errors.confirm ? "is-error" : ""}`}
              type="password"
              autoComplete="new-password"
              placeholder="비밀번호를 다시 입력하세요"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {errors.confirm && <p className="signup__err">{errors.confirm}</p>}
          </div>

          {/* Terms */}
          <div className="signup__terms">
            <h2 className="signup__terms-title">약관동의</h2>

            <button
              type="button"
              className="signup__agree signup__agree--all"
              role="checkbox"
              aria-checked={allAgreed}
              onClick={toggleAll}
            >
              <span className="signup__agree-label signup__agree-label--all">전체 동의</span>
              <span className={`signup__check signup__check--dark ${allAgreed ? "is-on" : ""}`} aria-hidden="true">
                <CheckMark />
              </span>
            </button>

            {AGREEMENTS.map((a) => {
              const checked = agree[a.key];
              return (
                <div key={a.key} className="signup__agree">
                  <span className={`signup__agree-label ${a.underline ? "signup__agree-label--link" : ""}`}>
                    {a.label}
                  </span>
                  <button
                    type="button"
                    className="signup__agree-box"
                    role="checkbox"
                    aria-checked={checked}
                    aria-label={a.label}
                    onClick={() => setAgree((s) => ({ ...s, [a.key]: !s[a.key] }))}
                  >
                    <span className={`signup__check signup__check--pale ${checked ? "is-on" : ""}`} aria-hidden="true">
                      <CheckMark pale />
                    </span>
                  </button>
                </div>
              );
            })}
            {errors.agree && <p className="signup__err">{errors.agree}</p>}
          </div>

          <button className="signup__submit" type="button" onClick={submitSignup} disabled={busy} aria-label="회원가입">
            {busy ? <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2.5 }} /> : "회원가입"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckMark({ pale }: { pale?: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M5 12.5l4.5 4.5L19 7.5"
        stroke={pale ? "#9aa2a8" : "#fff"}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
