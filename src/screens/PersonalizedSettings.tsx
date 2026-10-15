import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { settingsOrigin, useSettingsBack } from "../lib/settingsNav";
import { useTranslation, type TranslationKey, type Translate } from "../i18n";
import { useQueryClient } from "@tanstack/react-query";
import trackIconConv from "../assets/brand/track-icon-conv.svg";
import trackIconTopik from "../assets/brand/track-icon-topik.svg";
import dragHandleArt from "../assets/brand/ic-drag-handle.svg";
import rowArrow from "../assets/brand/ic-16-arrow.svg";
import { SkeletonList } from "../components/ui/states";
import { settingsApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import type { CategoryPref, LearningPreferences } from "../lib/types";
import { AcctHeader } from "../components/layout/AcctHeader";
import { useLearningPrefs } from "../api/queries";
import { useDragReorder } from "../hooks/useDragReorder";

const CAT_LABEL_KEYS: Record<string, TranslationKey> = {
  conversation: "personalizedSettings.conversationTrack",
  topik: "trackSettings.topikTitle",
};
/** Track name for a category. `t` is passed since these run outside React. */
const catLabel = (c: string, t: Translate) => (CAT_LABEL_KEYS[c] ? t(CAT_LABEL_KEYS[c]) : c);
/* Figma TAL-034 Group 1410118340 / 1410118323 — the row glyphs are their own
   artwork, not the tile icons the tab strip uses. */
const catIcon = (c: string) =>
  c === "topik" ? (
    <img className="clset__icon-art clset__icon-art--topik" src={trackIconTopik} alt="" aria-hidden="true" />
  ) : (
    <img className="clset__icon-art" src={trackIconConv} alt="" aria-hidden="true" />
  );
const detailRoute = (c: string) => `/recommend/settings/${c === "topik" ? "topik" : "conversation"}`;
/** The row's level chip — Figma keeps it and the goal as two runs with a rule
 *  between them, so they are separate messages rather than one joined string. */
function levelChip(c: CategoryPref, t: Translate): string {
  return t(
    c.category === "topik"
      ? "personalizedSettings.summaryLevelTopik"
      : "personalizedSettings.summaryLevelConversation",
    { level: c.level },
  );
}
function srSummary(c: CategoryPref, pos: number, total: number, t: Translate): string {
  const level = t(
    c.category === "topik" ? "personalizedSettings.levelTopik" : "personalizedSettings.levelConversation",
    { n: c.level },
  );
  return t("personalizedSettings.itemA11y", {
    name: catLabel(c.category, t),
    level,
    goal: c.daily_goal,
    pos,
    total,
  });
}
const sortByOrder = (p?: LearningPreferences) => [...(p?.categories ?? [])].sort((a, b) => a.order - b.order);
function move<T>(arr: T[], from: number, to: number): T[] {
  const next = arr.slice();
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}

/** Drag-handle glyph — Figma Group 1410118989, three rounded bars at 15x8. */
function HandleIcon() {
  return <img className="clset__handle-art" src={dragHandleArt} alt="" aria-hidden="true" />;
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
  const { t } = useTranslation();
  const nav = useNavigate();
  // Back returns to the screen that opened Practice Settings — Home or
  // Personalized Learning, whichever pushed it.
  const goBack = useSettingsBack("/home");
  const qc = useQueryClient();
  const toast = useToast();
  const q = useLearningPrefs();

  const [items, setItems] = useState<CategoryPref[]>([]);
  const [announce, setAnnounce] = useState("");

  // drag refs/state
  const listRef = useRef<HTMLUListElement>(null);
  const handleRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const seqRef = useRef(0);

  // Sync from server whenever it changes and we're not mid-drag.
  useEffect(() => {
    if (q.data && !drag.isDragging()) setItems(sortByOrder(q.data));
  }, [q.data]);

  const canReorder = items.length > 1 && !q.isLoading && !q.isError;
  const drag = useDragReorder({
    listRef,
    enabled: canReorder,
    onDrop: (from, to) => commitMove(from, to),
    // No change: back to the server's order.
    onCancel: () => q.data && setItems(sortByOrder(q.data)),
  });
  const { dragIndex, beginDrag, itemTransform } = drag;

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
      toast.error(errorMessage(e) || t("personalizedSettings.reorderError"));
    }
  }

  function commitMove(from: number, to: number) {
    if (to < 0 || to >= items.length || to === from) return;
    const next = move(items, from, to);
    setItems(next);
    setAnnounce(t("personalizedSettings.movedA11y", { name: catLabel(items[from].category, t), pos: to + 1 }));
    void persist(next);
  }

  return (
    <div className="screen clset">
      <div className="clset__scroll">
        <div className="clset__inner">
          <AcctHeader title={t("personalizedSettings.title")} onBack={goBack} />

          {/* Figma repeats the title as a large page heading under the nav bar
              (1825:32493). Hidden from the a11y tree so it does not duplicate
              the <h1> above. */}
          <p className="clset__heading" aria-hidden="true">{t("personalizedSettings.title")}</p>

          <div className="clset__panel">
            <p className="clset__panel-line">{t("personalizedSettings.hint")}</p>
            {/* The handle glyph sits mid-sentence in English and leads in
                Korean, so its position travels with the message as {handle}. */}
            <p className="clset__panel-line">
              {(() => {
                const [before, after = ""] = t("personalizedSettings.dragHint").split("{handle}");
                return (
                  <>
                    {before}
                    <span className="clset__panel-handle"><HandleIcon /></span>
                    {after}
                  </>
                );
              })()}
            </p>
          </div>

          {q.isLoading ? (
            <div className="clset__list">
              <SkeletonList rows={2} height={110} />
            </div>
          ) : q.isError ? (
            <div className="clset__err">
              <span>{t("personalizedSettings.loadError")}</span>
              <button className="clset__retry" onClick={() => q.refetch()}>{t("common.retry")}</button>
            </div>
          ) : items.length === 0 ? (
            <p className="clset__empty">{t("personalizedSettings.empty")}</p>
          ) : (
            <ul className="clset__list" ref={listRef} role="list" aria-label={t("personalizedSettings.listAria")}>
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
                      aria-label={t("personalizedSettings.reorderA11y", { name: catLabel(c.category, t) })}
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
                      onClick={() => nav(detailRoute(c.category), { state: settingsOrigin("/recommend/settings") })}
                      aria-label={t("personalizedSettings.openDetailA11y", { summary: srSummary(c, i + 1, items.length, t) })}
                    >
                      <span className="clset__icon">{catIcon(c.category)}</span>
                      <span className="clset__main">
                        <span className="clset__title">{catLabel(c.category, t)}</span>
                        <span className="clset__subrow">
                          <span className="clset__sub">{levelChip(c, t)}</span>
                          <span className="clset__sub-rule" aria-hidden="true" />
                          <span className="clset__sub">
                            {t("personalizedSettings.summaryGoal", { goal: c.daily_goal })}
                          </span>
                          <img className="clset__sub-arrow" src={rowArrow} alt="" aria-hidden="true" />
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
