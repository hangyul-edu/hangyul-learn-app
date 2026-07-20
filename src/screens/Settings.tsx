import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notifApi } from "../api/endpoints";
import { useAuth } from "../hooks/auth";
import { useToast } from "../hooks/toast";
import { normalizeLanguage, type AppLanguage } from "../lib/language";

/**
 * Notification Settings (알림 설정) — two push-preference toggles.
 *
 * Both switches control **push delivery only**: the backend always writes the
 * in-app notification record and gates only the external push on these fields
 * (see NotificationService._fanout_push). This screen never touches the
 * in-app notification list, history, or unread state.
 */
type PushKey = "service_notifications" | "marketing";

interface SetCopy {
  title: string;
  back: string;
  service: string;
  marketing: string;
  error: string;
}
const COPY: Record<AppLanguage, SetCopy> = {
  ko: {
    title: "알림 설정",
    back: "뒤로 가기",
    service: "서비스 알림",
    marketing: "광고성 알림",
    error: "설정을 변경하지 못했어요.",
  },
  en: {
    title: "Notification Settings",
    back: "Go back",
    service: "Service Notifications",
    marketing: "Marketing Notifications",
    error: "Couldn't update the setting.",
  },
};

const BackChevron = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M15 5l-7 7 7 7" stroke="#272c30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
  const { me } = useAuth();
  const copy = COPY[normalizeLanguage(me?.app_language)];

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
      toast.error(copy.error);
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
        <button className="nset__back" onClick={() => nav(-1)} aria-label={copy.back}>
          <BackChevron />
        </button>
        <h1 className="nset__title">{copy.title}</h1>
      </header>

      <div className="screen__body nset__body">
        {/* Render only once the saved values are loaded — never flash defaults. */}
        {settings && (
          <>
            <div className="nset__row">
              <span className="nset__label">{copy.service}</span>
              <Switch
                on={!!settings.service_notifications}
                disabled={pending.has("service_notifications")}
                label={copy.service}
                onToggle={() => toggle("service_notifications")}
              />
            </div>
            <div className="nset__row">
              <span className="nset__label">{copy.marketing}</span>
              <Switch
                on={!!settings.marketing}
                disabled={pending.has("marketing")}
                label={copy.marketing}
                onToggle={() => toggle("marketing")}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
