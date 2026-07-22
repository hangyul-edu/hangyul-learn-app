import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Screen } from "../components/layout/Screen";
import { Button, ProgressBar } from "../components/ui/kit";
import { Async } from "../components/ui/states";
import { learnApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { useMarkStudied } from "../hooks/learningActivity";
import { ApiError, errorMessage } from "../lib/http";
import type { Lecture as Lec } from "../lib/types";

function fmt(sec: number) {
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
}

export function Lecture() {
  const { lectureId = "" } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [pos, setPos] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [premiumLocked, setPremiumLocked] = useState(false);
  const [saving, setSaving] = useState(false);

  const markStudied = useMarkStudied();

  const q = useQuery({ queryKey: ["lecture", lectureId], queryFn: () => learnApi.lecture(lectureId) });

  useEffect(() => {
    if (q.data) setPos(q.data.my_playback?.last_position_seconds ?? 0);
  }, [q.data]);

  // Try to fetch a real playback URL; premium content 402s → show the gate.
  useEffect(() => {
    if (!q.data) return;
    learnApi
      .lecturePlay(lectureId)
      .then((r) => setVideoUrl(r.video.url))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 402) setPremiumLocked(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data]);

  async function saveProgress(seconds: number, done: boolean) {
    setSaving(true);
    try {
      await learnApi.progress(lectureId, seconds);
      setPos(seconds);
      if (done) {
        toast.success("학습을 완료했어요! 🎉");
        qc.invalidateQueries({ queryKey: ["dashboard"] });
        qc.invalidateQueries({ queryKey: ["course"] });
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen title="레슨" back>
      <Async loading={q.isLoading} error={q.error} data={q.data} onRetry={() => q.refetch()}>
        {(l: Lec) => (
          <div className="stack" style={{ gap: 16 }}>
            {/* player / poster */}
            <div style={{ position: "relative", borderRadius: 18, overflow: "hidden", background: "#1f1712", aspectRatio: "16/9", display: "grid", placeItems: "center" }}>
              {videoUrl ? (
                <video
                  src={videoUrl}
                  controls
                  poster={l.thumbnail_url ?? undefined}
                  style={{ width: "100%", height: "100%" }}
                  // Playback genuinely started (position > 0) → count today's
                  // learning day and light the sun. Idempotent; fires once.
                  onTimeUpdate={(e) => {
                    if (e.currentTarget.currentTime > 0) markStudied("lecture", lectureId);
                  }}
                />
              ) : premiumLocked ? (
                <div className="center" style={{ color: "#fff", padding: 20 }}>
                  <div style={{ fontSize: 34 }}>👑</div>
                  <div style={{ fontWeight: 800, marginTop: 6 }}>프리미엄 강의</div>
                  <Button size="sm" style={{ marginTop: 10 }} onClick={() => nav("/subscription")}>업그레이드</Button>
                </div>
              ) : (
                <div className="center" style={{ color: "#fff" }}>
                  <div style={{ fontSize: 40 }}>▶️</div>
                  <div className="dim" style={{ fontSize: 12, marginTop: 4 }}>{fmt(l.duration_seconds)}</div>
                </div>
              )}
            </div>

            <div>
              <h2 style={{ fontSize: 20 }}>{l.title}</h2>
              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                {l.kind === "video" ? "영상 강의" : l.kind === "listening" ? "듣기" : "읽기"} · 레벨 {l.level}
                {l.completed && <span style={{ color: "var(--success)", fontWeight: 700 }}> · ✓ 완료</span>}
              </div>
            </div>

            {/* progress */}
            <div className="card">
              <div className="row row--between" style={{ marginBottom: 8 }}>
                <span className="muted" style={{ fontSize: 13 }}>진행률</span>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{fmt(pos)} / {fmt(l.duration_seconds)}</span>
              </div>
              <ProgressBar value={l.duration_seconds ? pos / l.duration_seconds : 0} />
              <input
                type="range"
                min={0}
                max={l.duration_seconds}
                value={pos}
                onChange={(e) => setPos(Number(e.target.value))}
                onMouseUp={() => saveProgress(pos, false)}
                onTouchEnd={() => saveProgress(pos, false)}
                style={{ width: "100%", marginTop: 10, accentColor: "var(--brand-500)" }}
              />
            </div>

            {l.checkpoints.length > 0 && (
              <div>
                <div className="section-title">체크포인트</div>
                <div className="chiprow">
                  {l.checkpoints.map((c) => (
                    <span key={c.checkpoint_id} className="chip chip--static">
                      {fmt(c.at_second)} · {c.interaction_type === "speaking_exercise" ? "말하기" : c.interaction_type === "multiple_choice" ? "객관식" : "단답"}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <Button size="lg" block loading={saving} onClick={() => saveProgress(l.duration_seconds, true)}>
              학습 완료로 표시
            </Button>
            {l.topik_question_type && (
              <Button variant="secondary" block onClick={() => nav(`/lectures/${l.lecture_id}/practice`)}>
                📝 복습 문제 풀기
              </Button>
            )}
          </div>
        )}
      </Async>
    </Screen>
  );
}
