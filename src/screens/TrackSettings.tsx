import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Screen } from "../components/layout/Screen";
import { Button, Chip } from "../components/ui/kit";
import { Async, SkeletonList } from "../components/ui/states";
import { settingsApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";

const GOALS = [5, 10, 20, 30, 40];
const LABEL: Record<string, string> = { conversation: "실전 회화", topik: "TOPIK" };

/**
 * Per-category learning settings (conversation / TOPIK), opened from the Custom
 * Learning Settings list. Minimal editor over the same authoritative preferences
 * (settingsApi.learning / updateLearning): shows the current level (read-only)
 * and lets the user change the daily goal. Saving invalidates the dashboard so
 * Home reflects the new goal. The list screen only summarizes these values.
 */
export function TrackSettings() {
  const { category: raw } = useParams<{ category: string }>();
  const category = raw === "topik" ? "topik" : "conversation";
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["learning-prefs"], queryFn: settingsApi.learning });

  const [goal, setGoal] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const pref = q.data?.categories.find((c) => c.category === category);

  useEffect(() => {
    if (pref && goal == null) setGoal(pref.daily_goal);
  }, [pref, goal]);

  async function save() {
    if (!q.data || !pref || goal == null || busy) return;
    setBusy(true);
    const categories = q.data.categories.map((c) => (c.category === category ? { ...c, daily_goal: goal } : c));
    try {
      const res = await settingsApi.updateLearning(categories);
      qc.setQueryData(["learning-prefs"], res);
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("저장했어요");
      nav(-1);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const levelText = pref ? (category === "topik" ? `${pref.level}급` : `Lv.${pref.level}`) : "-";
  const changed = !!pref && goal != null && goal !== pref.daily_goal;

  return (
    <Screen title={`${LABEL[category]} 학습 설정`} back>
      <Async
        loading={q.isLoading}
        error={q.error}
        data={q.data}
        onRetry={() => q.refetch()}
        isEmpty={() => !pref}
        skeleton={<SkeletonList rows={2} height={64} />}
      >
        {() => (
          <div className="stack" style={{ gap: 22 }}>
            <div className="card card--flat" style={{ background: "var(--surface-2)" }}>
              <div className="row row--between" style={{ fontSize: 14 }}>
                <span className="muted">현재 레벨</span>
                <span style={{ fontWeight: 800 }}>{levelText}</span>
              </div>
            </div>

            <div>
              <div className="section-title" style={{ marginBottom: 10 }}>하루 목표</div>
              <div className="chiprow" role="radiogroup" aria-label="하루 목표 선택">
                {GOALS.map((n) => (
                  <Chip key={n} active={goal === n} onClick={() => setGoal(n)}>
                    {n}
                  </Chip>
                ))}
              </div>
            </div>

            <Button size="lg" block loading={busy} disabled={!changed} onClick={save}>
              저장
            </Button>
          </div>
        )}
      </Async>
    </Screen>
  );
}
