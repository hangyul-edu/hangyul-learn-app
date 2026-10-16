import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "../i18n";
import { useAuthOptional } from "./auth";
import { useToast } from "./toast";
import { ApiError } from "../lib/http";

/** What the member was refused: a premium lecture (its page, video and
 *  checkpoint questions), or the TOPIK lesson's extra AI question practice,
 *  which is premium on every lecture, free ones included. Each has its own
 *  wording, so a free lecture is never said to need a subscription. */
export type PremiumGate = "lecture" | "practice";

const NOTICE = { lecture: "courses.premiumRequired", practice: "courses.practicePremiumRequired" } as const;

/**
 * Members without premium access are kept out before anything opens: the tap
 * is blocked and the bottom notice (cp_G_03_toast) says why. The server
 * refuses the same requests (402).
 */
export function usePremiumLectureGate() {
  // Non-throwing: the lecture screens also render in isolation (tests).
  const me = useAuthOptional()?.me;
  const toast = useToast();
  const { t } = useTranslation();
  // Blocked only when the member is known to lack premium access; with no
  // member loaded the server decides (and a refusal leaves the screen).
  const withoutPremium = !!me && me.membership?.is_premium !== true;
  const notify = (gate: PremiumGate = "lecture") => toast.show(t(NOTICE[gate]), "notice");
  return {
    withoutPremium,
    notify,
    /** Run `go` unless the lecture is premium and the member is not; then notify instead. */
    open(access: "free" | "premium" | undefined, go: () => void) {
      if (access === "premium" && withoutPremium) notify("lecture");
      else go();
    },
    /** Run `go` unless the member lacks premium access; then the practice notice. */
    openPractice(go: () => void) {
      if (withoutPremium) notify("practice");
      else go();
    },
  };
}

/** The server refused it to a member without premium access. */
export function isSubscriptionRequired(e: unknown): boolean {
  return e instanceof ApiError && e.status === 402;
}

/**
 * For a screen reached without the tap check — a direct link, a
 * notification, a membership that lapsed: once it is refused, leave at once
 * with the notice — back where the member came from, or to `fallback` (the
 * lecture tab) when the link was the first page opened.
 */
export function useLeaveLockedLecture(refused: boolean, gate: PremiumGate = "lecture", fallback = "/courses"): void {
  const nav = useNavigate();
  const location = useLocation();
  const { notify } = usePremiumLectureGate();
  const left = useRef(false);
  useEffect(() => {
    if (!refused || left.current) return;
    left.current = true;
    notify(gate);
    if (location.key === "default") nav(fallback, { replace: true });
    else nav(-1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refused]);
}
