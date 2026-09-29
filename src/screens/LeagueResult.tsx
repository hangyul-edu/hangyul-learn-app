import { useEffect } from "react";
import { useTranslation, type TranslationKey } from "../i18n";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../components/ui/kit";
import { ErrorState, LoadingState } from "../components/ui/states";
import { TIER_META, type LeagueTier } from "../lib/league";
import { CitrusBadge } from "../components/brand/LeagueGuideArt";
import { gameApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import type { LeagueResultOutcome, LeagueResultSummary } from "../lib/types";
import { LIFECYCLE_KEY, useLeagueLifecycle } from "./LeagueLifecycleModals";

/* --------------------------------- icon --------------------------------- */
function ResultBadge({ tier }: { tier: string }) {
  const { t } = useTranslation();
  return (
    <div className="lgr__badge-wrap">
      <CitrusBadge
        tier={tier}
        className="lgr__badge"
        label={
          TIER_META[tier as LeagueTier]
            ? t("league.tierLabel", { tier: TIER_META[tier as LeagueTier].name })
            : t("league.tablistA11y")
        }
      />
    </div>
  );
}

/* ------------------------------- copy ----------------------------------- */
/** Outcome copy. `t` is passed since this runs outside the component. */
function resultCopy(
  result: LeagueResultSummary,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
): { title: string; desc: string } {
  const outcome: LeagueResultOutcome = result.outcome;
  // The server's `resulting_tier_label` is always English ("Lime League"), so
  // the label is composed in the app language like every other league screen;
  // the server label is only the fallback for a tier this build doesn't know.
  const meta = TIER_META[result.resulting_tier as LeagueTier];
  const tier = meta ? t("league.tierLabel", { tier: meta.name }) : result.resulting_tier_label;
  if (outcome === "promoted") {
    return {
      title: t("leagueLifecycle.resultCongrats"),
      desc: t("leagueLifecycle.resultPromoted", { rank: result.promote_cutoff_rank, tier }),
    };
  }
  if (outcome === "demoted") {
    return {
      title: t("leagueLifecycle.resultTryAgain"),
      desc: t("leagueLifecycle.resultDemoted", { tier }),
    };
  }
  return {
    title: t("leagueLifecycle.resultWellDone"),
    desc: t("leagueLifecycle.resultRetained", { tier }),
  };
}

/* -------------------------------- screen -------------------------------- */
export function LeagueResult() {
  const { t } = useTranslation();
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

  if (lifecycle.error && !result) {
    return (
      <div className="screen lgr">
        <ErrorState message={t("league.loadError")} onRetry={() => lifecycle.refetch()} />
      </div>
    );
  }

  if (lifecycle.isLoading || !result) {
    return (
      <div className="screen lgr">
        <LoadingState />
      </div>
    );
  }

  const copy = resultCopy(result, t);
  return (
    <div className="screen lgr">
      <div className="lgr__body">
        <ResultBadge tier={result.resulting_tier} />
        <h1 className="lgr__title">{copy.title}</h1>
        {/* LEG-006/007/008 show only the headline and this two-line message;
            the final standing is announced to screen readers instead. */}
        <p className="lgr__desc">{copy.desc}</p>
        {result.final_rank != null && (
          <p className="sr-only">
            {t("leagueLifecycle.finalRank", { rank: result.final_rank, total: result.total_participants })}
          </p>
        )}
      </div>
      <div className="lgr__foot">
        <Button
          block
          loading={ack.isPending}
          onClick={() => ack.mutate(result.season_id)}
          aria-label={t("leagueLifecycle.keepGoing")}
        >
          {t("leagueLifecycle.keepGoing")}
        </Button>
      </div>
    </div>
  );
}
