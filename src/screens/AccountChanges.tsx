import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "../i18n";
import { authApi } from "../api/endpoints";
import { INTL_OPTIONS_QK } from "../components/InternationalCardSheet";
import { useAuth } from "../hooks/auth";
import { useToast } from "../hooks/toast";
import { countdownLabel } from "../hooks/verification";
import { errorMessage } from "../lib/http";
import { DEFAULT_PHONE_COUNTRY, applyPhoneInput, checkPhone, isPhoneCountry } from "../lib/phone";
import { usePhoneProblemMessage } from "../hooks/phoneProblem";
import { passwordProblem } from "../lib/validation";
import { CountrySelect } from "../components/ui/CountrySelect";

/* ------------------------- Password ------------------------- */
/**
 * Password change — single screen matching the reference. Reuses the
 * authenticated `changePassword(current, new, confirm)` API. The current-password
 * field is the re-authentication factor; on success the backend revokes sessions,
 * so we clear all fields and follow the existing hard sign-out → /login flow.
 * Passwords live only in screen-local state — never persisted, logged, or cached.
 */
export function ChangePassword() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const toast = useToast();
  const { hardSignOut } = useAuth();
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  // The shared policy that mirrors the backend: 8–64 chars, letter + number + special.
  const policyOk = passwordProblem(pw) === null;
  const matches = pw2.length > 0 && pw === pw2;
  const differs = pw.length > 0 && pw !== cur;
  const canSubmit = cur.length > 0 && policyOk && matches && differs && !busy;

  // Compact single-line feedback (most relevant issue only, stable height).
  const msg =
    pw2.length > 0 && pw !== pw2
      ? t("accountChanges.passwordMismatch")
      : pw.length > 0 && !policyOk
        ? t("accountChanges.passwordWeak")
        : cur.length > 0 && pw.length > 0 && pw === cur
          ? t("accountChanges.passwordSameAsCurrent")
          : "";

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await authApi.changePassword(cur, pw, pw2);
      // Clear sensitive state before leaving.
      setCur("");
      setPw("");
      setPw2("");
      toast.success(t("accountChanges.passwordChanged"));
      hardSignOut();
      nav("/login", { replace: true });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen setupp pwch">
      <div className="setupp__scroll">
        <div className="setupp__inner">
          <button className="setupp__back" onClick={() => nav(-1)} aria-label={t("common.back")}>
            <svg width="27" height="27" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <h1 className="setupp__title">{t("accountChanges.passwordTitle")}</h1>

          <label className="setupp__label" htmlFor="pwch-cur">{t("accountChanges.currentPassword")}</label>
          <input
            id="pwch-cur"
            className="pwch__field"
            type="password"
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder={t("accountChanges.currentPasswordPlaceholder")}
            value={cur}
            onChange={(e) => setCur(e.target.value)}
          />

          <label className="setupp__label" htmlFor="pwch-new">{t("accountChanges.newPassword")}</label>
          <input
            id="pwch-new"
            className="pwch__field"
            type="password"
            autoComplete="new-password"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder={t("accountChanges.newPasswordPlaceholder")}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />

          <label className="setupp__label" htmlFor="pwch-confirm">{t("accountChanges.confirmPassword")}</label>
          <input
            id="pwch-confirm"
            className="pwch__field"
            type="password"
            autoComplete="new-password"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder={t("accountChanges.confirmPasswordPlaceholder")}
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
          />

          <p className="pwch__msg" role="status" aria-live="polite">{msg}</p>

          <div className="setupp__spacer" />

          <button
            type="button"
            className="pwch__submit"
            onClick={submit}
            disabled={!canSubmit}
            aria-disabled={!canSubmit}
            aria-label={t(canSubmit ? "accountChanges.change" : "accountChanges.passwordBlockedA11y")}
          >
            {busy ? <span className="spinner" style={{ width: 22, height: 22, borderWidth: 2.5 }} /> : t("accountChanges.change")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------- Phone ------------------------- */
/**
 * Phone-number change — single screen matching the reference. Reuses the
 * authenticated OTP APIs (startPhone("change_phone") → confirmPhone →
 * changePhone). The number never becomes authoritative until confirmPhone
 * yields a verification_token AND changePhone succeeds. Any edit to the number
 * or country invalidates a prior verification proof. The countdown is derived
 * from the server `expires_at` timestamp (survives re-renders/backgrounding).
 */
export function ChangePhone() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { me, setMe } = useAuth();

  const [country, setCountry] = useState<string>(
    isPhoneCountry(me?.nationality) ? me.nationality : DEFAULT_PHONE_COUNTRY,
  );
  const [phoneErr, setPhoneErr] = useState<string | null>(null);
  const phoneMessage = usePhoneProblemMessage();
  const [localPhone, setLocalPhone] = useState("");
  const [vid, setVid] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [verifiedFor, setVerifiedFor] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const phone = useMemo(() => checkPhone(country, localPhone), [country, localPhone]);
  const e164 = phone.ok ? phone.e164 : "";
  const phoneValid = phone.ok;
  const sameAsCurrent = phone.ok && !!me?.phone && e164 === me.phone;

  const verified = !!token && verifiedFor === e164;

  // Timestamp-based countdown; recomputed from `expires_at`, never decremented
  // blindly. Stops on `token` so a confirmed code's timer is not left ticking.
  useEffect(() => {
    if (!vid || !expiresAt || token) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [vid, expiresAt, token]);

  const remaining = expiresAt ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000)) : 0;
  const resendIn = resendAt ? Math.max(0, Math.floor((new Date(resendAt).getTime() - now) / 1000)) : 0;
  const expired = !!vid && remaining <= 0 && !token;
  const countdown = countdownLabel(remaining, { requested: !!vid, verified });

  function resetVerification() {
    setVid(null);
    setExpiresAt(null);
    setResendAt(null);
    setCode("");
    setToken(null);
    setVerifiedFor(null);
  }

  async function send() {
    if (sending || (vid && resendIn > 0)) return;
    if (!phone.ok) {
      setPhoneErr(phoneMessage(country, phone.problem));
      return;
    }
    if (sameAsCurrent) {
      toast.error(t("accountChanges.phoneSame"));
      return;
    }
    setSending(true);
    try {
      const res = await authApi.startPhone(e164, "change_phone");
      setVid(res.verification_id);
      setExpiresAt(res.expires_at);
      setResendAt(res.resend_available_at);
      setCode("");
      setToken(null);
      setVerifiedFor(null);
      toast.success(t("accountChanges.codeSentSms"));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSending(false);
    }
  }

  const codeReady = !!vid && code.length === 6 && remaining > 0 && !token;

  async function confirm() {
    if (!codeReady || confirming) return;
    setConfirming(true);
    try {
      const res = await authApi.confirmPhone(vid!, code);
      setToken(res.verification_token);
      setVerifiedFor(e164); // bind proof to this exact number
      toast.success(t("accountChanges.verifiedToast"));
    } catch (e) {
      toast.error(errorMessage(e));
      setCode("");
    } finally {
      setConfirming(false);
    }
  }

  const canSave = !!me && verified && phoneValid && !sameAsCurrent && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      const res = await authApi.changePhone(e164, token!, country);
      if (me) setMe({ ...me, phone: res.phone ?? e164, nationality: country });
      // The number's calling code decides the billing currency and which
      // card the member may register: drop what was read for the old one.
      for (const key of [["payment-methods"], ["sub-offers"], INTL_OPTIONS_QK]) {
        void qc.invalidateQueries({ queryKey: key });
      }
      toast.success(t("accountChanges.phoneChanged"));
      nav(-1);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  /* MOR-003 keeps this button at a constant 재전송 (a hug-content 83 against the
     178 phone field). Putting the cooldown count inside the label grew it to 97
     and squeezed the field to 164, so the countdown moves to the accessible
     name and the disabled state carries the cue visually — the frame's own
     countdown is the teal mm:ss inside the code field (2065:25123), which the
     app already renders. */
  const resendLabel = sending
    ? t("accountChanges.sending")
    : !vid
      ? t("findEmail.verify")
      : t("accountChanges.resend");
  const feedback = token
    ? { ok: true, text: t("accountChanges.verifiedWithPeriod") }
    : expired
      ? { ok: false, text: t("accountChanges.codeExpired") }
      : null;

  return (
    <div className="screen acct pchg">
      <div className="acct__scroll">
        <div className="acct__inner">
          <header className="acct__header">
            <button className="acct__back" onClick={() => nav(-1)} aria-label={t("common.back")}>
              <svg width="27" height="27" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <h1 className="acct__title">{t("accountChanges.phoneTitle")}</h1>
          </header>

          {/* Phone number */}
          <div className="acct__label" id="pchg-phone-label">{t("accountChanges.phoneLabel")}</div>
          <div className="pchg__row">
            <CountrySelect
              value={country}
              onChange={(c) => {
                setCountry(c);
                setPhoneErr(null);
                resetVerification();
              }}
              className="pchg__country"
            />
            <input
              className={`pchg__phone ${phoneErr ? "is-error" : ""}`}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="01012345678"
              aria-labelledby="pchg-phone-label"
              aria-invalid={!!phoneErr}
              aria-describedby={phoneErr ? "pchg-phone-err" : undefined}
              value={localPhone}
              onChange={(e) => {
                // A pasted "+44 …" moves the picker to that country.
                const next = applyPhoneInput(country, e.target.value);
                setCountry(next.country);
                setLocalPhone(next.input);
                setPhoneErr(null);
                resetVerification();
              }}
            />
            <button
              type="button"
              className="pchg__resend"
              onClick={send}
              // Enabled once anything is typed, so a wrong number gets a
              // reason (below) instead of a silently dead button.
              disabled={!localPhone || sending || (!!vid && resendIn > 0)}
              aria-label={
                !vid
                  ? t("accountChanges.requestCodeA11y")
                  : resendIn > 0
                    ? t("accountChanges.resendIn", { n: resendIn })
                    : t("accountChanges.resendA11y")
              }
            >
              {resendLabel}
            </button>
          </div>
          {phoneErr && (
            <p className="findemail__err" id="pchg-phone-err" role="alert">
              {phoneErr}
            </p>
          )}

          {/* Verification code — rendered ONLY once a code has actually been
              requested. `vid` is set from the server's verification_id inside
              the success path, so a failed request leaves this hidden and no
              timer running; re-requesting replaces expires_at and restarts it. */}
          {vid && (<>
          <div className="acct__label" id="pchg-code-label">{t("findEmail.codeLabel")}</div>
          <div className="pchg__row">
            <div className="pchg__code-wrap">
              <input
                className="pchg__code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder={t("findEmail.codePlaceholder")}
                aria-labelledby="pchg-code-label"
                value={code}
                maxLength={6}
                disabled={!vid || !!token}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
              {countdown && (
                <span
                  className="pchg__timer"
                  role="timer"
                  aria-label={t("accountChanges.remainingA11y", {
                    m: Math.floor(remaining / 60),
                    s: remaining % 60,
                  })}
                >
                  {countdown}
                </span>
              )}
            </div>
            <button
              type="button"
              className="pchg__confirm"
              onClick={confirm}
              disabled={!codeReady || confirming}
            >
              {confirming ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : t("findEmail.check")}
            </button>
          </div>
          <p className={`pchg__msg ${feedback ? (feedback.ok ? "is-ok" : "is-err") : ""}`} role="status" aria-live="polite">
            {feedback?.text ?? ""}
          </p>
          </>)}

          <div className="pchg__spacer" />

          <button
            type="button"
            className="pchg__submit"
            onClick={save}
            disabled={!canSave}
            aria-disabled={!canSave}
            aria-label={t(canSave ? "accountChanges.change" : "accountChanges.phoneBlockedA11y")}
          >
            {saving ? <span className="spinner" style={{ width: 22, height: 22, borderWidth: 2.5 }} /> : t("accountChanges.change")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------- Email ------------------------- */
/**
 * Email change — single screen matching the reference. Reuses the authenticated
 * email-change OTP APIs (startEmailChange → confirmEmailChange → changeEmail).
 * The email becomes authoritative only after confirmEmailChange yields a
 * verification_token AND changeEmail succeeds. Editing the email invalidates a
 * prior proof; both verification controls show 인증완료 only after server success.
 */
export function ChangeEmail() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const toast = useToast();
  const { me, setMe } = useAuth();

  const [email, setEmail] = useState("");
  const [vid, setVid] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [verifiedFor, setVerifiedFor] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const emailNorm = email.trim();
  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailNorm);
  const sameAsCurrent = !!me?.email && emailNorm.toLowerCase() === me.email.toLowerCase();

  // Timestamp-based countdown; recomputed from server `expires_at`.
  useEffect(() => {
    if (!vid || !expiresAt || token) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [vid, expiresAt, token]);

  const remaining = expiresAt ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000)) : 0;
  const resendIn = resendAt ? Math.max(0, Math.floor((new Date(resendAt).getTime() - now) / 1000)) : 0;
  const expired = !!vid && remaining <= 0 && !token;
  const verified = !!token && verifiedFor === emailNorm;
  const countdown = countdownLabel(remaining, { requested: !!vid, verified });

  function resetVerification() {
    setVid(null);
    setExpiresAt(null);
    setResendAt(null);
    setCode("");
    setToken(null);
    setVerifiedFor(null);
  }

  async function send() {
    if (!emailValid || sending || (vid && resendIn > 0)) return;
    if (sameAsCurrent) {
      toast.error(t("accountChanges.emailSame"));
      return;
    }
    setSending(true);
    try {
      const res = await authApi.startEmailChange(emailNorm);
      setVid(res.verification_id);
      setExpiresAt(res.expires_at);
      setResendAt(res.resend_available_at);
      setCode("");
      setToken(null);
      setVerifiedFor(null);
      toast.success(t("accountChanges.codeSentEmail"));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSending(false);
    }
  }

  const codeReady = !!vid && code.length === 6 && remaining > 0 && !token;

  async function confirm() {
    if (!codeReady || confirming) return;
    setConfirming(true);
    try {
      const res = await authApi.confirmEmailChange(vid!, code);
      setToken(res.verification_token);
      setVerifiedFor(emailNorm); // bind proof to this exact email
      toast.success(t("accountChanges.verifiedPeriod"));
    } catch (e) {
      toast.error(errorMessage(e));
      setCode("");
    } finally {
      setConfirming(false);
    }
  }

  const canSave = !!me && verified && emailValid && !sameAsCurrent && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      const res = await authApi.changeEmail(emailNorm, token!);
      if (me) setMe({ ...me, email: res.email ?? emailNorm });
      toast.success(t("accountChanges.emailChanged"));
      nav(-1);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  /* Same as the phone screen: MOR-004's button label is constant, so the
     cooldown count stays out of it (see the note on `resendLabel`). */
  const emailActionLabel = sending
    ? null
    : verified
      ? t("findEmail.verified")
      : !vid
        ? t("findEmail.verify")
        : t("accountChanges.resend");

  return (
    <div className="screen acct echg">
      <div className="acct__scroll">
        <div className="acct__inner">
          <header className="acct__header">
            <button className="acct__back" onClick={() => nav(-1)} aria-label={t("common.back")}>
              <svg width="27" height="27" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <h1 className="acct__title">{t("accountChanges.emailTitle")}</h1>
          </header>

          {/* Email */}
          <div className="acct__label" id="echg-email-label">{t("accountChanges.emailLabel")}</div>
          <div className="pchg__row">
            <input
              className="echg__field"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="name@naver.com"
              aria-labelledby="echg-email-label"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                resetVerification();
              }}
            />
            <button
              type="button"
              className={`echg__action ${verified ? "is-done" : ""}`}
              onClick={send}
              disabled={!emailValid || sending || verified || (!!vid && resendIn > 0)}
              aria-label={
                verified
                  ? t("accountChanges.emailVerifiedA11y")
                  : !vid
                    ? t("accountChanges.requestCodeA11y")
                    : resendIn > 0
                      ? t("accountChanges.resendIn", { n: resendIn })
                      : t("accountChanges.resendA11y")
              }
            >
              {emailActionLabel ?? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />}
            </button>
          </div>

          {/* Verification code — rendered ONLY once a code has actually been
              requested. `vid` is set from the server's verification_id inside
              the success path, so a failed request leaves this hidden and no
              timer running; re-requesting replaces expires_at and restarts it. */}
          {vid && (<>
          <div className="acct__label" id="echg-code-label">{t("findEmail.codeLabel")}</div>
          <div className="pchg__row">
            <div className="pchg__code-wrap">
              <input
                className="echg__field echg__field--code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder={t("findEmail.codePlaceholder")}
                aria-labelledby="echg-code-label"
                value={code}
                maxLength={6}
                disabled={!vid || verified}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
              {countdown && (
                <span
                  className="pchg__timer"
                  role="timer"
                  aria-label={t("accountChanges.remainingA11y", {
                    m: Math.floor(remaining / 60),
                    s: remaining % 60,
                  })}
                >
                  {countdown}
                </span>
              )}
            </div>
            <button
              type="button"
              className={`echg__action ${verified ? "is-done" : ""}`}
              onClick={confirm}
              disabled={verified ? true : !codeReady || confirming}
              aria-label={t(verified ? "accountChanges.verifiedDoneA11y" : "findEmail.checkCodeA11y")}
            >
              {confirming ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : verified ? t("findEmail.verified") : t("findEmail.check")}
            </button>
          </div>
          <p className={`echg__msg ${verified ? "is-ok" : expired ? "is-err" : ""}`} role="status" aria-live="polite">
            {verified ? t("accountChanges.verifiedPeriod") : expired ? t("accountChanges.codeExpired") : ""}
          </p>
          </>)}

          <div className="pchg__spacer" />

          <button
            type="button"
            className="pchg__submit"
            onClick={save}
            disabled={!canSave}
            aria-disabled={!canSave}
            aria-label={t(canSave ? "accountChanges.change" : "accountChanges.emailBlockedA11y")}
          >
            {saving ? <span className="spinner" style={{ width: 22, height: 22, borderWidth: 2.5 }} /> : t("accountChanges.change")}
          </button>
        </div>
      </div>
    </div>
  );
}
