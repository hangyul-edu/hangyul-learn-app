import { useCallback, useEffect, useRef, useState } from "react";
import { useBlocker, useNavigate, useParams } from "react-router-dom";
import { useTranslation, type TranslationKey } from "../i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SkeletonList } from "../components/ui/states";
import { UnsavedChangesModal } from "../components/UnsavedChangesModal";
import { settingsApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import { CONVERSATION_LEVEL_MAX, TOPIK_GRADE_MAX } from "../lib/levels";

const CFG = {
  conversation: {
    titleKey: "trackSettings.conversationTrack" as TranslationKey,
    maxLevel: CONVERSATION_LEVEL_MAX,
    cols: 5,
    levelLabelKey: "trackSettings.levelLabelConversation" as TranslationKey,
    srLevelKey: "trackSettings.conversationLevelA11y" as TranslationKey,
  },
  topik: {
    titleKey: "trackSettings.topikTitle" as TranslationKey,
    maxLevel: TOPIK_GRADE_MAX,
    cols: 3,
    levelLabelKey: "trackSettings.gradeLabel" as TranslationKey,
    srLevelKey: "trackSettings.topikLevelA11y" as TranslationKey,
  },
} as const;

const GOALS: { n: number; mode: TranslationKey; mint?: boolean }[] = [
  { n: 5, mode: "onboarding.goalBasic" },
  { n: 10, mode: "onboarding.goalRoutine", mint: true },
  { n: 20, mode: "onboarding.goalFocus" },
  { n: 30, mode: "onboarding.goalImmersion" },
  { n: 40, mode: "onboarding.goalConquer" },
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
  const { t } = useTranslation();
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
  const leavingRef = useRef(false); // set when we intentionally leave (save / leave)
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

  // Leave by popping history (return to the page we came from — the settings
  // list) rather than pushing a fresh /recommend/settings entry, which would
  // duplicate it and make the list's own Back button loop back here. Fall back
  // to the parent route only when opened directly (no in-app entry to pop to).
  const goBack = () => {
    if ((window.history.state?.idx ?? 0) > 0) nav(-1);
    else nav("/recommend/settings");
  };

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
      toast.success(t("trackSettings.saved"));
      goBack();
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
            <button className="acct__back" onClick={goBack} aria-label={t("common.back")}>
              <svg width="27" height="27" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <h1 className="acct__title">{t(cfg.titleKey)}</h1>
          </header>

          {q.isError ? (
            <div className="clset__err" style={{ marginTop: 24 }}>
              <span>{t("trackSettings.loadError")}</span>
              <button className="clset__retry" onClick={() => q.refetch()}>{t("common.retry")}</button>
            </div>
          ) : (
            <>
              {/* Section 1 — level */}
              <div className="trkset__section">
                <div className="trkset__sec-head">
                  <span className="trkset__num" aria-hidden="true">1</span>
                  <span className="trkset__sec-label">{t("trackSettings.levelSection")}</span>
                </div>
                {loaded ? (
                  <div
                    className="trkset__levels"
                    style={{ gridTemplateColumns: `repeat(${cfg.cols}, 1fr)` }}
                    role="radiogroup"
                    aria-label={t("trackSettings.levelSection")}
                  >
                    {Array.from({ length: maxLevel }, (_, i) => i + 1).map((n) => {
                      const sel = draftLevel === n;
                      return (
                        <button
                          key={n}
                          type="button"
                          role="radio"
                          aria-checked={sel}
                          aria-label={`${t(cfg.srLevelKey, { n })}${sel ? t("trackSettings.selectedSuffix") : ""}`}
                          className={`trkset__lv ${sel ? "is-sel" : ""}`}
                          onClick={() => setDraftLevel(n)}
                        >
                          {t(cfg.levelLabelKey, { n })}
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
                  <span className="trkset__sec-label">{t("trackSettings.goalSection")}</span>
                </div>
                {loaded ? (
                  <div className="trkset__goals" role="radiogroup" aria-label={t("trackSettings.goalSection")}>
                    {GOALS.map((g) => {
                      const sel = draftGoal === g.n;
                      return (
                        <button
                          key={g.n}
                          type="button"
                          role="radio"
                          aria-checked={sel}
                          aria-label={`${t("trackSettings.goalA11y", { n: g.n, mode: t(g.mode) })}${sel ? t("trackSettings.selectedSuffix") : ""}`}
                          className={`trkset__goal ${sel ? "is-sel" : ""}`}
                          onClick={() => setDraftGoal(g.n)}
                        >
                          <span className="trkset__goal-count">{t("session.countUnit", { n: g.n })}</span>
                          <span className={`trkset__pill ${g.mint ? "trkset__pill--mint" : ""}`}>
                            {g.mint ? (
                              // I1825:33049;1:5489 — two runs, only the first is mint.
                              <>
                                <span className="trkset__pill-rec">{t("onboarding.goalRoutineRec")}</span>{" "}
                                {t("onboarding.goalRoutineBase")}
                              </>
                            ) : (
                              t(g.mode)
                            )}
                          </span>
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
          {saving ? <span className="spinner" style={{ width: 22, height: 22, borderWidth: 2.5 }} /> : t("trackSettings.save")}
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
