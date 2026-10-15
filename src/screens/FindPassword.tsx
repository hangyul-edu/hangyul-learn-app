import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../i18n";
import { authApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { useVerification } from "../hooks/verification";
import { errorMessage } from "../lib/http";
import { checkPhone } from "../lib/phone";
import { usePhoneProblemMessage } from "../hooks/phoneProblem";
import { Spinner } from "../components/ui/Spinner";
import { BackChevronIcon } from "../components/brand/Glyphs";
import { isEmailLike } from "../lib/validation";
import { RecoveryPhoneFields } from "../components/RecoveryPhoneFields";

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
  const { t } = useTranslation();
  const nav = useNavigate();
  const toast = useToast();

  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("KR");
  const [localPhone, setLocalPhone] = useState("");
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [phoneErr, setPhoneErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const phoneMessage = usePhoneProblemMessage();
  const phone = useMemo(() => checkPhone(country, localPhone), [country, localPhone]);
  const e164 = phone.ok ? phone.e164 : "";

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

  const canSubmit = isEmailLike(email.trim()) && verifiedMatches && !busy;

  function requestSms() {
    if (!isEmailLike(email.trim())) {
      setEmailErr(t("findPassword.emailInvalid"));
      return;
    }
    if (!phone.ok) {
      setPhoneErr(phoneMessage(country, phone.problem));
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
          <button className="findemail__back" onClick={() => nav(-1)} aria-label={t("common.back")}>
            <BackChevronIcon />
          </button>

          <h1 className="findemail__title">{t("findPassword.title")}</h1>
          <p className="findemail__subtitle">{t("findPassword.subtitle")}</p>

          {/* Email */}
          <div className="findemail__field">
            <label className="findemail__label" htmlFor="fp-email">
              {t("login.emailLabel")}
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
              placeholder={t("login.emailPlaceholder")}
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

          <RecoveryPhoneFields
            idPrefix="fp"
            country={country}
            setCountry={setCountry}
            localPhone={localPhone}
            setLocalPhone={setLocalPhone}
            phoneErr={phoneErr}
            setPhoneErr={setPhoneErr}
            onIdentityChange={invalidateOnChange}
            verification={phoneV}
            onRequest={requestSms}
          />

          <div className="findemail__spacer" />

          <button
            type="button"
            className="findemail__submit"
            onClick={submit}
            disabled={!canSubmit}
            aria-disabled={!canSubmit}
            aria-label={t(canSubmit ? "findPassword.submit" : "findPassword.submitBlockedA11y")}
          >
            {busy ? <Spinner size={22} stroke={2.5} /> : t("findPassword.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
