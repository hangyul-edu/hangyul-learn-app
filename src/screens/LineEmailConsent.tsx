import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../i18n";
import { Sheet } from "../components/ui/Modal";
import { LineIcon } from "../components/brand/AuthBrand";
import { PolicyBody } from "./Policy";
import { useSocialLogin } from "../hooks/socialLogin";
import { policyDoc, type PolicyId } from "../lib/policies";

export const LINE_EMAIL_CONSENT_PATH = "/login/line";
const PRIVACY_POLICY: PolicyId = "purchase-privacy";

/**
 * LINE's email notice (/login/line), shown each time the LINE button is
 * tapped and before LINE's own authorization screen. LINE releases the email
 * only to channels that explain its use this way; it is not the sign-up terms,
 * which a new member still accepts after the account is created. Only the
 * consent button leaves for LINE; X goes back without starting a sign-in.
 */
export function LineEmailConsent() {
  const { t, language } = useTranslation();
  const nav = useNavigate();
  const social = useSocialLogin();
  const [policyOpen, setPolicyOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  function close() {
    // Opened from the welcome screen normally; a direct visit has no history.
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) nav(-1);
    else nav("/welcome", { replace: true });
  }

  async function agree() {
    if (leaving) return;
    setLeaving(true);
    try {
      await social.start("line");
    } catch {
      setLeaving(false);
    }
  }

  return (
    <div className="screen sterms lcons">
      <div className="sterms__top">
        <button type="button" className="sterms__close" onClick={close} aria-label={t("lineConsent.closeA11y")}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="sterms__scroll">
        <span className="lcons__badge" aria-hidden="true">
          <LineIcon size={40} />
        </span>
        <h1 className="sterms__title lcons__title">{t("lineConsent.title")}</h1>
        <div className="lcons__card">
          <p className="lcons__desc">{t("lineConsent.description")}</p>
          <button type="button" className="lcons__policy" onClick={() => setPolicyOpen(true)}>
            {t("lineConsent.privacyPolicy")}
          </button>
        </div>
      </div>

      <div className="sterms__foot">
        <button type="button" className="sterms__next" onClick={agree} disabled={leaving}>
          {leaving ? <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2.5 }} /> : t("lineConsent.agree")}
        </button>
      </div>

      <Sheet open={policyOpen} onClose={() => setPolicyOpen(false)} title={policyDoc(language, PRIVACY_POLICY).title}>
        {policyOpen && <PolicyBody id={PRIVACY_POLICY} />}
      </Sheet>
    </div>
  );
}
