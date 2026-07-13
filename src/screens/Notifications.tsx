import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Screen } from "../components/layout/Screen";
import { Chip } from "../components/ui/kit";
import { Async, EmptyState, SkeletonList } from "../components/ui/states";
import { notifApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { timeAgo } from "../lib/format";
import type { NotificationItem } from "../lib/types";

const ICON: Record<string, string> = {
  learning_reminder: "📚",
  streak: "🔥",
  points: "⚡",
  league: "🏆",
  friend: "👥",
  announcement: "📢",
  system: "⚙️",
};

export function Notifications() {
  const toast = useToast();
  const qc = useQueryClient();
  const [group, setGroup] = useState("all");
  const q = useQuery({ queryKey: ["notifications", group], queryFn: () => notifApi.list({ group: group === "all" ? undefined : group }) });

  const items: NotificationItem[] =
    q.data?.sections?.flatMap((s) => s.items) ?? q.data?.items ?? [];

  async function readAll() {
    try {
      await notifApi.readAll();
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notif-unread"] });
      toast.success("모두 읽음 처리했어요");
    } catch {
      /* ignore */
    }
  }

  return (
    <Screen
      title="알림"
      back
      right={
        <button className="input-affix__btn" style={{ position: "static" }} onClick={readAll}>
          모두 읽음
        </button>
      }
    >
      <div className="chiprow" style={{ marginBottom: 14 }}>
        {[
          { v: "all", l: "전체" },
          { v: "learning", l: "학습" },
          { v: "social", l: "소셜" },
          { v: "announcement", l: "공지" },
        ].map((g) => (
          <Chip key={g.v} active={group === g.v} onClick={() => setGroup(g.v)}>
            {g.l}
          </Chip>
        ))}
      </div>

      <Async
        loading={q.isLoading}
        error={q.error}
        data={q.data}
        onRetry={() => q.refetch()}
        isEmpty={() => items.length === 0}
        empty={<EmptyState emoji="🔔" title="새 알림이 없어요" text="학습 소식과 친구 활동을 여기서 확인해요." />}
        skeleton={<SkeletonList rows={5} height={70} />}
      >
        {() => (
          <div className="stack" style={{ gap: 8 }}>
            {items.map((n) => (
              <div key={n.notification_id} className="card row" style={{ background: n.read ? undefined : "var(--brand-50)", borderColor: n.read ? undefined : "var(--brand-200)", alignItems: "flex-start" }}>
                <span style={{ fontSize: 22 }}>{ICON[n.category] ?? "🔔"}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>{n.title}</div>
                  <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{n.body}</div>
                  <div className="dim" style={{ fontSize: 11.5, marginTop: 5 }}>{timeAgo(n.created_at)}</div>
                </div>
                {!n.read && <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--brand-500)", marginTop: 6 }} />}
              </div>
            ))}
          </div>
        )}
      </Async>
    </Screen>
  );
}
