import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CountrySelect } from "../components/ui/CountrySelect";
import { authApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { useVerification, mmss } from "../hooks/verification";
import { errorMessage } from "../lib/http";
import { NATIONALITIES } from "../lib/format";

function emailValid(e: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
}

/**
 * "비밀번호 찾기" — first stage of password reset: verify the registered email
 * + phone (SMS, purpose `reset_password`), then exchange the verified phone
 * token for a backend reset-authorization token and hand off to the new-password
 * screen. This screen never changes the password itself.
 *
 * Rendered by the `/forgot` route (Forgot dispatcher) when mode === "password".
 * Reuses the `.findemail__*` styles (identical visual system).
 */
export function FindPassword() {
  const nav = useNavigate();
  const toast = useToast();

  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("KR");
  const [localPhone, setLocalPhone] = useState("");
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [phoneErr, setPhoneErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const dial = useMemo(() => NATIONALITIES.find((n) => n.code === country)?.dial ?? "+82", [country]);
  const e164 = useMemo(() => `${dial}${localPhone.replace(/^0+/, "").replace(/\D/g, "")}`, [dial, localPhone]);

  const phoneV = useVerification({
    start: () => authApi.startPhone(e164, "reset_password"),
    confirm: authApi.confirmPhone,
  });

  // Snapshot the phone identity that was verified; changing phone/country
  // invalidates it so a stale code/token can't be submitted.
  const [verifiedFor, setVerifiedFor] = useState<{ e164: string; country: string } | null>(null);
  useEffect(() => {
    if (phoneV.verified) setVerifiedFor({ e164, country });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneV.verified]);

  // Any change to an identity-tied value invalidates SMS verification and
  // requires re-verifying (email is validated together with the phone at reset).
  function invalidateOnChange() {
    if (phoneV.requested || phoneV.verified) phoneV.reset();
    setVerifiedFor(null);
  }

  const verifiedMatches =
    phoneV.verified && !!verifiedFor && verifiedFor.e164 === e164 && verifiedFor.country === country;

  const canSubmit = emailValid(email.trim()) && verifiedMatches && !busy;

  function requestSms() {
    if (!emailValid(email.trim())) {
      setEmailErr("올바른 이메일 형식이 아니에요.");
      return;
    }
    if (localPhone.replace(/\D/g, "").length < 7) {
      setPhoneErr("휴대폰 번호를 정확히 입력해 주세요.");
      return;
    }
    setEmailErr(null);
    setPhoneErr(null);
    void phoneV.request();
  }

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      // Backend validates the email + verified phone belong to one account and
      // issues a short-lived reset-authorization token.
      const res = await authApi.resetVerify(email.trim(), phoneV.token);
      phoneV.reset();
      setVerifiedFor(null);
      nav("/reset-password", { state: { reset_token: res.reset_token } });
    } catch (e) {
      // Generic handling for all failures (mismatch, expired, network, …) so we
      // never reveal whether the email/phone exists.
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen findemail">
      <div className="findemail__scroll">
        <div className="findemail__inner">
          <button className="findemail__back" onClick={() => nav(-1)} aria-label="뒤로">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <h1 className="findemail__title">비밀번호 찾기</h1>
          <p className="findemail__subtitle">가입 시 입력한 이메일과 휴대폰번호를 입력해주세요.</p>

          {/* Email */}
          <div className="findemail__field">
            <label className="findemail__label" htmlFor="fp-email">
              이메일
            </label>
            <input
              id="fp-email"
              className={`findemail__input ${emailErr ? "is-error" : ""}`}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="이메일을 입력하세요"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailErr(null);
                invalidateOnChange();
              }}
              onBlur={() => setEmail((v) => v.trim())}
            />
            {emailErr && <p className="findemail__err">{emailErr}</p>}
          </div>

          {/* Phone */}
          <div className="findemail__field">
            <label className="findemail__label" htmlFor="fp-phone">
              휴대폰번호
            </label>
            <div className="findemail__row">
              <CountrySelect
                value={country}
                onChange={(c) => {
                  setCountry(c);
                  invalidateOnChange();
                }}
                className="findemail__country"
              />
              <input
                id="fp-phone"
                className={`findemail__input findemail__input--flex ${phoneErr ? "is-error" : ""}`}
                inputMode="numeric"
                autoComplete="tel"
                placeholder="'-'를 제외하고 입력하세요"
                aria-label="휴대폰 번호"
                value={localPhone}
                onChange={(e) => {
                  setLocalPhone(e.target.value.replace(/\D/g, ""));
                  setPhoneErr(null);
                  invalidateOnChange();
                }}
                disabled={phoneV.verified}
              />
              <button
                type="button"
                className="findemail__pill"
                onClick={requestSms}
                disabled={phoneV.sending || phoneV.cooldown > 0 || phoneV.verified}
                aria-label="휴대폰 인증번호 요청"
              >
                {phoneV.verified ? "인증완료" : phoneV.cooldown > 0 ? `${phoneV.cooldown}s` : "인증하기"}
              </button>
            </div>
            {phoneErr && <p className="findemail__err">{phoneErr}</p>}
          </div>

          {/* Verification code */}
          <div className="findemail__field">
            <label className="findemail__label" htmlFor="fp-code">
              인증번호 입력
            </label>
            <div className="findemail__row">
              <div className="findemail__code findemail__input--flex">
                <input
                  id="fp-code"
                  className="findemail__code-input"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="인증번호 6자리를 입력하세요"
                  aria-label="인증번호"
                  value={phoneV.code}
                  onChange={(e) => phoneV.setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  disabled={!phoneV.requested || phoneV.verified}
                />
                <span className="findemail__timer" aria-hidden="true">
                  {mmss(phoneV.requested && !phoneV.verified ? phoneV.secondsLeft : 0)}
                </span>
              </div>
              <button
                type="button"
                className="findemail__pill findemail__pill--sm"
                onClick={phoneV.confirmCode}
                disabled={phoneV.code.length !== 6 || phoneV.confirming || phoneV.verified}
                aria-label="인증번호 확인"
              >
                {phoneV.verified ? "완료" : "확인"}
              </button>
            </div>
            {phoneV.error && <p className="findemail__err">{phoneV.error}</p>}
          </div>

          <div className="findemail__spacer" />

          <button
            type="button"
            className="findemail__submit"
            onClick={submit}
            disabled={!canSubmit}
            aria-disabled={!canSubmit}
            aria-label={canSubmit ? "비밀번호 재설정하기" : "이메일 확인과 휴대폰 인증을 완료해 주세요"}
          >
            {busy ? <span className="spinner" style={{ width: 22, height: 22, borderWidth: 2.5 }} /> : "비밀번호 재설정하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
