import { useCallback, useEffect, useRef, useState } from "react";
import { useBlocker, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SkeletonList } from "../components/ui/states";
import { UnsavedChangesModal } from "../components/UnsavedChangesModal";
import { settingsApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";

const CFG = {
  conversation: { title: "실전 회화", maxLevel: 10, cols: 5, levelLabel: (n: number) => `Lv.${n}`, srLevel: (n: number) => `회화 레벨 ${n}` },
  topik: { title: "TOPIK", maxLevel: 6, cols: 3, levelLabel: (n: number) => `${n}급`, srLevel: (n: number) => `TOPIK ${n}급` },
} as const;

const GOALS: { n: number; mode: string; mint?: boolean }[] = [
  { n: 5, mode: "기본 모드" },
  { n: 10, mode: "추천 루틴 모드", mint: true },
  { n: 20, mode: "집중 모드" },
  { n: 30, mode: "몰입 모드" },
  { n: 40, mode: "정복 모드" },
];

/**
 * Per-track Custom Learning settings (conversation / TOPIK). Edits the level and
 * daily goal for ONE category via settingsApi.updateLearningCategory (the read
 * stays whole-list via settingsApi.learning). Dirty state = draft ≠ the values captured at load;
 * leaving while dirty prompts the unsaved-changes modal. Saving invalidates the
 * dashboard so Home + Custom Learning reflect the new level/goal; the backend
 * owns the level-change progress reset.
 */
export function TrackSettings() {
  const { category: raw } = useParams<{ category: string }>();
  const category = (raw === "topik" ? "topik" : "conversation") as keyof typeof CFG;
  const cfg = CFG[category];
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();

  const q = useQuery({ queryKey: ["learning-prefs"], queryFn: settingsApi.learning });
  const pref = q.data?.categories.find((c) => c.category === category);
  const maxLevel = pref?.max_level ?? cfg.maxLevel;

  const [draftLevel, setDraftLevel] = useState<number | null>(null);
  const [draftGoal, setDraftGoal] = useState<number | null>(null);
  const origRef = useRef<{ level: number; goal: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const leavingRef = useRef(false); // set when we intentionally leave (save / 나가기)
  const seqRef = useRef(0);

  // Capture the server-confirmed originals once, then seed the draft.
  useEffect(() => {
    if (pref && origRef.current == null) {
      origRef.current = { level: pref.level, goal: pref.daily_goal };
      setDraftLevel(pref.level);
      setDraftGoal(pref.daily_goal);
    }
  }, [pref]);

  const orig = origRef.current;
  const dirty =
    !!orig && draftLevel != null && draftGoal != null && (draftLevel !== orig.level || draftGoal !== orig.goal);

  // Block EVERY in-app exit path while dirty (header back, browser/hardware back,
  // swipe-back, programmatic pop) via the data router. The modal is driven by the
  // blocker's state; a deliberate leave (save / 나가기) sets leavingRef to bypass.
  const blocker = useBlocker(
    useCallback(
      ({
        currentLocation,
        nextLocation,
      }: {
        currentLocation: { pathname: string };
        nextLocation: { pathname: string };
      }) => dirty && !leavingRef.current && currentLocation.pathname !== nextLocation.pathname,
      [dirty],
    ),
  );

  // Warn on full page unload (reload/close) while dirty — outside the router.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  async function save() {
    if (!dirty || saving || !q.data || !orig || draftLevel == null || draftGoal == null) return;
    setSaving(true);
    const mySeq = ++seqRef.current;
    try {
      // Update only THIS category; conversation/topik are saved on separate
      // screens, so the request never carries the other category's values.
      const res = await settingsApi.updateLearningCategory(category, {
        level: draftLevel,
        daily_goal: draftGoal,
      });
      if (mySeq !== seqRef.current) return; // superseded
      qc.setQueryData(["learning-prefs"], res);
      qc.invalidateQueries({ queryKey: ["dashboard"] }); // Home + Custom Learning
      origRef.current = { level: draftLevel, goal: draftGoal }; // clear dirty
      leavingRef.current = true; // deliberate exit — don't trip the blocker
      toast.success("저장했어요");
      nav(-1);
    } catch (e) {
      if (mySeq !== seqRef.current) return;
      toast.error(errorMessage(e)); // stay, keep draft + dirty for retry
    } finally {
      setSaving(false);
    }
  }

  const loaded = !q.isLoading && !q.isError && !!pref;

  return (
    <div className="screen trkset">
      <div className="trkset__scroll">
        <div className="trkset__inner">
          <header className="acct__header">
            <button className="acct__back" onClick={() => nav(-1)} aria-label="뒤로">
              <svg width="27" height="27" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <h1 className="acct__title">{cfg.title}</h1>
          </header>

          {q.isError ? (
            <div className="clset__err" style={{ marginTop: 24 }}>
              <span>설정을 불러오지 못했어요.</span>
              <button className="clset__retry" onClick={() => q.refetch()}>다시 시도</button>
            </div>
          ) : (
            <>
              {/* Section 1 — level */}
              <div className="trkset__section">
                <div className="trkset__sec-head">
                  <span className="trkset__num" aria-hidden="true">1</span>
                  <span className="trkset__sec-label">레벨 선택</span>
                </div>
                {loaded ? (
                  <div
                    className="trkset__levels"
                    style={{ gridTemplateColumns: `repeat(${cfg.cols}, 1fr)` }}
                    role="radiogroup"
                    aria-label="레벨 선택"
                  >
                    {Array.from({ length: maxLevel }, (_, i) => i + 1).map((n) => {
                      const sel = draftLevel === n;
                      return (
                        <button
                          key={n}
                          type="button"
                          role="radio"
                          aria-checked={sel}
                          aria-label={`${cfg.srLevel(n)}${sel ? ", 선택됨" : ""}`}
                          className={`trkset__lv ${sel ? "is-sel" : ""}`}
                          onClick={() => setDraftLevel(n)}
                        >
                          {cfg.levelLabel(n)}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <SkeletonList rows={2} height={54} />
                )}
              </div>

              {/* Section 2 — daily goal */}
              <div className="trkset__section">
                <div className="trkset__sec-head">
                  <span className="trkset__num" aria-hidden="true">2</span>
                  <span className="trkset__sec-label">하루 목표</span>
                </div>
                {loaded ? (
                  <div className="trkset__goals" role="radiogroup" aria-label="하루 목표">
                    {GOALS.map((g) => {
                      const sel = draftGoal === g.n;
                      return (
                        <button
                          key={g.n}
                          type="button"
                          role="radio"
                          aria-checked={sel}
                          aria-label={`하루 목표 ${g.n}개, ${g.mode}${sel ? ", 선택됨" : ""}`}
                          className={`trkset__goal ${sel ? "is-sel" : ""}`}
                          onClick={() => setDraftGoal(g.n)}
                        >
                          <span className="trkset__goal-count">{g.n}개</span>
                          <span className={`trkset__pill ${g.mint ? "trkset__pill--mint" : ""}`}>{g.mode}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <SkeletonList rows={3} height={64} />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="trkset__save-bar">
        <button
          type="button"
          className="trkset__save"
          onClick={save}
          disabled={!dirty || saving}
          aria-disabled={!dirty || saving}
        >
          {saving ? <span className="spinner" style={{ width: 22, height: 22, borderWidth: 2.5 }} /> : "저장하기"}
        </button>
      </div>

      <UnsavedChangesModal
        open={blocker.state === "blocked"}
        onContinue={() => blocker.reset?.()}
        onLeave={() => {
          leavingRef.current = true; // draft discarded; proceed with the blocked nav
          blocker.proceed?.();
        }}
      />
    </div>
  );
}
