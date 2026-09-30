import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Origin handed to a settings page in its route state: the path of the screen
 * that pushed it. React Router keeps route state in `history.state`, so unlike
 * the router's own `idx` it survives a document reload — a WebView being
 * restored, a PWA relaunch, or a plain refresh.
 */
export type SettingsOrigin = { from: string };

export const settingsOrigin = (from: string): SettingsOrigin => ({ from });

/**
 * Back out of a settings page to whatever opened it.
 *
 * Presence of an origin — not history depth — is what tells us there is an
 * in-app entry behind this one. `window.history.state.idx` cannot answer that:
 * it is re-seeded to 0 whenever a restored history entry arrives without it, so
 * reading a 0 there as "opened cold" would PUSH the parent on top of the child.
 * The parent's own back would then pop straight back into the child, and the
 * two would bounce forever with the real origin stranded below.
 *
 * So: pop when we know we were pushed (keeping the parent's scroll and its own
 * back destination), and otherwise REPLACE with the parent. Neither path ever
 * pushes, so no number of trips through a child page can grow the stack or make
 * the child a back destination.
 */
export function useSettingsBack(parent: string): () => void {
  const nav = useNavigate();
  const from = (useLocation().state as SettingsOrigin | null)?.from ?? null;
  return useCallback(() => {
    if (from) nav(-1);
    else nav(parent, { replace: true });
  }, [nav, from, parent]);
}
