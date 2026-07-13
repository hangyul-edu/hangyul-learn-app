import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Screen } from "../components/layout/Screen";
import { Card, Segmented } from "../components/ui/kit";
import { Async, EmptyState, SkeletonList } from "../components/ui/states";
import { learnApi } from "../api/endpoints";
import type { Course } from "../lib/types";

function fmtDur(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function Courses() {
  const nav = useNavigate();
  const [track, setTrack] = useState("track_conversation");
  const q = useQuery({ queryKey: ["courses", track], queryFn: () => learnApi.courses(track) });

  return (
    <Screen title="강의" back>
      <div style={{ marginBottom: 14 }}>
        <Segmented
          value={track}
          onChange={setTrack}
          options={[
            { value: "track_conversation", label: "회화" },
            { value: "track_topik", label: "TOPIK" },
          ]}
        />
      </div>
      <Async
        loading={q.isLoading}
        error={q.error}
        data={q.data}
        onRetry={() => q.refetch()}
        isEmpty={(d) => d.items.length === 0}
        empty={<EmptyState emoji="🎬" title="강의가 없어요" text="곧 새로운 강의가 추가돼요." />}
        skeleton={<SkeletonList rows={4} height={90} />}
      >
        {(d) => (
          <div className="stack" style={{ gap: 12 }}>
            {d.items.map((c: Course) => {
              const pct = c.lesson_count ? c.completed_lesson_count / c.lesson_count : 0;
              return (
                <Card key={c.course_id} onClick={() => nav(`/courses/${c.course_id}`)}>
                  <div className="row" style={{ alignItems: "flex-start" }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--brand-gradient-soft)", display: "grid", placeItems: "center", fontSize: 26 }}>🎬</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: 15.5 }}>{c.title}</div>
                      <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                        {c.level ? `레벨 ${c.level} · ` : ""}{c.completed_lesson_count}/{c.lesson_count} 완료
                      </div>
                      <div className="progress" style={{ marginTop: 8, height: 6 }}>
                        <div className="progress__bar" style={{ width: `${pct * 100}%` }} />
                      </div>
                    </div>
                    <span className="listrow__chev">›</span>
                  </div>
                  {c.lessons_preview && c.lessons_preview.length > 0 && (
                    <div className="dim" style={{ fontSize: 11.5, marginTop: 10 }}>
                      다음: {c.lessons_preview[0].title} · {fmtDur(c.lessons_preview[0].duration_seconds)}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </Async>
    </Screen>
  );
}

export function CourseDetail() {
  const { courseId = "" } = useParams();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ["course", courseId], queryFn: () => learnApi.course(courseId) });

  return (
    <Screen title="강의" back>
      <Async loading={q.isLoading} error={q.error} data={q.data} onRetry={() => q.refetch()} skeleton={<SkeletonList rows={4} />}>
        {(c: Course) => (
          <div className="stack" style={{ gap: 16 }}>
            <div>
              <h2 style={{ fontSize: 22 }}>{c.title}</h2>
              {c.description && <p className="muted" style={{ marginTop: 6 }}>{c.description}</p>}
            </div>
            <div className="section-title">레슨 {c.lesson_count}개</div>
            <div className="stack" style={{ gap: 8 }}>
              {(c.lessons ?? []).map((l, i) => (
                <button key={l.lecture_id} className="listrow" onClick={() => nav(`/lectures/${l.lecture_id}`)}>
                  <div className="avatar" style={{ width: 38, height: 38, background: l.completed ? "var(--success-bg)" : "var(--surface-3)", color: l.completed ? "var(--success)" : "var(--ink-2)", fontSize: 15 }}>
                    {l.completed ? "✓" : i + 1}
                  </div>
                  <div className="listrow__main">
                    <div className="listrow__title">{l.title}</div>
                    <div className="listrow__sub">
                      {l.kind === "video" ? "🎬 영상" : l.kind === "listening" ? "🎧 듣기" : "📖 읽기"} · {fmtDur(l.duration_seconds)}
                      {l.access === "premium" && " · 👑"}
                    </div>
                  </div>
                  <span className="listrow__chev">›</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </Async>
    </Screen>
  );
}
