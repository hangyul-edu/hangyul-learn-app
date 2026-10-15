import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../../i18n";
import { authApi } from "../../api/endpoints";
import { useAuth } from "../../hooks/auth";
import { useToast } from "../../hooks/toast";
import { countdownLabel } from "../../hooks/verification";
import { errorMessage } from "../../lib/http";
import { isEmailLike } from "../../lib/validation";
import { Spinner } from "../../components/ui/Spinner";
import { AcctHeader } from "../../components/layout/AcctHeader";
import { CodeTimer, useOtpClock } from "./otp";

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

  const emailNorm = email.trim();
  const emailValid = isEmailLike(emailNorm);
  const sameAsCurrent = !!me?.email && emailNorm.toLowerCase() === me.email.toLowerCase();

  const { remaining, resendIn, expired } = useOtpClock({ vid, expiresAt, resendAt, token });
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
          <AcctHeader title={t("accountChanges.emailTitle")} onBack={() => nav(-1)} />

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
              {emailActionLabel ?? <Spinner size={18} stroke={2} />}
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
              {countdown && <CodeTimer remaining={remaining} label={countdown} />}
            </div>
            <button
              type="button"
              className={`echg__action ${verified ? "is-done" : ""}`}
              onClick={confirm}
              disabled={verified ? true : !codeReady || confirming}
              aria-label={t(verified ? "accountChanges.verifiedDoneA11y" : "findEmail.checkCodeA11y")}
            >
              {confirming ? <Spinner size={18} stroke={2} /> : verified ? t("findEmail.verified") : t("findEmail.check")}
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
            {saving ? <Spinner size={22} stroke={2.5} /> : t("accountChanges.change")}
          </button>
        </div>
      </div>
    </div>
  );
}
