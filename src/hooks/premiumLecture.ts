import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "../i18n";
import { useAuthOptional } from "./auth";
import { useToast } from "./toast";
import { ApiError } from "../lib/http";

/**
 * A premium lecture — its page, video and checkpoint questions (speaking and
 * question practice) — is for members with premium access only. The server
 * refuses everything else with 402; the app does not even open it: the tap is
 * blocked and the notice (cp_G_03_toast) says a subscription is needed.
 */
export function usePremiumLectureGate() {
  // Non-throwing: the lecture screens also render in isolation (tests).
  const me = useAuthOptional()?.me;
  const toast = useToast();
  const { t } = useTranslation();
  const premium = me?.membership?.is_premium === true;
  const notify = () => toast.show(t("courses.premiumRequired"), "notice");
  return {
    notify,
    /** Run `go` unless the lecture is premium and the member is not; then notify instead. */
    open(access: "free" | "premium" | undefined, go: () => void) {
      if (access === "premium" && !premium) notify();
      else go();
    },
  };
}

/** The server refused a premium lecture to a member without premium access. */
export function isSubscriptionRequired(e: unknown): boolean {
  return e instanceof ApiError && e.status === 402;
}

/**
 * For a lecture screen reached without the tap check — a direct link, a
 * notification, a membership that lapsed: once the server refuses it (402),
 * leave at once with the notice — back where the member came from, or to
 * the lecture tab when the link was the first page opened.
 */
export function useLeaveLockedLecture(refused: boolean): void {
  const nav = useNavigate();
  const location = useLocation();
  const { notify } = usePremiumLectureGate();
  const left = useRef(false);
  useEffect(() => {
    if (!refused || left.current) return;
    left.current = true;
    notify();
    if (location.key === "default") nav("/courses", { replace: true });
    else nav(-1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refused]);
}
