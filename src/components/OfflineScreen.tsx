import { useEffect, useState } from "react";
import { useTranslation } from "../i18n";
import offlineArt from "../assets/brand/sys-offline.svg";

/**
 * Full-screen "no connection" state — Figma SYS-001 (KO 1567:25122, EN
 * 1567:25152). The frame is 375x812 with a 44px status bar the web app does not
 * draw, so each position below is `figma-y − 44`:
 *
 *   art     Group 1410118951 — 123x123 at (126, 221)
 *   title   SemiBold 30 / 1.38, tracking -0.3, centred, top 368
 *   desc    Medium 15 / 21.5, Gray 6, centred, top 417
 *   retry   cp_C_02_secondaryBtn — 335 wide at (20, 483)
 */
export function OfflineScreen({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="screen sysoff" role="alert">
      <img className="sysoff__art" src={offlineArt} alt="" aria-hidden="true" />
      <h1 className="sysoff__title">{t("offline.title")}</h1>
      <p className="sysoff__desc">
        {t("offline.line1")}
        <br />
        {t("offline.line2")}
      </p>
      <button type="button" className="sysoff__retry" onClick={onRetry}>
        {t("offline.retry")}
      </button>
    </div>
  );
}

/**
 * Renders SYS-001 over the whole app while the browser reports no network, so
 * every screen gets the designed offline state instead of a per-screen error.
 * Retry re-checks `navigator.onLine` and, when back, reloads the queries by
 * letting the app render again (the browser's own `online` event does the same
 * automatically).
 */
export function OfflineGate({ children }: { children: React.ReactNode }) {
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && navigator.onLine === false);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  if (offline) {
    return (
      <div className="app-frame">
        <OfflineScreen onRetry={() => setOffline(navigator.onLine === false)} />
      </div>
    );
  }
  return <>{children}</>;
}
