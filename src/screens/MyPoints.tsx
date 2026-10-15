import { useEffect, useRef, useState } from "react";
import { useTranslation, type Translate } from "../i18n";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, ErrorState, LoadingState, SkeletonList, Spinner } from "../components/ui/states";
import { gameApi } from "../api/endpoints";
import { localeFor } from "../lib/format";
import type { AppLanguage } from "../lib/language";
import type { PointTransaction } from "../lib/types";
import { useLoadMoreSentinel } from "../hooks/useLoadMoreSentinel";

type Phase = "loading" | "ready" | "error";
type More = "idle" | "loading" | "done" | "error";

/* ------------------------------ localization ---------------------------- */
/** My-Points copy + reward-reason titles, bound to the active language. */
function usePointsCopy() {
  const { t } = useTranslation();
  return {
    currentLeague: t("points.currentLeague"),
    emptyTitle: t("points.emptyTitle"),
    emptyDesc: t("points.emptyDesc"),
    error: t("points.error"),
    loadMore: t("points.loadMore"),
    listAria: t("points.listAria"),
    /** Reward reason → title. A stable enum mapping; never parses server text. */
    title: (reason: string) =>
      t(
        reason === "attendance" || reason === "attendance_streak_bonus"
          ? "points.reasonAttendance"
          : reason === "sentence_complete"
            ? "points.reasonSentence"
            : reason === "lecture_complete"
              ? "points.reasonLecture"
              : reason === "saved_sentence_review"
                ? "points.reasonReview"
                : "points.reasonLevelUp",
      ),
  };
}

/**
 * Reward reason → detail line. A stable enum mapping over the catalog; never
 * parses server text. `t` is passed in since this runs outside React.
 */
function describe(
  tx: PointTransaction,
  t: Translate,
): string {
  const d = tx.detail ?? {};
  const isQuestion = d.item_type === "question";
  switch (tx.reason) {
    case "attendance":
      return t("points.descAttendance");
    case "attendance_streak_bonus":
      return d.streak_days
        ? t("points.descStreakBonusDays", { days: String(d.streak_days) })
        : t("points.descStreakBonus");
    case "sentence_complete":
      return t(isQuestion ? "points.descQuestionDone" : "points.descSentenceDone");
    case "lecture_complete":
      return t("points.descLectureDone");
    case "saved_sentence_review":
      return t(isQuestion ? "points.descQuestionReview" : "points.descSentenceReview");
    case "level_up_bonus":
      return d.level ? t("points.descLevelReached", { level: String(d.level) }) : t("points.descLevelUpBonus");
    default:
      return "";
  }
}

/* ------------------------------ formatting ------------------------------ */
function monthLabel(date: Date, lang: AppLanguage): string {
  return new Intl.DateTimeFormat(localeFor(lang), { year: "numeric", month: "long" }).format(date);
}
function dateLabel(date: Date, lang: AppLanguage): string {
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return new Intl.DateTimeFormat(localeFor(lang), {
    ...(sameYear ? {} : { year: "numeric" }),
    month: lang === "ko" ? "long" : "short",
    day: "numeric",
  }).format(date);
}

interface MonthGroup {
  key: string;
  label: string;
  items: PointTransaction[];
}
function groupByMonth(items: PointTransaction[], lang: AppLanguage): MonthGroup[] {
  const groups: MonthGroup[] = [];
  const byKey = new Map<string, MonthGroup>();
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.event_id)) continue; // dedup across paginated pages
    seen.add(item.event_id);
    const date = new Date(item.occurred_at);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    let group = byKey.get(key);
    if (!group) {
      group = { key, label: monthLabel(date, lang), items: [] };
      byKey.set(key, group);
      groups.push(group); // API is newest-first → months arrive newest-first
    }
    group.items.push(item);
  }
  return groups;
}

