import { useEffect, useRef, useState } from "react";
import { ApiError } from "./http";

/** The free plan's daily chatbot questions when the server does not say. */
export const AI_DAILY_QUESTION_LIMIT = 5;

/**
 * The day's limit when `e` is the server refusing a chatbot question because
 * the member's free questions are used up (429, `details.reason =
 * ai_daily_limit`), else null. One allowance covers every chat and the
 * study-session tutor, so this is the same refusal from all of them.
 */
export function aiDailyLimit(e: unknown): number | null {
  if (!(e instanceof ApiError) || e.status !== 429 || e.details?.reason !== "ai_daily_limit") return null;
  const limit = e.details?.limit;
  return typeof limit === "number" ? limit : AI_DAILY_QUESTION_LIMIT;
}

/** How long the limit notice stays at the top of the chat sheet. */
export const AI_LIMIT_NOTICE_MS = 3000;

/**
 * The limit notice's state for one chat sheet: `show(limit)` raises it (again,
 * for the full time, on every refused attempt); it hides by itself.
 */
export function useAiLimitNotice(): { limit: number | null; show: (limit: number) => void } {
  const [limit, setLimit] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  function show(next: number) {
    setLimit(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setLimit(null), AI_LIMIT_NOTICE_MS);
  }
  return { limit, show };
}
