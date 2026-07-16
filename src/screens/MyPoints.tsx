import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, ErrorState, LoadingState, SkeletonList, Spinner } from "../components/ui/states";
import { useAuth } from "../hooks/auth";
import { gameApi } from "../api/endpoints";
import { normalizeLanguage, type AppLanguage } from "../lib/language";
import type { PointTransaction } from "../lib/types";

type Phase = "loading" | "ready" | "error";
type More = "idle" | "loading" | "done" | "error";

/* ------------------------------ localization ---------------------------- */
const MP_COPY = {
  ko: {
    currentLeague: "이번 리그 포인트",
    emptyTitle: "아직 이번 리그에서 적립된 포인트가 없어요",
    emptyDesc: "학습을 시작하면 이번 리그 포인트가 적립됩니다.",
    error: "포인트를 불러오지 못했어요.",
    loadMore: "더 보기",
    listAria: "포인트 적립 내역",
  },
  en: {
    currentLeague: "Points in This League",
    emptyTitle: "No points earned in this league yet",
    emptyDesc: "Start learning to earn points in this league.",
    error: "Couldn't load your points.",
    loadMore: "Load more",
    listAria: "Point history",
  },
} as const;

// Reward reason → localized title (stable enum mapping, never parses server text).
const TITLE: Record<AppLanguage, Record<string, string>> = {
  ko: {
    attendance: "출석 체크",
    attendance_streak_bonus: "출석 체크",
    sentence_complete: "맞춤 학습",
    lecture_complete: "강의 시청",
    saved_sentence_review: "복습",
    level_up_bonus: "레벨업",
  },
  en: {
    attendance: "Attendance",
    attendance_streak_bonus: "Attendance",
    sentence_complete: "Customized Learning",
    lecture_complete: "Course",
    saved_sentence_review: "Review",
    level_up_bonus: "Level Up",
  },
};

function describe(tx: PointTransaction, lang: AppLanguage): string {
  const d = tx.detail ?? {};
  const isQuestion = d.item_type === "question";
  if (lang === "ko") {
    switch (tx.reason) {
      case "attendance":
        return "일일 출석";
      case "attendance_streak_bonus":
        return d.streak_days ? `연속 ${d.streak_days}일 출석 보너스` : "연속 출석 보너스";
      case "sentence_complete":
        return isQuestion ? "문제 학습 완료" : "문장 학습 완료";
      case "lecture_complete":
        return "강의 시청 완료";
      case "saved_sentence_review":
        return isQuestion ? "문제 복습 완료" : "문장 복습 완료";
      case "level_up_bonus":
        return d.level ? `레벨 ${d.level} 달성` : "레벨업 보너스";
      default:
        return "";
    }
  }
  switch (tx.reason) {
    case "attendance":
      return "Daily attendance";
    case "attendance_streak_bonus":
      return d.streak_days ? `${d.streak_days}-day attendance streak bonus` : "Attendance streak bonus";
    case "sentence_complete":
      return isQuestion ? "Question completed" : "Sentence completed";
    case "lecture_complete":
      return "Course completed";
    case "saved_sentence_review":
      return isQuestion ? "Question review completed" : "Sentence review completed";
    case "level_up_bonus":
      return d.level ? `Reached level ${d.level}` : "Level-up bonus";
    default:
      return "";
  }
}

/* ------------------------------ formatting ------------------------------ */
const locale = (lang: AppLanguage) => (lang === "ko" ? "ko-KR" : "en-US");

function monthLabel(date: Date, lang: AppLanguage): string {
  return new Intl.DateTimeFormat(locale(lang), { year: "numeric", month: "long" }).format(date);
}
function dateLabel(date: Date, lang: AppLanguage): string {
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return new Intl.DateTimeFormat(locale(lang), {
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
  const title = TITLE[lang][tx.reason] ?? tx.reason;
  const desc = describe(tx, lang);
  const negative = tx.amount < 0;
  const amount = `${negative ? "−" : "+"}${Math.abs(tx.amount).toLocaleString()} P`;
  const date = dateLabel(new Date(tx.occurred_at), lang);
  const aria =
    lang === "ko"
      ? `${title}, ${desc}, ${Math.abs(tx.amount)}포인트 ${negative ? "차감" : "적립"}, ${date}`
      : `${title}, ${desc}, ${negative ? "minus " : "plus "}${Math.abs(tx.amount)} points, ${date}`;
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
  const { me } = useAuth();
  const lang = normalizeLanguage(me?.app_language);
  const copy = MP_COPY[lang];

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

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && more === "idle") void loadMore();
      },
      { rootMargin: "300px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [more, cursor, items.length]);

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
