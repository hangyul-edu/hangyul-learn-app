import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Screen } from "../components/layout/Screen";
import { Card, Segmented } from "../components/ui/kit";
import { LoadingState } from "../components/ui/states";
import { notifApi, settingsApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import type { AppSettings } from "../lib/types";

function Switch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: 48,
        height: 28,
        borderRadius: 999,
        border: "none",
        cursor: "pointer",
        background: on ? "var(--brand-500)" : "var(--border-strong)",
        position: "relative",
        transition: "background 0.15s",
        flexShrink: 0,
      }}
    >
      <span style={{ position: "absolute", top: 3, left: on ? 23 : 3, width: 22, height: 22, borderRadius: 999, background: "#fff", transition: "left 0.15s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
    </button>
  );
}

function ToggleRow({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="row row--between" style={{ padding: "10px 2px" }}>
      <span style={{ fontSize: 14.5, fontWeight: 600 }}>{label}</span>
      <Switch on={on} onToggle={onToggle} />
    </div>
  );
}

export function Settings() {
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["settings"], queryFn: settingsApi.get });
  const notif = useQuery({ queryKey: ["notif-settings"], queryFn: notifApi.settings });

  async function update(patch: Partial<AppSettings>) {
    try {
      const next = await settingsApi.update(patch);
      qc.setQueryData(["settings"], next);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  async function updateNotif(patch: Record<string, unknown>) {
    try {
      const next = await notifApi.updateSettings({ ...(notif.data ?? {}), ...patch });
      qc.setQueryData(["notif-settings"], next);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  if (q.isLoading) return <Screen title="설정" back><LoadingState /></Screen>;
  const s = q.data!;
  const n = (notif.data ?? {}) as Record<string, boolean>;

  return (
    <Screen title="설정" back>
      <div className="stack" style={{ gap: 18 }}>
        <div>
          <div className="field__label" style={{ marginBottom: 8 }}>테마</div>
          <Segmented
            value={s.theme}
            onChange={(theme) => update({ theme })}
            options={[
              { value: "system", label: "시스템" },
              { value: "light", label: "라이트" },
              { value: "dark", label: "다크" },
            ]}
          />
        </div>

        <Card>
          <div className="eyebrow" style={{ marginBottom: 4 }}>학습</div>
          <ToggleRow label="효과음" on={s.sound_effects} onToggle={() => update({ sound_effects: !s.sound_effects })} />
          <ToggleRow label="진동" on={s.vibration} onToggle={() => update({ vibration: !s.vibration })} />
          <ToggleRow label="오디오 자동 재생" on={s.autoplay_audio} onToggle={() => update({ autoplay_audio: !s.autoplay_audio })} />
          <ToggleRow label="발음(로마자) 표시" on={s.show_romanization} onToggle={() => update({ show_romanization: !s.show_romanization })} />
        </Card>

        {notif.data && (
          <Card>
            <div className="eyebrow" style={{ marginBottom: 4 }}>알림</div>
            <ToggleRow label="푸시 알림" on={!!n.push_enabled} onToggle={() => updateNotif({ push_enabled: !n.push_enabled })} />
            <ToggleRow label="학습 리마인더" on={!!n.learning_reminder} onToggle={() => updateNotif({ learning_reminder: !n.learning_reminder })} />
            <ToggleRow label="친구 활동" on={!!n.friend_alerts} onToggle={() => updateNotif({ friend_alerts: !n.friend_alerts })} />
            <ToggleRow label="리그 소식" on={!!n.league_alerts} onToggle={() => updateNotif({ league_alerts: !n.league_alerts })} />
            <ToggleRow label="마케팅 정보 수신" on={!!n.marketing} onToggle={() => updateNotif({ marketing: !n.marketing })} />
          </Card>
        )}
      </div>
    </Screen>
  );
}
