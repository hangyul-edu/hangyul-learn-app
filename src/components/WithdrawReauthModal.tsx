import { useRef } from "react";
import { useModalFocus } from "../hooks/useModalFocus";
import { useTranslation, type TranslationKey } from "../i18n";
import type { SocialProvider } from "../lib/types";
import { Spinner } from "./ui/Spinner";

const PROVIDER_LABEL: Record<SocialProvider, TranslationKey> = {
  google: "welcome.google",
  apple: "welcome.apple",
  kakao: "welcome.kakao",
  facebook: "welcome.facebook",
  line: "welcome.line",
};

/**
 * Second-step withdrawal gate for an account created by social login, which
 * has no password: the member confirms it is them by signing in again with
 * one of the account's linked providers (the same provider-redirect flow as
 * login, with `purpose=reauth` — no session is issued). Picking a provider
 * leaves the SPA; the deletion completes when the browser comes back.
 *
 * `providers` are the linked providers this server can re-authenticate on the
 * web. When there are none (e.g. the account's provider has no web flow
 * configured) the modal says the deletion must be done in the app.
 *
 * Same interaction rules as the password step: no backdrop dismiss, 취소 /
 * Escape close it (disabled while a request is in flight), focus trapped and
 * restored.
 */
export function WithdrawReauthModal({
  open,
  loading,
  providers,
  error,
  onCancel,
  onSelect,
}: {
  open: boolean;
  loading: boolean;
  providers: SocialProvider[];
  /** User-safe message for the last attempt, or null. */
  error: string | null;
  onCancel: () => void;
  onSelect: (provider: SocialProvider) => void;
}) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);

  useModalFocus({ open, containerRef: dialogRef, onEscape: loading ? undefined : onCancel });

  if (!open) return null;

  return (
    <div className="overlay overlay--center wd__overlay">
      <div
        ref={dialogRef}
        className="wdp"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wdr-title"
        aria-describedby="wdr-desc"
        aria-busy={loading}
      >
        <h2 className="wd__title" id="wdr-title">{t("withdrawReauth.title")}</h2>
        <p className="wd__guide" id="wdr-desc">
          {providers.length > 0 ? t("withdrawReauth.guide") : t("withdrawReauth.unavailable")}
        </p>

        {loading ? (
          <div className="wdr__busy">
            <Spinner size={22} stroke={2.5} label={t("withdrawReauth.deleting")} />
          </div>
        ) : (
          <div className="wdr__providers">
            {providers.map((p) => (
              <button key={p} className="wd__btn wd__btn--go" onClick={() => onSelect(p)}>
                {t(PROVIDER_LABEL[p])}
              </button>
            ))}
          </div>
        )}
        <p className="wdp__err" role="alert" aria-live="assertive">{error ?? ""}</p>

        <div className="wd__actions">
          <button className="wd__btn wd__btn--cancel" onClick={onCancel} disabled={loading}>
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
