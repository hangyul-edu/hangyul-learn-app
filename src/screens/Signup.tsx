import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../i18n";
import { CountrySelect } from "../components/ui/CountrySelect";
import { Sheet } from "../components/ui/Modal";
import { PolicyBody } from "./Policy";
import { authApi } from "../api/endpoints";
import { useLoginFlow } from "../hooks/loginFlow";
import { useToast } from "../hooks/toast";
import { useVerification } from "../hooks/verification";
import { errorMessage } from "../lib/http";
import { passwordProblem, isEmailLike } from "../lib/validation";
import { applyPhoneInput, checkPhone, phoneExample } from "../lib/phone";
import { usePhoneProblemMessage } from "../hooks/phoneProblem";
import { policyDoc, type PolicyId } from "../lib/policies";
import {
  AGREEMENTS,
  NO_AGREEMENTS,
  REQUIRED_AGREEMENTS,
  agreementPayload,
  type AgreeKey,
  type Agreements,
} from "../lib/signupAgreements";
import { Spinner } from "../components/ui/Spinner";
import { BackChevronIcon, CheckIcon } from "../components/brand/Glyphs";

export function Signup() {
  const { t, language } = useTranslation();
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

  const [agree, setAgree] = useState<Agreements>(NO_AGREEMENTS);
  const [policyOpen, setPolicyOpen] = useState<PolicyId | null>(null);

  const phoneMessage = usePhoneProblemMessage();
  const phone = useMemo(() => checkPhone(country, localPhone), [country, localPhone]);
  const e164 = phone.ok ? phone.e164 : "";

  const phoneV = useVerification({
    start: () => authApi.startPhone(e164, "signup"),
    confirm: authApi.confirmPhone,
  });
  const emailV = useVerification({
    start: () => authApi.startEmail(email.trim()),
    confirm: authApi.confirmEmail,
  });

  // A code (and the token it yields) proves ownership of the exact number or
  // address it was sent to, and the backend checks that match at signup. So
  // editing either identity drops its verification instead of leaving a proof
  // for the old value behind — which would fail at submit with the verified
  // field already locked.
  function resetPhoneVerification() {
    if (phoneV.requested || phoneV.verified) phoneV.reset();
  }
  function resetEmailVerification() {
    if (emailV.requested || emailV.verified) emailV.reset();
  }

  const allAgreed = REQUIRED_AGREEMENTS.every((k) => agree[k]);
  /** "Agree to all" reflects and toggles every row, optional ones included. */
  const everyAgreed = AGREEMENTS.every((a) => agree[a.key]);

  function requestPhone() {
    if (!phone.ok) {
      setErrors((x) => ({ ...x, phone: phoneMessage(country, phone.problem) }));
      return;
    }
    setErrors((x) => ({ ...x, phone: "" }));
    void phoneV.request();
  }
  function requestEmail() {
    if (!isEmailLike(email)) {
      setErrors((x) => ({ ...x, email: t("findPassword.emailInvalid") }));
      return;
    }
    setErrors((x) => ({ ...x, email: "" }));
    void emailV.request();
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (name.trim().length < 1) e.name = t("signup.errName");
    if (!phoneV.verified) e.phone = t("signup.errPhoneVerify");
    if (!emailV.verified) e.email = t("signup.errEmailVerify");
    const pw = passwordProblem(password);
    if (pw) e.password = t(pw);
    if (password !== confirm) e.confirm = t("signup.errConfirm");
    if (!allAgreed) e.agree = t("signup.errAgree");
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submitSignup() {
    if (busy) return;
    if (!validate()) {
      toast.error(t("signup.errForm"));
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
        ...agreementPayload(agree),
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
    const next = !everyAgreed;
    setAgree(Object.fromEntries(AGREEMENTS.map((a) => [a.key, next])) as Record<AgreeKey, boolean>);
  }

  return (
    <div className="screen signup">
      <div className="signup__scroll">
        <div className="signup__inner">
          <button className="signup__back" onClick={() => nav(-1)} aria-label={t("common.back")}>
            <BackChevronIcon />
          </button>

          <h1 className="signup__title">{t("signup.title")}</h1>
          <p className="signup__subtitle">{t("signup.subtitle")}</p>

          {/* Name */}
          <div className="signup__field">
            <label className="signup__label" htmlFor="su-name">
              {t("signup.nameLabel")}
            </label>
            <input
              id="su-name"
              className={`signup__input ${errors.name ? "is-error" : ""}`}
              placeholder={t("signup.namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setName((n) => n.trim())}
            />
            {errors.name && <p className="signup__err">{errors.name}</p>}
          </div>

          {/* Phone */}
          <div className="signup__field">
            <label className="signup__label" htmlFor="su-phone">
              {t("findEmail.phoneLabel")}
            </label>
            <div className="signup__row">
              <CountrySelect
                value={country}
                onChange={(c) => {
                  if (c !== country) resetPhoneVerification();
                  setCountry(c);
                }}
              />
              <input
                id="su-phone"
                className={`signup__input signup__input--flex ${errors.phone ? "is-error" : ""}`}
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
                  setErrors((x) => ({ ...x, phone: "" }));
                  resetPhoneVerification();
                }}
                disabled={phoneV.verified}
              />
              <button
                type="button"
                className="signup__pill"
                onClick={requestPhone}
                disabled={phoneV.sending || phoneV.cooldown > 0 || phoneV.verified}
                aria-label={t("signup.phoneRequestA11y")}
              >
                {phoneV.verified ? t("findEmail.verified") : phoneV.cooldown > 0 ? `${phoneV.cooldown}s` : t("findEmail.verify")}
              </button>
            </div>
            {errors.phone && <p className="signup__err">{errors.phone}</p>}
          </div>

          {/* Phone code — rendered ONLY after a code has actually been
              requested. `phoneV.requested` is the shared hook's gate: it is
              true only once the server has returned a verification_id, so
              a failed request leaves the field hidden and the timer off. */}
          {phoneV.requested && (
          <div className="signup__field">
            <label className="signup__label" htmlFor="su-phone-code">
              {t("findEmail.codeLabel")}
            </label>
            <div className="signup__row">
              <div className="signup__code signup__input--flex">
                <input
                  id="su-phone-code"
                  className="signup__code-input"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder={t("findEmail.codePlaceholder")}
                  aria-label={t("signup.phoneCodeLabel")}
                  value={phoneV.code}
                  onChange={(e) => phoneV.setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  disabled={!phoneV.requested || phoneV.verified}
                />
                {phoneV.countdown && (
                  <span className="signup__timer" aria-hidden="true">
                    {phoneV.countdown}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="signup__pill signup__pill--sm"
                onClick={phoneV.confirmCode}
                disabled={phoneV.code.length !== 6 || phoneV.confirming || phoneV.verified}
                aria-label={t("signup.phoneCodeA11y")}
              >
                {phoneV.verified ? t("findEmail.checkDone") : t("findEmail.check")}
              </button>
            </div>
            {phoneV.error && <p className="signup__err">{phoneV.error}</p>}
          </div>
          )}

          {/* Email */}
          <div className="signup__field">
            <label className="signup__label" htmlFor="su-email">
              {t("login.emailLabel")}
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
                placeholder={t("signup.emailPlaceholder")}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  resetEmailVerification();
                }}
                onBlur={() => setEmail((v) => v.trim())}
                disabled={emailV.verified}
              />
              <button
                type="button"
                className="signup__pill"
                onClick={requestEmail}
                disabled={emailV.sending || emailV.cooldown > 0 || emailV.verified}
                aria-label={t("signup.emailRequestA11y")}
              >
                {emailV.verified ? t("findEmail.verified") : emailV.cooldown > 0 ? `${emailV.cooldown}s` : t("findEmail.verify")}
              </button>
            </div>
            {errors.email && <p className="signup__err">{errors.email}</p>}
          </div>

          {/* Email code — rendered ONLY after a code has actually been
              requested. `emailV.requested` is the shared hook's gate: it is
              true only once the server has returned a verification_id, so
              a failed request leaves the field hidden and the timer off. */}
          {emailV.requested && (
          <div className="signup__field">
            <label className="signup__label" htmlFor="su-email-code">
              {t("findEmail.codeLabel")}
            </label>
            <div className="signup__row">
              <div className="signup__code signup__input--flex">
                <input
                  id="su-email-code"
                  className="signup__code-input"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder={t("findEmail.codePlaceholder")}
                  aria-label={t("signup.emailCodeLabel")}
                  value={emailV.code}
                  onChange={(e) => emailV.setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  disabled={!emailV.requested || emailV.verified}
                />
                {emailV.countdown && (
                  <span className="signup__timer" aria-hidden="true">
                    {emailV.countdown}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="signup__pill signup__pill--sm"
                onClick={emailV.confirmCode}
                disabled={emailV.code.length !== 6 || emailV.confirming || emailV.verified}
                aria-label={t("signup.emailCodeA11y")}
              >
                {emailV.verified ? t("findEmail.checkDone") : t("findEmail.check")}
              </button>
            </div>
            {emailV.error && <p className="signup__err">{emailV.error}</p>}
          </div>
          )}

          {/* Password */}
          <div className="signup__field">
            <label className="signup__label" htmlFor="su-pw">
              {t("signup.passwordLabel")}
            </label>
            <input
              id="su-pw"
              className={`signup__input ${errors.password ? "is-error" : ""}`}
              type="password"
              autoComplete="new-password"
              placeholder={t("signup.passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {errors.password && <p className="signup__err">{errors.password}</p>}
          </div>

          {/* Password confirm */}
          <div className="signup__field">
            <label className="signup__label" htmlFor="su-pw2">
              {t("signup.confirmLabel")}
            </label>
            <input
              id="su-pw2"
              className={`signup__input ${errors.confirm ? "is-error" : ""}`}
              type="password"
              autoComplete="new-password"
              placeholder={t("signup.confirmPlaceholder")}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {errors.confirm && <p className="signup__err">{errors.confirm}</p>}
          </div>

          {/* Terms */}
          <div className="signup__terms">
            <h2 className="signup__terms-title">{t("signup.termsTitle")}</h2>

            <button
              type="button"
              className="signup__agree signup__agree--all"
              role="checkbox"
              aria-checked={everyAgreed}
              onClick={toggleAll}
            >
              <span className="signup__agree-label signup__agree-label--all">{t("signup.agreeAll")}</span>
              <span className={`signup__check signup__check--dark ${everyAgreed ? "is-on" : ""}`} aria-hidden="true">
                <CheckIcon size={14} color="#fff" />
              </span>
            </button>

            {AGREEMENTS.map((a) => {
              const checked = agree[a.key];
              return (
                <div key={a.key} className="signup__agree">
                  {a.doc ? (
                    <button
                      type="button"
                      className={`signup__agree-label signup__agree-label--btn ${a.underline ? "signup__agree-label--link" : ""}`}
                      onClick={() => setPolicyOpen(a.doc!)}
                      aria-label={t("signup.viewDetailA11y", { name: t(a.label) })}
                    >
                      {t(a.label)}
                    </button>
                  ) : (
                    <span className="signup__agree-label">{t(a.label)}</span>
                  )}
                  <button
                    type="button"
                    className="signup__agree-box"
                    role="checkbox"
                    aria-checked={checked}
                    aria-label={t(a.label)}
                    onClick={() => setAgree((s) => ({ ...s, [a.key]: !s[a.key] }))}
                  >
                    <span className={`signup__check signup__check--pale ${checked ? "is-on" : ""}`} aria-hidden="true">
                      <CheckIcon size={14} color="#9aa2a8" />
                    </span>
                  </button>
                </div>
              );
            })}
            {errors.agree && <p className="signup__err">{errors.agree}</p>}
          </div>

          <button className="signup__submit" type="button" onClick={submitSignup} disabled={busy} aria-label={t("signup.submit")}>
            {busy ? <Spinner size={20} stroke={2.5} /> : t("signup.submit")}
          </button>
        </div>
      </div>

      <Sheet
        open={policyOpen !== null}
        onClose={() => setPolicyOpen(null)}
        title={policyOpen ? policyDoc(language, policyOpen).title : ""}
      >
        {policyOpen && <PolicyBody id={policyOpen} />}
      </Sheet>
    </div>
  );
}
