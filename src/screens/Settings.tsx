import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notifApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { useTranslation } from "../i18n";

/**
 * Notification Settings (알림 설정) — two push-preference toggles.
 *
 * The service switch controls **push delivery only**: the backend still writes
 * the in-app notification record and gates only the external push on it (see
 * NotificationService._fanout_push). The marketing switch is the marketing
 * consent: without it a promotional notice creates neither an inbox row nor a
 * push (NotificationService.deliver_marketing). This screen never touches the
 * in-app notification list, history, or unread state.
 */
type PushKey = "service_notifications" | "marketing";

const BackChevron = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M15 5l-7 7 7 7" stroke="#262c31" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function Switch({
  on,
  disabled,
  label,
  onToggle,
}: {
  on: boolean;
  disabled: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`nset__switch ${on ? "is-on" : ""}`}
      disabled={disabled}
      onClick={onToggle}
    >
      <span className="nset__thumb" aria-hidden="true" />
    </button>
  );
}

export function Settings() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation();

  const q = useQuery({ queryKey: ["notif-settings"], queryFn: notifApi.settings });
  const settings = q.data as Record<string, boolean> | undefined;
  const [pending, setPending] = useState<Set<PushKey>>(new Set());

  async function toggle(key: PushKey) {
    if (!settings || pending.has(key)) return; // block rapid repeat taps per switch
    const previous = settings;
    const next = { ...settings, [key]: !settings[key] };
    // Optimistic: flip immediately, keeping the other toggle untouched.
    qc.setQueryData(["notif-settings"], next);
    setPending((p) => new Set(p).add(key));
    try {
      const saved = await notifApi.updateSettings(next);
      qc.setQueryData(["notif-settings"], saved);
    } catch {
      qc.setQueryData(["notif-settings"], previous); // roll back to the server value
      toast.error(t("notificationSettings.error"));
    } finally {
      setPending((p) => {
        const n = new Set(p);
        n.delete(key);
        return n;
      });
    }
  }

  return (
    <div className="screen nset">
      <header className="nset__header">
        <button className="nset__back" onClick={() => nav(-1)} aria-label={t("common.back")}>
          <BackChevron />
        </button>
        <h1 className="nset__title">{t("notificationSettings.title")}</h1>
      </header>

      <div className="screen__body nset__body">
        {/* Render only once the saved values are loaded — never flash defaults. */}
        {settings && (
          <>
            <div className="nset__row">
              <span className="nset__label">{t("notificationSettings.service")}</span>
              <Switch
                on={!!settings.service_notifications}
                disabled={pending.has("service_notifications")}
                label={t("notificationSettings.service")}
                onToggle={() => toggle("service_notifications")}
              />
            </div>
            <div className="nset__row">
              <span className="nset__label">{t("notificationSettings.marketing")}</span>
              <Switch
                on={!!settings.marketing}
                disabled={pending.has("marketing")}
                label={t("notificationSettings.marketing")}
                onToggle={() => toggle("marketing")}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
