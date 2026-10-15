import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../i18n";
import { LineIcon } from "../components/brand/AuthBrand";
import { PolicySheet } from "./Policy";
import { useSocialLogin } from "../hooks/socialLogin";
import type { PolicyId } from "../lib/policies";
import { Spinner } from "../components/ui/Spinner";
import { CloseIcon } from "../components/brand/Glyphs";

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
  const { t } = useTranslation();
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
          <CloseIcon />
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
          {leaving ? <Spinner size={20} stroke={2.5} /> : t("lineConsent.agree")}
        </button>
      </div>

      <PolicySheet id={policyOpen ? PRIVACY_POLICY : null} onClose={() => setPolicyOpen(false)} />
    </div>
  );
}
