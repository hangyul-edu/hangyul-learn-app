import { useTranslation } from "../i18n";
import { CountrySelect } from "./ui/CountrySelect";
import type { useVerification } from "../hooks/verification";
import { applyPhoneInput, phoneExample } from "../lib/phone";

/**
 * Account recovery's phone number and SMS code rows (find email, find
 * password). Editing the number or its country drops any verification
 * (`onIdentityChange`), so a stale code or token can't be submitted.
 */
export function RecoveryPhoneFields({
  idPrefix,
  country,
  setCountry,
  localPhone,
  setLocalPhone,
  phoneErr,
  setPhoneErr,
  onIdentityChange,
  verification: v,
  onRequest,
}: {
  idPrefix: string;
  country: string;
  setCountry: (code: string) => void;
  localPhone: string;
  setLocalPhone: (value: string) => void;
  phoneErr: string | null;
  setPhoneErr: (message: string | null) => void;
  onIdentityChange: () => void;
  verification: ReturnType<typeof useVerification>;
  onRequest: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
    {/* Phone */}
    <div className="findemail__field">
      <label className="findemail__label" htmlFor={`${idPrefix}-phone`}>
        {t("findEmail.phoneLabel")}
      </label>
      <div className="findemail__row">
        <CountrySelect
          value={country}
          onChange={(c) => {
            setCountry(c);
            setPhoneErr(null);
            onIdentityChange();
          }}
          className="findemail__country"
        />
        <input
          id={`${idPrefix}-phone`}
          className={`findemail__input findemail__input--flex ${phoneErr ? "is-error" : ""}`}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder={phoneExample(country)}
          aria-label={t("findEmail.phoneA11y")}
          value={localPhone}
          onChange={(e) => {
            // A pasted "+44 …" moves the picker to that country.
            const next = applyPhoneInput(country, e.target.value);
            setCountry(next.country);
            setLocalPhone(next.input);
            setPhoneErr(null);
            onIdentityChange();
          }}
          disabled={v.verified}
        />
        <button
          type="button"
          className="findemail__pill"
          onClick={onRequest}
          disabled={v.sending || v.cooldown > 0 || v.verified}
          aria-label={t("findEmail.requestCodeA11y")}
        >
          {v.verified ? t("findEmail.verified") : v.cooldown > 0 ? `${v.cooldown}s` : t("findEmail.verify")}
        </button>
      </div>
      {phoneErr && <p className="findemail__err">{phoneErr}</p>}
    </div>

    {/* Verification code — rendered ONLY after a code has actually
        been requested. `v.requested` is the shared hook's gate:
        true only once the server returned a verification_id, so a
        failed request leaves the field hidden and the timer off. */}
    {v.requested && (
    <div className="findemail__field">
      <label className="findemail__label" htmlFor={`${idPrefix}-code`}>
        {t("findEmail.codeLabel")}
      </label>
      <div className="findemail__row">
        <div className="findemail__code findemail__input--flex">
          <input
            id={`${idPrefix}-code`}
            className="findemail__code-input"
            inputMode="numeric"
            maxLength={6}
            placeholder={t("findEmail.codePlaceholder")}
            aria-label={t("findEmail.codeA11y")}
            value={v.code}
            onChange={(e) => v.setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            disabled={!v.requested || v.verified}
          />
          {v.countdown && (
            <span className="findemail__timer" aria-hidden="true">
              {v.countdown}
            </span>
          )}
        </div>
        <button
          type="button"
          className="findemail__pill findemail__pill--sm"
          onClick={v.confirmCode}
          disabled={v.code.length !== 6 || v.confirming || v.verified}
          aria-label={t("findEmail.checkCodeA11y")}
        >
          {v.verified ? t("findEmail.checkDone") : t("findEmail.check")}
        </button>
      </div>
      {v.error && <p className="findemail__err">{v.error}</p>}
    </div>
    )}
    </>
  );
}
