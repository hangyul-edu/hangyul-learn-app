import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../components/ui/kit";
import { LoadingState } from "../components/ui/states";
import { LEAGUE_TIERS, TIER_META, tierIndex, type LeagueTier } from "../lib/league";
import { gameApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import type { LeagueResultOutcome, LeagueResultSummary } from "../lib/types";
import { LIFECYCLE_KEY, useLeagueLifecycle } from "./LeagueLifecycleModals";

/* --------------------------------- icon --------------------------------- */
function ResultBadge({ tier }: { tier: string }) {
  const color = TIER_META[tier as LeagueTier]?.color ?? "#b8c0c8";
  return (
    <div className="lgr__badge-wrap">
      <svg viewBox="0 0 96 108" width="132" height="148" role="img" aria-label={TIER_META[tier as LeagueTier]?.label ?? "리그"}>
        <path d="M48 6l36 13v30c0 24-16 40-36 47C28 89 12 73 12 49V19L48 6z" fill={color} />
        <path d="M48 6l36 13v30c0 24-16 40-36 47C28 89 12 73 12 49V19L48 6z" fill="url(#lgrShine)" />
        <path d="M48 26l6.9 14 15.4 2.2-11.1 10.8 2.6 15.3L48 75.1l-13.8 7.2 2.6-15.3-11.1-10.8L41.1 40 48 26z" fill="#fff" opacity="0.94" />
        <defs>
          <radialGradient id="lgrShine" cx="0.35" cy="0.28" r="0.8">
            <stop offset="0" stopColor="#fff" stopOpacity="0.45" />
            <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>
      <span className="lgr__ground" aria-hidden="true" />
    </div>
  );
}

/* ------------------------------ progress -------------------------------- */
function ProgressLadder({ resultingTier }: { resultingTier: string }) {
  const reachedIndex = Math.max(0, tierIndex(resultingTier));
  return (
    <div className="lgr__ladder" role="list" aria-label="리그 진행">
      {LEAGUE_TIERS.map((tier, i) => {
        const reached = i <= reachedIndex;
        const current = i === reachedIndex;
        return (
          <div className="lgr__step" role="listitem" key={tier}>
            {i > 0 && <span className={`lgr__line ${i <= reachedIndex ? "is-done" : ""}`} aria-hidden="true" />}
            <span
              className={`lgr__node ${reached ? "is-reached" : ""} ${current ? "is-current" : ""}`}
              aria-current={current ? "step" : undefined}
            />
            <span className={`lgr__node-label ${reached ? "is-reached" : ""}`}>
              {TIER_META[tier].label.replace(" 리그", "")}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------- copy ----------------------------------- */
function resultCopy(result: LeagueResultSummary): { title: string; desc: string } {
  const outcome: LeagueResultOutcome = result.outcome;
  if (outcome === "promoted") {
    return {
      title: "축하합니다!",
      desc: `상위 ${result.promote_cutoff_rank}위 안에 들어\n${result.resulting_tier_label}로 승급했어요! 🎉`,
    };
  }
  if (outcome === "demoted") {
    return {
      title: "새로운 리그에서 다시 도전해보세요",
      desc: `${result.resulting_tier_label}에서 다음 승급을 노려봐요`,
    };
  }
  return {
    title: "이번 리그도 수고했어요!",
    desc: `${result.resulting_tier_label}를 지켜냈어요`,
  };
}

/* -------------------------------- screen -------------------------------- */
export function LeagueResult() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const lifecycle = useLeagueLifecycle();
  const result = lifecycle.data?.previous_result ?? null;

  const ack = useMutation({
    mutationFn: (seasonId: string) => gameApi.ackLeagueResult(seasonId),
    onSuccess: (next) => {
      qc.setQueryData(LIFECYCLE_KEY, next);
      qc.invalidateQueries({ queryKey: ["league-me"] });
      qc.invalidateQueries({ queryKey: ["league-rankings"] });
      nav("/league");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  // Nothing to acknowledge (e.g., deep-linked with no settled result) → leave.
  useEffect(() => {
    if (!lifecycle.isLoading && !lifecycle.error && result === null) nav("/league", { replace: true });
  }, [lifecycle.isLoading, lifecycle.error, result, nav]);

  if (lifecycle.isLoading || !result) {
    return (
      <div className="screen lgr">
        <LoadingState />
      </div>
    );
  }

  const copy = resultCopy(result);
  return (
    <div className="screen lgr">
      <div className="lgr__body">
        <ResultBadge tier={result.resulting_tier} />
        <h1 className="lgr__title">{copy.title}</h1>
        <p className="lgr__desc">{copy.desc}</p>
        {result.final_rank != null && (
          <p className="lgr__rank">
            최종 순위 {result.final_rank}위 / {result.total_participants}명
          </p>
        )}
        <ProgressLadder resultingTier={result.resulting_tier} />
      </div>
      <div className="lgr__foot">
        <Button
          block
          loading={ack.isPending}
          onClick={() => ack.mutate(result.season_id)}
          aria-label="계속 도전하기"
        >
          계속 도전하기
        </Button>
      </div>
    </div>
  );
}
