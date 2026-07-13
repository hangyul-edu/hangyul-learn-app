import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Screen } from "../components/layout/Screen";
import { Chip, Segmented } from "../components/ui/kit";
import { Async, EmptyState, SkeletonList } from "../components/ui/states";
import { quizApi, sentenceApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";

export function Saved() {
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"sentence" | "quiz">("sentence");
  const [saveType, setSaveType] = useState("all");

  const sentences = useQuery({
    queryKey: ["saved-sentences", saveType],
    queryFn: () => sentenceApi.saved({ save_type: saveType }),
    enabled: tab === "sentence",
  });
  const quizzes = useQuery({
    queryKey: ["saved-quizzes"],
    queryFn: () => quizApi.bookmarks({}),
    enabled: tab === "quiz",
  });

  async function removeSentence(id: string) {
    try {
      await sentenceApi.removeSaved(id);
      qc.invalidateQueries({ queryKey: ["saved-sentences"] });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <Screen title="저장 · 복습" back>
      <div style={{ marginBottom: 14 }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "sentence", label: "문장" },
            { value: "quiz", label: "문제" },
          ]}
        />
      </div>

      {tab === "sentence" && (
        <>
          <div className="chiprow" style={{ marginBottom: 12 }}>
            {[
              { v: "all", l: "전체" },
              { v: "favorite", l: "⭐ 즐겨찾기" },
              { v: "auto_wrong", l: "❌ 오답노트" },
            ].map((f) => (
              <Chip key={f.v} active={saveType === f.v} onClick={() => setSaveType(f.v)}>
                {f.l}
              </Chip>
            ))}
          </div>
          <Async
            loading={sentences.isLoading}
            error={sentences.error}
            data={sentences.data}
            onRetry={() => sentences.refetch()}
            isEmpty={(d) => d.items.length === 0}
            empty={<EmptyState emoji="🔖" title="저장한 문장이 없어요" text="학습하면서 마음에 드는 문장을 저장해 보세요." />}
            skeleton={<SkeletonList rows={5} />}
          >
            {(d) => (
              <div className="stack" style={{ gap: 10 }}>
                {d.items.map((s) => (
                  <div key={s.sentence_id} className="card">
                    <div className="row row--between">
                      <div style={{ flex: 1 }}>
                        <div className="hangul-lg" style={{ fontSize: 17 }}>{s.korean}</div>
                        <div className="muted" style={{ fontSize: 13, marginTop: 3 }}>{s.translation}</div>
                        <div className="row" style={{ gap: 6, marginTop: 8 }}>
                          {s.save_types.includes("favorite") && <span className="badge">⭐ 즐겨찾기</span>}
                          {s.save_types.includes("auto_wrong") && <span className="badge badge--danger">오답 {s.wrong_count ?? ""}</span>}
                        </div>
                      </div>
                      <button className="topbar__btn" onClick={() => removeSentence(s.sentence_id)} title="삭제">
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Async>
        </>
      )}

      {tab === "quiz" && (
        <Async
          loading={quizzes.isLoading}
          error={quizzes.error}
          data={quizzes.data}
          onRetry={() => quizzes.refetch()}
          isEmpty={(d) => (d.items?.length ?? 0) === 0}
          empty={<EmptyState emoji="📝" title="저장한 문제가 없어요" text="문제를 풀며 다시 볼 문제를 저장해 보세요." />}
          skeleton={<SkeletonList rows={5} />}
        >
          {(d) => (
            <div className="stack" style={{ gap: 10 }}>
              {d.items.map((qz) => (
                <button key={qz.quiz_id} className="listrow" onClick={() => nav(`/quiz/${qz.quiz_id}`)}>
                  <div className="listrow__main">
                    <div className="listrow__title">{qz.prompt || "TOPIK 문제"}</div>
                    <div className="listrow__sub">{qz.topik_section ?? ""}</div>
                  </div>
                  <span className="listrow__chev">›</span>
                </button>
              ))}
            </div>
          )}
        </Async>
      )}
    </Screen>
  );
}