/* -------------------------------- rows ---------------------------------- */
function PointRow({ tx, lang }: { tx: PointTransaction; lang: AppLanguage }) {
  const { t } = useTranslation();
  const copy = usePointsCopy();
  const title = copy.title(tx.reason) ?? tx.reason;
  const desc = describe(tx, t);
  const negative = tx.amount < 0;
  const amount = `${negative ? "−" : "+"}${Math.abs(tx.amount).toLocaleString()} P`;
  const date = dateLabel(new Date(tx.occurred_at), lang);
  const aria = t("points.rowA11y", {
    title,
    desc,
    amount: Math.abs(tx.amount),
    direction: t(negative ? "points.directionDeducted" : "points.directionEarned"),
    date,
  });
  return (
    <li className="mp__row" aria-label={aria}>
      <div className="mp__row-main">
        <div className="mp__row-title">{title}</div>
        {desc && <div className="mp__row-desc">{desc}</div>}
      </div>
      <div className="mp__row-side">
        <div className={`mp__row-amount ${negative ? "is-neg" : ""}`}>{amount}</div>
        <div className="mp__row-date">{date}</div>
      </div>
    </li>
  );
}

/* -------------------------------- screen -------------------------------- */
export function MyPoints() {
  // Dates follow the language the UI is actually in. The profile's
  // app_language only seeds it, so after a local choice the two can differ.
  const { language: lang } = useTranslation();
  const copy = usePointsCopy();

  // Current weekly-league total — refetch on entry/focus so it reflects newly
  // awarded points and the weekly reset without an app restart.
  const bal = useQuery({
    queryKey: ["points"],
    queryFn: gameApi.points,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const [items, setItems] = useState<PointTransaction[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [more, setMore] = useState<More>("idle");
  const [reloadKey, setReloadKey] = useState(0);
  const loadingRef = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setItems([]);
    setCursor(null);
    setPhase("loading");
    setMore("idle");
    loadingRef.current = true;
    gameApi
      .pointsHistory()
      .then((page) => {
        if (cancelled) return;
        setItems(page.items);
        setCursor(page.next_cursor);
        setMore(page.next_cursor ? "idle" : "done");
        setPhase("ready");
      })
      .catch(() => {
        if (!cancelled) setPhase("error");
      })
      .finally(() => {
        if (!cancelled) loadingRef.current = false;
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  async function loadMore() {
    if (loadingRef.current || cursor == null) return;
    loadingRef.current = true;
    setMore("loading");
    try {
      const page = await gameApi.pointsHistory(cursor);
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.next_cursor);
      setMore(page.next_cursor ? "idle" : "done");
    } catch {
      setMore("error");
    } finally {
      loadingRef.current = false;
    }
  }

  useLoadMoreSentinel(sentinel, { enabled: more === "idle", onHit: () => void loadMore(), rootMargin: "300px" }, [more, cursor, items.length]);

  // Gate on the authoritative total so we never flash 0 p (or 0 on error).
  if (bal.isLoading && bal.data === undefined) return <LoadingState />;
  if (bal.error && bal.data === undefined) {
    return <ErrorState message={copy.error} onRetry={() => bal.refetch()} />;
  }

  const groups = groupByMonth(items, lang);

  return (
    <div className="mp">
      <div className="mp__summary">
        <div className="mp__summary-label">{copy.currentLeague}</div>
        <div className="mp__summary-total">
          <span className="mp__summary-num">{(bal.data?.season_points ?? 0).toLocaleString()}</span>
          <span className="mp__summary-suffix">p</span>
        </div>
      </div>

      {phase === "loading" ? (
        <div className="mp__pad">
          <SkeletonList rows={6} height={52} />
        </div>
      ) : phase === "error" ? (
        <ErrorState message={copy.error} onRetry={() => setReloadKey((k) => k + 1)} />
      ) : items.length === 0 ? (
        <EmptyState emoji="⚡" title={copy.emptyTitle} text={copy.emptyDesc} />
      ) : (
        <div className="mp__history">
          {groups.map((group) => (
            <section className="mp__month" key={group.key}>
              <h2 className="mp__month-title">{group.label}</h2>
              <ul className="mp__rows" role="list" aria-label={copy.listAria}>
                {group.items.map((tx) => (
                  <PointRow key={tx.event_id} tx={tx} lang={lang} />
                ))}
              </ul>
            </section>
          ))}
          <div className="mp__foot" ref={sentinel}>
            {more === "loading" && <Spinner />}
            {more === "error" && (
              <button className="mp__more-retry" onClick={() => { setMore("idle"); void loadMore(); }}>
                {copy.loadMore}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
