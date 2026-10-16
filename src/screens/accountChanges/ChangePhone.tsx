import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "../../i18n";
import { authApi } from "../../api/endpoints";
import { INTL_OPTIONS_QK } from "../../components/InternationalCardSheet";
import { useAuth } from "../../hooks/auth";
import { nextSetupPath, useLoginFlow } from "../../hooks/loginFlow";
import { clearPendingSignup, loadPendingSignup } from "../../hooks/socialSignup";
import { useToast } from "../../hooks/toast";
import { countdownLabel } from "../../hooks/verification";
import { ApiError, errorMessage } from "../../lib/http";
import { DEFAULT_PHONE_COUNTRY, applyPhoneInput, checkPhone, isPhoneCountry, phoneExample } from "../../lib/phone";
import { usePhoneProblemMessage } from "../../hooks/phoneProblem";
import { CountrySelect } from "../../components/ui/CountrySelect";
import { Spinner } from "../../components/ui/Spinner";
import { AcctHeader } from "../../components/layout/AcctHeader";
import { CodeTimer, useOtpClock } from "./otp";

/**
 * Phone-number change — single screen matching the reference. Reuses the
 * authenticated OTP APIs (startPhone("change_phone"), or "add_phone" for an
 * account's first number → confirmPhone → changePhone). Sending and checking
 * the code report inline (the code field, the line under it), never by toast. The number never becomes authoritative until confirmPhone
 * yields a verification_token AND changePhone succeeds. Any edit to the number
 * or country invalidates a prior verification proof. The countdown is derived
 * from the server `expires_at` timestamp (survives re-renders/backgrounding).
 *
 * `mode="setup"` is social signup's phone step (/setup/phone): a member who
 * signed in with a provider that gave no phone number verifies one before
 * using the app. Same SMS flow and API; a one-line intro asks for the number
 * (without saying what it is used for), X signs out like the terms step, and
 * saving continues to the next signup step instead of going back.
 */
