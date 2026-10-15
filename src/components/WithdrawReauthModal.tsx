import { useEffect, useRef } from "react";
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
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusables = () =>
      Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? []);
    focusables()[0]?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (!loading) {
          e.preventDefault();
          onCancel();
        }
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open, loading, onCancel]);

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
          <div style={{ display: "grid", placeItems: "center", padding: "12px 0" }}>
            <Spinner size={22} stroke={2.5} label={t("withdrawReauth.deleting")} />
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8, margin: "12px 0" }}>
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
