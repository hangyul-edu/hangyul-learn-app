import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Screen } from "../components/layout/Screen";
import { Async, SkeletonList } from "../components/ui/states";
import { learnApi } from "../api/endpoints";
import type { Course } from "../lib/types";

function fmtDur(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// The lecture tab (LectureHome) is the catalog browser; this file keeps only
// the course-detail screen reachable at /courses/:courseId.
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
