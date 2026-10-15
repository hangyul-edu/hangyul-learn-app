import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../i18n";
import { Sheet } from "../components/ui/Modal";
import { PolicyBody } from "./Policy";
import { authApi } from "../api/endpoints";
import { useAuth } from "../hooks/auth";
import { pathForStep } from "../hooks/loginFlow";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import { policyDoc, type PolicyId } from "../lib/policies";
import {
  AGREEMENTS,
  NO_AGREEMENTS,
  REQUIRED_AGREEMENTS,
  agreementPayload,
  type Agreements,
} from "../lib/signupAgreements";
import { Spinner } from "../components/ui/Spinner";
import { CloseIcon } from "../components/brand/Glyphs";

/**
 * Social signup's terms step (/signup/terms). A first social login creates the
 * account and signs in, but its owner has not yet agreed to anything; the
 * server routes them here (`next_step = terms_agreement`) and refuses profile
 * registration until they do. The agreements and their wording are email
 * signup's — social signup is email signup without the email and password.
 * Next → phone verification (only when the provider gave no phone number) →
 * profile registration → onboarding, as for every new member.
 */
export function SocialSignupTerms() {
  const { t, language } = useTranslation();
  const nav = useNavigate();
  const toast = useToast();
  const { setMe, revokeSession, hardSignOut } = useAuth();
  const [agree, setAgree] = useState<Agreements>(NO_AGREEMENTS);
  const [policyOpen, setPolicyOpen] = useState<PolicyId | null>(null);
  const [busy, setBusy] = useState(false);

  const requiredDone = REQUIRED_AGREEMENTS.every((k) => agree[k]);
  const everyAgreed = AGREEMENTS.every((a) => agree[a.key]);

  function toggleAll() {
    const next = !everyAgreed;
    setAgree(Object.fromEntries(AGREEMENTS.map((a) => [a.key, next])) as Agreements);
  }

  async function submit() {
    if (!requiredDone || busy) return;
    setBusy(true);
    try {
      const { next_step } = await authApi.agreeSocialTerms(agreementPayload(agree));
      setMe((prev) => ({ ...prev!, terms_agreement_pending: false }));
      // Normally the profile: the phone step came before the terms.
      nav(pathForStep(next_step === "terms_agreement" ? "profile_registration" : next_step), {
        replace: true,
      });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  // Leaving signs out: nothing is agreed, so the app cannot be used. The
  // account stays pending, and the next social login comes back here.
  async function close() {
    try {
      await revokeSession();
    } catch {
      /* a transient failure still signs out locally */
    }
    hardSignOut();
    nav("/welcome", { replace: true });
  }

  return (
    <div className="screen sterms">
      <div className="sterms__top">
        <button type="button" className="sterms__close" onClick={close} aria-label={t("socialTerms.closeA11y")}>
          <CloseIcon />
        </button>
      </div>

      <div className="sterms__scroll">
        <h1 className="sterms__title">{t("socialTerms.title")}</h1>

        <button
          type="button"
          className="sterms__all"
          role="checkbox"
          aria-checked={everyAgreed}
          onClick={toggleAll}
        >
          <span className={`sterms__all-mark ${everyAgreed ? "is-on" : ""}`} aria-hidden="true">
            <Check />
          </span>
          <span className="sterms__all-label">{t("signup.agreeAll")}</span>
        </button>

        <ul className="sterms__list">
          {AGREEMENTS.map((a) => {
            const checked = agree[a.key];
            return (
              <li key={a.key} className="sterms__row">
                <button
                  type="button"
                  className="sterms__item"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => setAgree((s) => ({ ...s, [a.key]: !s[a.key] }))}
                >
                  <span className={`sterms__mark ${checked ? "is-on" : ""}`} aria-hidden="true">
                    <Check />
                  </span>
                  <span className="sterms__label">{t(a.label)}</span>
                </button>
                {a.doc && (
                  <button
                    type="button"
                    className="sterms__more"
                    onClick={() => setPolicyOpen(a.doc!)}
                    aria-label={t("signup.viewDetailA11y", { name: t(a.label) })}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M6 3l4.5 5L6 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="sterms__foot">
        <button type="button" className="sterms__next" onClick={submit} disabled={!requiredDone || busy}>
          {busy ? <Spinner size={20} stroke={2.5} /> : t("socialTerms.next")}
        </button>
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

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
