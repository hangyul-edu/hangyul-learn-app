import { useEffect, useRef } from "react";
import { useTranslation } from "../i18n";

/**
 * Logout confirmation modal. Opening it calls no API; only the orange 로그아웃
 * button triggers the parent's `onConfirm`, which revokes the server session
 * (`revokeSession`, POST /auth/logout with the refresh token) and then calls
 * `hardSignOut` → clears tokens + current-user + every user-scoped query cache;
 * the route guard resets navigation to the logged-out root. 취소 / Escape close
 * without logging out; the backdrop is not a dismiss target. Both buttons are
 * disabled while the request is in flight. Focus is trapped and restored to the
 * opener (the 로그아웃 menu item) on cancel.
 */
export function LogoutModal({
  open,
  loading,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
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
    // Focus the primary confirmation action.
    focusables().find((b) => b.classList.contains("lgo__btn--go"))?.focus();

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
        className="lgo"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lgo-title"
        aria-describedby="lgo-desc"
      >
        <h2 className="lgo__title" id="lgo-title">{t("misc.logoutTitle")}</h2>
        <p className="lgo__copy" id="lgo-desc">{t("misc.logoutBody")}</p>

        <div className="lgo__actions">
          <button className="lgo__btn lgo__btn--cancel" onClick={onCancel} disabled={loading}>
            {t("common.cancel")}
          </button>
          <button className="lgo__btn lgo__btn--go" onClick={onConfirm} disabled={loading}>
            {loading ? <span className="spinner" style={{ width: 22, height: 22, borderWidth: 2.5 }} /> : t("misc.logout")}
          </button>
        </div>
      </div>
    </div>
  );
}
