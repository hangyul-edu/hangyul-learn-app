import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/** The two saved-learning categories, as Saved's tab dropdown names them. */
export type SavedTab = "sentence" | "problem";
/** Which saved feed the user was on: 오답 (wrong) or 찜한 (bookmark). */
export type SavedSource = "wrong" | "bookmark";

/**
 * The saved-learning context a single-item review session was opened from,
 * handed to it in its route state. React Router keeps route state in
 * `history.state`, so this survives a refresh mid-session — which matters
 * because the review routes are deliberately refresh-safe (the item is restored
 * from the URL). It is the session's only source of truth for where 완료 goes;
 * neither review screen may assume a category.
 */
export type SavedOrigin = { savedKey: string; tab: SavedTab; source: SavedSource };

/**
 * The tab Saved was left on to open a review, keyed by the /saved history entry
 * it belongs to. Restores the tab on return even when Saved's full feed snapshot
 * can't be. Read IDEMPOTENTLY (never consumed) and scoped by loc.key — a
 * consume-once flag is clobbered by React StrictMode's dev mount→unmount→mount
 * double-invoke (the throwaway first mount ate it, so the real mount fell back
 * to the default); the loc.key guard is what keeps a fresh visit from picking up
 * a stale hint.
 */
let savedTabHint: { locKey: string; tab: SavedTab } | null = null;

export function rememberSavedTab(locKey: string, tab: SavedTab): void {
  savedTabHint = { locKey, tab };
}
export function readSavedTab(locKey: string): SavedTab | null {
  return savedTabHint && savedTabHint.locKey === locKey ? savedTabHint.tab : null;
}

/**
 * Leaving a review session (back chevron, or the reward modal's 확인) returns to
 * the saved-learning category it was opened from — never a fixed one.
 *
 * `fallbackTab` is the category implied by the route itself, used only when the
 * session was reached without an origin (a cold deep link straight to the review
 * URL), so even then the destination follows the item type rather than a
 * hardcoded Conversation default.
 */
export function useSavedReturn(fallbackTab: SavedTab): () => void {
  const nav = useNavigate();
  const loc = useLocation();
  const origin = (loc.state as SavedOrigin | null) ?? null;

  return useCallback(() => {
    const tab = origin?.tab ?? fallbackTab;
    if (origin) {
      // Re-arm the tab hint from the session's OWN route state. The hint is a
      // module value, so a refresh mid-session drops it; without this, Saved
      // would fall back to the Practice Settings default and a TOPIK review
      // would land the user on Saved Sentences.
      rememberSavedTab(origin.savedKey, tab);
      // Popping keeps Saved's own history entry, so its feed snapshot, scroll
      // position and back button (which reaches Home / Personalized) all survive.
      nav(-1);
      return;
    }
    // No origin: nothing of ours is behind this entry, so open the matching
    // Saved view instead of popping into whatever the browser has. `replace`
    // keeps the finished session out of the back stack.
    nav("/saved", {
      replace: true,
      state: { tab: tab === "problem" ? "quiz" : "sentence" },
    });
  }, [nav, origin, fallbackTab]);
}