export function ChangePhone({ mode = "change" }: { mode?: "change" | "setup" | "signup" }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { me, setMe, bootstrapMe, revokeSession, hardSignOut } = useAuth();
  const completeLogin = useLoginFlow();
  // Signup: a first social sign-in's phone step (/signup/phone) — no account
  // exists yet; the verified number signs in to the account that holds it,
  // or only then creates one. Setup: an older social account without a
  // number (/setup/phone). Neither can be skipped.
  const signup = mode === "signup";
  const setup = mode === "setup" || signup;
  const [pending] = useState(() => (signup ? loadPendingSignup() : null));

  const [country, setCountry] = useState<string>(
    isPhoneCountry(me?.nationality) ? me.nationality : DEFAULT_PHONE_COUNTRY,
  );
  const [phoneErr, setPhoneErr] = useState<string | null>(null);
  // A refused code, shown under the code field until the member types again.
  const [codeErr, setCodeErr] = useState<string | null>(null);
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

  const phone = useMemo(() => checkPhone(country, localPhone), [country, localPhone]);
  const e164 = phone.ok ? phone.e164 : "";
  const phoneValid = phone.ok;
  const sameAsCurrent = !setup && phone.ok && !!me?.phone && e164 === me.phone;

  const verified = !!token && verifiedFor === e164;

  const { remaining, resendIn, expired } = useOtpClock({ vid, expiresAt, resendAt, token });
  const countdown = countdownLabel(remaining, { requested: !!vid, verified });

  function resetVerification() {
    setVid(null);
    setExpiresAt(null);
    setResendAt(null);
    setCode("");
    setToken(null);
    setVerifiedFor(null);
    setCodeErr(null);
  }

  async function send() {
    if (sending || (vid && resendIn > 0)) return;
    if (!phone.ok) {
      setPhoneErr(phoneMessage(country, phone.problem));
      return;
    }
    if (sameAsCurrent) {
      setPhoneErr(t("accountChanges.phoneSame"));
      return;
    }
    setSending(true);
    try {
      // A first number is registered, not changed: the SMS says so.
      const res = await authApi.startPhone(e164, me?.phone ? "change_phone" : "add_phone");
      setVid(res.verification_id);
      setExpiresAt(res.expires_at);
      setResendAt(res.resend_available_at);
      setCode("");
      setToken(null);
      setVerifiedFor(null);
      setCodeErr(null);
    } catch (e) {
      setPhoneErr(errorMessage(e));
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
    } catch (e) {
      setCodeErr(errorMessage(e));
      setCode("");
    } finally {
      setConfirming(false);
    }
  }

  const canSave = (signup ? !!pending : !!me) && verified && phoneValid && !sameAsCurrent && !saving;

  async function finishSignup() {
    // Sent even when the local copy has expired: the server's answer
    // (`social_signup_expired`) is what the member is shown.
    const ticket = loadPendingSignup() ?? pending;
    if (!ticket) return;
    try {
      const tokens = await authApi.completeSocialSignup(ticket.signupToken, e164, token!, country);
      clearPendingSignup();
      qc.clear();
      await completeLogin(tokens, true);
    } catch (e) {
      toast.error(errorMessage(e));
      if (e instanceof ApiError && e.code === "social_signup_expired") {
        clearPendingSignup();
        nav("/welcome", { replace: true });
      }
    }
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    if (signup) {
      await finishSignup();
      setSaving(false);
      return;
    }
    try {
      const res = await authApi.changePhone(e164, token!, country);
      if (me) setMe({ ...me, phone: res.phone ?? e164, nationality: country });
      // The number's calling code decides the billing currency, which card
      // the member may register and — from the next billing date — what a
      // running subscription renews at: drop what was read for the old one.
      for (const key of [["payment-methods"], ["sub-offers"], ["sub-me"], INTL_OPTIONS_QK]) {
        void qc.invalidateQueries({ queryKey: key });
      }
      if (setup) {
        toast.success(t("phoneSetup.saved"));
        // The server now reports the step done; continue the signup from the
        // refreshed profile (profile registration, onboarding or home).
        const fresh = await bootstrapMe();
        nav(nextSetupPath(fresh), { replace: true });
        return;
      }
      toast.success(t("accountChanges.phoneChanged"));
      nav(-1);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  // Leaving the phone step signs out, as leaving the terms step does: the
  // app cannot be used without a number, and the next login comes back here.
  // A sign-up has no account to sign out of: its ticket is dropped.
  async function quitSetup() {
    if (signup) {
      clearPendingSignup();
      nav("/welcome", { replace: true });
      return;
    }
    try {
      await revokeSession();
    } catch {
      /* a transient failure still signs out locally */
    }
    hardSignOut();
    nav("/welcome", { replace: true });
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
      : codeErr
        ? { ok: false, text: codeErr }
        : null;

  // No sign-up in progress here (opened directly, or the ticket expired).
  if (signup && !pending) return <Navigate to="/welcome" replace />;

  return (
    <div className="screen acct pchg">
      <div className="acct__scroll">
        <div className="acct__inner">
          <AcctHeader
            title={t(setup ? "phoneSetup.title" : "accountChanges.phoneTitle")}
            onBack={setup ? quitSetup : () => nav(-1)}
            quitLabel={setup ? t("phoneSetup.quitA11y") : undefined}
          />
          {setup && <p className="pchg__intro">{t("phoneSetup.intro")}</p>}

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
              placeholder={phoneExample(country)}
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
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setCodeErr(null);
                }}
              />
              {countdown && <CodeTimer remaining={remaining} label={countdown} />}
            </div>
            <button
              type="button"
              className="pchg__confirm"
              onClick={confirm}
              disabled={!codeReady || confirming}
            >
              {confirming ? <Spinner size={18} stroke={2} /> : t("findEmail.check")}
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
            aria-label={t(
              canSave
                ? setup ? "phoneSetup.submit" : "accountChanges.change"
                : setup ? "phoneSetup.blockedA11y" : "accountChanges.phoneBlockedA11y",
            )}
          >
            {saving ? (
              <Spinner size={22} stroke={2.5} />
            ) : (
              t(setup ? "phoneSetup.submit" : "accountChanges.change")
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

