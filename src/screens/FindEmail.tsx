import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../i18n";
import { CountrySelect } from "../components/ui/CountrySelect";
import { authApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { useVerification, mmss } from "../hooks/verification";
import { ApiError, errorMessage } from "../lib/http";
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
  const { t } = useTranslation();
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
      setNameErr(t("findEmail.nameRequired"));
      return;
    }
    if (localPhone.replace(/\D/g, "").length < 7) {
      setPhoneErr(t("findEmail.phoneInvalid"));
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
      // Only the backend's account-not-found result gets the dedicated screen;
      // every other error (bad/expired OTP, network, server, …) keeps the
      // existing toast handling. The consumed verification session is cleared
      // so a new lookup requires re-verifying.
      if (e instanceof ApiError && e.status === 404 && e.code === "user_not_found") {
        phoneV.reset();
        setVerifiedFor(null);
        // Push (not replace) so Back / 다시 입력하기 pop cleanly to this form.
        nav("/find-email/no-match", { state: { noMatch: true } });
      } else {
        toast.error(errorMessage(e));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen findemail">
      <div className="findemail__scroll">
        <div className="findemail__inner">
          <button className="findemail__back" onClick={() => nav(-1)} aria-label={t("common.back")}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <h1 className="findemail__title">{t("findEmail.title")}</h1>
          <p className="findemail__subtitle">{t("findEmail.subtitle")}</p>

          {/* Name */}
          <div className="findemail__field">
            <label className="findemail__label" htmlFor="fe-name">
              {t("findEmail.nameLabel")}
            </label>
            <input
              id="fe-name"
              className={`findemail__input ${nameErr ? "is-error" : ""}`}
              placeholder={t("findEmail.namePlaceholder")}
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
              {t("findEmail.phoneLabel")}
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
                placeholder={t("findEmail.phonePlaceholder")}
                aria-label={t("findEmail.phoneA11y")}
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
                aria-label={t("findEmail.requestCodeA11y")}
              >
                {phoneV.verified ? t("findEmail.verified") : phoneV.cooldown > 0 ? `${phoneV.cooldown}s` : t("findEmail.verify")}
              </button>
            </div>
            {phoneErr && <p className="findemail__err">{phoneErr}</p>}
          </div>

          {/* Verification code — rendered ONLY after a code has actually
              been requested. `phoneV.requested` is the shared hook's gate:
              true only once the server returned a verification_id, so a
              failed request leaves the field hidden and the timer off. */}
          {phoneV.requested && (
          <div className="findemail__field">
            <label className="findemail__label" htmlFor="fe-code">
              {t("findEmail.codeLabel")}
            </label>
            <div className="findemail__row">
              <div className="findemail__code findemail__input--flex">
                <input
                  id="fe-code"
                  className="findemail__code-input"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder={t("findEmail.codePlaceholder")}
                  aria-label={t("findEmail.codeA11y")}
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
                aria-label={t("findEmail.checkCodeA11y")}
              >
                {phoneV.verified ? t("findEmail.checkDone") : t("findEmail.check")}
              </button>
            </div>
            {phoneV.error && <p className="findemail__err">{phoneV.error}</p>}
          </div>
          )}

          <div className="findemail__spacer" />

          <button
            type="button"
            className="findemail__submit"
            onClick={submit}
            disabled={!canSubmit}
            aria-disabled={!canSubmit}
            aria-label={t(canSubmit ? "findEmail.submit" : "findEmail.submitBlockedA11y")}
          >
            {busy ? <span className="spinner" style={{ width: 22, height: 22, borderWidth: 2.5 }} /> : t("findEmail.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
