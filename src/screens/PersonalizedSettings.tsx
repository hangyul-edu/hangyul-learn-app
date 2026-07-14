import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SpeakingIcon, PencilIcon, ChevronRight } from "../components/brand/HomeIcons";
import { SkeletonList } from "../components/ui/states";
import { settingsApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import type { CategoryPref, LearningPreferences } from "../lib/types";

const CAT_LABEL: Record<string, string> = { conversation: "실전 회화", topik: "TOPIK" };
const catLabel = (c: string) => CAT_LABEL[c] ?? c;
const catIcon = (c: string) => (c === "topik" ? <PencilIcon /> : <SpeakingIcon />);
const detailRoute = (c: string) => `/recommend/settings/${c === "topik" ? "topik" : "conversation"}`;
function secondary(c: CategoryPref): string {
  return c.category === "topik" ? `${c.level}급 | 목표 ${c.daily_goal}` : `Lv.${c.level} | 목표 ${c.daily_goal}`;
}
function srSummary(c: CategoryPref, pos: number, total: number): string {
  const level = c.category === "topik" ? `${c.level}급` : `레벨 ${c.level}`;
  return `${catLabel(c.category)}, ${level}, 하루 목표 ${c.daily_goal}, ${pos}번째 항목 (총 ${total}개)`;
}
const sortByOrder = (p?: LearningPreferences) => [...(p?.categories ?? [])].sort((a, b) => a.order - b.order);
function move<T>(arr: T[], from: number, to: number): T[] {
  const next = arr.slice();
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}

/** Drag-handle glyph (≡). */
function HandleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 8h14M5 12h14M5 16h14" stroke="#D6D9DB" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Custom Learning Settings ("맞춤 학습 설정"). Lists the enabled learning tracks
 * from the authoritative per-category preferences (settingsApi.learning), lets
 * the user reorder them (drag handle or keyboard) — the top track shows first on
 * Home — and opens each track's detail settings. Order/level/goal are all
 * server-driven; reorder persists via settingsApi.updateLearningOrder (ordered
 * category ids only — optimistic + rollback), and invalidating the dashboard
 * keeps Home in sync. Level/goal are edited on each track's own screen.
 */
export function PersonalizedSettings() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["learning-prefs"], queryFn: settingsApi.learning });

  const [items, setItems] = useState<CategoryPref[]>([]);
  const [announce, setAnnounce] = useState("");

  // drag refs/state
  const listRef = useRef<HTMLUListElement>(null);
  const handleRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const dragIdxRef = useRef<number | null>(null);
  const targetRef = useRef<number | null>(null);
  const startRef = useRef({ y: 0, rects: [] as DOMRect[], stride: 0 });
  const seqRef = useRef(0);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);
  const [dragDy, setDragDy] = useState(0);

  // Sync from server whenever it changes and we're not mid-drag.
  useEffect(() => {
    if (q.data && dragIdxRef.current == null) setItems(sortByOrder(q.data));
  }, [q.data]);

  const canReorder = items.length > 1 && !q.isLoading && !q.isError;

  async function persist(next: CategoryPref[]) {
    const mySeq = ++seqRef.current;
    const categories = next.map((c, i) => ({ ...c, order: i }));
    const prev = qc.getQueryData<LearningPreferences>(["learning-prefs"]);
    qc.setQueryData(["learning-prefs"], { categories }); // optimistic
    try {
      // Order-only update — sends just the ordered ids, not the full objects.
      const res = await settingsApi.updateLearningOrder(next.map((c) => c.category));
      if (mySeq !== seqRef.current) return; // a newer reorder superseded this one
      qc.setQueryData(["learning-prefs"], res);
      qc.invalidateQueries({ queryKey: ["dashboard"] }); // Home reorders
    } catch (e) {
      if (mySeq !== seqRef.current) return;
      if (prev) {
        qc.setQueryData(["learning-prefs"], prev);
        setItems(sortByOrder(prev));
      }
      toast.error(errorMessage(e) || "순서를 저장하지 못했어요. 다시 시도해 주세요.");
    }
  }

  function commitMove(from: number, to: number) {
    if (to < 0 || to >= items.length || to === from) return;
    const next = move(items, from, to);
    setItems(next);
    setAnnounce(`${catLabel(items[from].category)} ${to + 1}번째로 이동했어요`);
    void persist(next);
  }

  // ---- pointer drag ----
  function onMove(e: PointerEvent) {
    const di = dragIdxRef.current;
    if (di == null) return;
    const { y, rects } = startRef.current;
    const dy = e.clientY - y;
    setDragDy(dy);
    const center = rects[di].top + rects[di].height / 2 + dy;
    let t = di;
    for (let j = 0; j < rects.length; j++) {
      const c = rects[j].top + rects[j].height / 2;
      if (j < di && center < c) {
        t = j;
        break;
      }
      if (j > di && center > c) t = j;
    }
    targetRef.current = t;
    setTargetIndex(t);
  }
  function onUp() {
    window.removeEventListener("pointermove", onMove);
    const di = dragIdxRef.current;
    const t = targetRef.current;
    dragIdxRef.current = null;
    targetRef.current = null;
    setDragIndex(null);
    setTargetIndex(null);
    setDragDy(0);
    if (di == null || t == null || t === di) {
      if (q.data) setItems(sortByOrder(q.data)); // no change → resync
      return;
    }
    commitMove(di, t);
  }
  function beginDrag(e: React.PointerEvent, index: number) {
    if (!canReorder || e.button != null && e.button !== 0) return;
    e.preventDefault();
    const lis = Array.from(listRef.current?.children ?? []) as HTMLElement[];
    const rects = lis.map((el) => el.getBoundingClientRect());
    startRef.current = { y: e.clientY, rects, stride: rects.length > 1 ? rects[1].top - rects[0].top : 0 };
    dragIdxRef.current = index;
    targetRef.current = index;
    setDragIndex(index);
    setTargetIndex(index);
    setDragDy(0);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  }

  function itemTransform(i: number): number {
    if (dragIndex == null || targetIndex == null) return 0;
    if (i === dragIndex) return dragDy;
    const s = startRef.current.stride;
    if (dragIndex < targetIndex && i > dragIndex && i <= targetIndex) return -s;
    if (dragIndex > targetIndex && i < dragIndex && i >= targetIndex) return s;
    return 0;
  }

  return (
    <div className="screen clset">
      <div className="clset__scroll">
        <div className="clset__inner">
          <header className="acct__header">
            <button className="acct__back" onClick={() => nav(-1)} aria-label="뒤로">
              <svg width="27" height="27" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <h1 className="acct__title">맞춤 학습 설정</h1>
          </header>

          <h2 className="clset__heading">맞춤 학습 설정</h2>

          <div className="clset__panel">
            <p className="clset__panel-line">맨 위 학습이 홈에 먼저 표시돼요</p>
            <p className="clset__panel-line">
              <span className="clset__panel-handle"><HandleIcon /></span> 를 끌어 순서를 바꿀 수 있어요
            </p>
          </div>

          {q.isLoading ? (
            <div className="clset__list">
              <SkeletonList rows={2} height={110} />
            </div>
          ) : q.isError ? (
            <div className="clset__err">
              <span>학습 설정을 불러오지 못했어요.</span>
              <button className="clset__retry" onClick={() => q.refetch()}>다시 시도</button>
            </div>
          ) : items.length === 0 ? (
            <p className="clset__empty">사용 중인 맞춤 학습이 없어요.</p>
          ) : (
            <ul className="clset__list" ref={listRef} role="list" aria-label="맞춤 학습 목록">
              {items.map((c, i) => (
                <li
                  key={c.category}
                  className={`clset__item ${i === dragIndex ? "is-dragging" : ""}`}
                  style={{
                    transform: `translateY(${itemTransform(i)}px)`,
                    transition: i === dragIndex ? "none" : "transform 0.18s ease",
                    zIndex: i === dragIndex ? 3 : 1,
                  }}
                >
                  <div className="clset__card">
                    <button
                      ref={(el) => (handleRefs.current[i] = el)}
                      className="clset__handle"
                      aria-label={`${catLabel(c.category)} 순서 변경, 위아래 방향키로 이동`}
                      disabled={!canReorder}
                      onPointerDown={(e) => beginDrag(e, i)}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowUp") {
                          e.preventDefault();
                          commitMove(i, i - 1);
                          requestAnimationFrame(() => handleRefs.current[i - 1]?.focus());
                        } else if (e.key === "ArrowDown") {
                          e.preventDefault();
                          commitMove(i, i + 1);
                          requestAnimationFrame(() => handleRefs.current[i + 1]?.focus());
                        }
                      }}
                    >
                      <HandleIcon />
                    </button>

                    <button
                      className="clset__body"
                      onClick={() => nav(detailRoute(c.category))}
                      aria-label={`${srSummary(c, i + 1, items.length)}, 상세 설정 열기`}
                    >
                      <span className="clset__icon">{catIcon(c.category)}</span>
                      <span className="clset__main">
                        <span className="clset__title">{catLabel(c.category)}</span>
                        <span className="clset__subrow">
                          <span className="clset__sub">{secondary(c)}</span>
                          <ChevronRight size={18} color="#AEB7BE" />
                        </span>
                      </span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <p className="sr-only" role="status" aria-live="polite">{announce}</p>
        </div>
      </div>
    </div>
  );
}
