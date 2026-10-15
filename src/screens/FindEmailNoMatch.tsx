import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "../i18n";
import { BackChevronIcon } from "../components/brand/Glyphs";

/**
 * "No matching account" result — shown only when the email lookup returns the
 * backend's account-not-found result (404 `user_not_found`). It carries no
 * account data; a state marker guards against direct/stale navigation.
 *
 * Reuses the `.findemail` root (tokens / scroll / back / bottom button) with
 * `.fenm__*` for the result-specific text.
 */
export function FindEmailNoMatch() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const location = useLocation();
  const valid = (location.state as { noMatch?: boolean } | null)?.noMatch === true;

  // Opened without a valid account-not-found result → back to the lookup form.
  if (!valid) return <Navigate to="/forgot" state={{ mode: "email" }} replace />;

  return (
    <div className="screen findemail fenm">
      <div className="findemail__scroll">
        <div className="findemail__inner">
          <button className="findemail__back" onClick={() => nav(-1)} aria-label={t("common.back")}>
            <BackChevronIcon size={26} />
          </button>

          <h1 className="fenm__title">
            {t("findEmailNoMatch.titleLine1")}
            <br />
            {t("findEmailNoMatch.titleLine2")}
          </h1>
          <p className="fenm__desc">
            {t("findEmailNoMatch.descLine1")}
            <br />
            {t("findEmailNoMatch.descLine2")}
          </p>

          <div className="fenm__prompt-row">
            <span className="fenm__prompt">{t("findEmailNoMatch.prompt")}</span>
            <button type="button" className="fenm__link" onClick={() => nav("/signup")}>
              {t("findEmailNoMatch.signupLink")}
            </button>
          </div>

          <div className="findemail__spacer" />

          <button
            type="button"
            className="findemail__submit"
            onClick={() => nav(-1)}
            aria-label={t("findEmailNoMatch.retryA11y")}
          >
            {t("findEmailNoMatch.retry")}
          </button>
        </div>
      </div>
    </div>
  );
}
