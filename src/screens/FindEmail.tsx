import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CountrySelect } from "../components/ui/CountrySelect";
import { authApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { useVerification, mmss } from "../hooks/verification";
import { errorMessage } from "../lib/http";
import { NATIONALITIES } from "../lib/format";

/**
 * "이메일 찾기" — recover the account email from the name + a phone number
 * verified by SMS (purpose `recover_email`). Faithful single-screen layout;
 * all logic reuses the existing verification + recovery APIs.
 *
 * Rendered by the `/forgot` route (Forgot.tsx) when mode === "email", so the
 * separate password-reset flow is left untouched.
 */
export function FindEmail() {
  const nav = useNavigate();
  const toast = useToast();

  const [name, setName] = useState("");
  const [country, setCountry] = useState("KR");
  const [localPhone, setLocalPhone] = useState("");
  const [nameErr, setNameErr] = useState<string | null>(null);
  const [phoneErr, setPhoneErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const dial = useMemo(() => NATIONALITIES.find((n) => n.code === country)?.dial ?? "+82", [country]);
  const e164 = useMemo(() => `${dial}${localPhone.replace(/^0+/, "").replace(/\D/g, "")}`, [dial, localPhone]);

  const phoneV = useVerification({
    start: () => authApi.startPhone(e164, "recover_email"),
    confirm: authApi.confirmPhone,
  });

  // Snapshot the identity that was verified; changing any of it invalidates the
  // verification so a stale code/token can't be submitted.
  const [verifiedFor, setVerifiedFor] = useState<{ name: string; e164: string; country: string } | null>(null);
  useEffect(() => {
    if (phoneV.verified) setVerifiedFor({ name: name.trim(), e164, country });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneV.verified]);

  function invalidateOnChange() {
    if (phoneV.requested || phoneV.verified) phoneV.reset();
    setVerifiedFor(null);
  }

  const verifiedMatches =
    phoneV.verified &&
    !!verifiedFor &&
    verifiedFor.e164 === e164 &&
    verifiedFor.country === country &&
    verifiedFor.name === name.trim();

  const canSubmit = name.trim().length > 0 && verifiedMatches && !busy;

  function requestSms() {
    if (name.trim().length < 1) {
      setNameErr("이름을 입력해 주세요.");
      return;
    }
    if (localPhone.replace(/\D/g, "").length < 7) {
      setPhoneErr("휴대폰 번호를 정확히 입력해 주세요.");
      return;
    }
    setNameErr(null);
    setPhoneErr(null);
    void phoneV.request();
  }

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const res = await authApi.recoverEmail(phoneV.token, name.trim());
      // The backend returns a pre-masked address; pass it (only) to the result
      // screen via navigation state — not persisted anywhere.
      nav("/find-email/result", { state: { email: res.email } });
    } catch (e) {
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

          <h1 className="findemail__title">이메일 찾기</h1>
          <p className="findemail__subtitle">가입 시 입력한 이름과 휴대폰번호를 입력해주세요.</p>

          {/* Name */}
          <div className="findemail__field">
            <label className="findemail__label" htmlFor="fe-name">
              이름
            </label>
            <input
              id="fe-name"
              className={`findemail__input ${nameErr ? "is-error" : ""}`}
              placeholder="이름을 입력하세요"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameErr(null);
                invalidateOnChange();
              }}
              onBlur={() => setName((n) => n.trim())}
            />
            {nameErr && <p className="findemail__err">{nameErr}</p>}
          </div>

          {/* Phone */}
          <div className="findemail__field">
            <label className="findemail__label" htmlFor="fe-phone">
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
                id="fe-phone"
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
            <label className="findemail__label" htmlFor="fe-code">
              인증번호 입력
            </label>
            <div className="findemail__row">
              <div className="findemail__code findemail__input--flex">
                <input
                  id="fe-code"
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
            aria-label={canSubmit ? "이메일 찾기" : "휴대폰 인증을 완료하면 이메일을 찾을 수 있어요"}
          >
            {busy ? <span className="spinner" style={{ width: 22, height: 22, borderWidth: 2.5 }} /> : "이메일 찾기"}
          </button>
        </div>
      </div>
    </div>
  );
}
