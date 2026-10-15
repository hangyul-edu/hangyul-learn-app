import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../i18n";
import { authApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { useVerification } from "../hooks/verification";
import { ApiError, errorMessage } from "../lib/http";
import { checkPhone } from "../lib/phone";
import { usePhoneProblemMessage } from "../hooks/phoneProblem";
import { Spinner } from "../components/ui/Spinner";
import { BackChevronIcon } from "../components/brand/Glyphs";
import { RecoveryPhoneFields } from "../components/RecoveryPhoneFields";

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

  const phoneMessage = usePhoneProblemMessage();
  const phone = useMemo(() => checkPhone(country, localPhone), [country, localPhone]);
  const e164 = phone.ok ? phone.e164 : "";

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
    if (!phone.ok) {
      setPhoneErr(phoneMessage(country, phone.problem));
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
      nav("/find-email/result", { state: { found: true, email: res.email } });
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
            <BackChevronIcon />
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

          <RecoveryPhoneFields
            idPrefix="fe"
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
            aria-label={t(canSubmit ? "findEmail.submit" : "findEmail.submitBlockedA11y")}
          >
            {busy ? <Spinner size={22} stroke={2.5} /> : t("findEmail.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
