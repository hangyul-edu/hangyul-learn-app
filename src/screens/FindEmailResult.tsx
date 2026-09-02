import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "../i18n";

/**
 * Successful "이메일 찾기" result — shows the account email (already masked by
 * the backend's recover_email endpoint) and routes onward. The masked value
 * arrives via navigation state from FindEmail; it is not persisted anywhere.
 *
 * Reuses the `.findemail` root for the shared tokens / scroll / back / bottom
 * button, with `.feres__*` for the result-specific text.
 */
export function FindEmailResult() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const location = useLocation();
  const email = (location.state as { email?: string } | null)?.email;

  // Guard: opened without a valid lookup result → back to the lookup form.
  if (!email) return <Navigate to="/forgot" state={{ mode: "email" }} replace />;

  return (
    <div className="screen findemail feres">
      <div className="findemail__scroll">
        <div className="findemail__inner">
          <button className="findemail__back" onClick={() => nav(-1)} aria-label={t("common.back")}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <h1 className="feres__title">{t("findEmailResult.title")}</h1>
          <p className="feres__subtitle">{t("findEmailResult.subtitle")}</p>

          <p className="feres__email" aria-label={t("findEmailResult.emailA11y", { email })}>
            {email}
          </p>

          <div className="feres__prompt-row">
            <span className="feres__prompt">{t("findEmailResult.forgotPrompt")}</span>
            <button
              type="button"
              className="feres__link"
              onClick={() => nav("/forgot", { state: { mode: "password" } })}
            >
              {t("findEmailResult.forgotLink")}
            </button>
          </div>

          <div className="findemail__spacer" />

          <button
            type="button"
            className="findemail__submit"
            onClick={() => nav("/login", { replace: true })}
            aria-label={t("findEmailResult.goToLogin")}
          >
            {t("findEmailResult.goToLogin")}
          </button>
        </div>
      </div>
    </div>
  );
}
