/* Arriving from the purchase screen, a successful registration goes back to
   it with the plan the member picked. A registration window leaves the app
   (and its history state) behind, so the way back is kept for this tab
   across the window, like the pending registration itself. */
export const PURCHASE_PATH = "/subscription/start";
const RETURN_TO_KEY = "hangyul.pm-return-to.v1";
export type ReturnTo = { from?: string; selectedPlanId?: string | null };

export function rememberReturnTo(state: ReturnTo | null): void {
  try {
    if (state?.from === PURCHASE_PATH) {
      sessionStorage.setItem(RETURN_TO_KEY, JSON.stringify({ from: state.from, selectedPlanId: state.selectedPlanId ?? null }));
    } else {
      sessionStorage.removeItem(RETURN_TO_KEY);
    }
  } catch {
    /* storage unavailable: the member goes back by hand */
  }
}

/** Read and forget where a window's return should lead. */
export function takeReturnTo(): ReturnTo | null {
  try {
    const raw = sessionStorage.getItem(RETURN_TO_KEY);
    sessionStorage.removeItem(RETURN_TO_KEY);
    return raw ? (JSON.parse(raw) as ReturnTo) : null;
  } catch {
    return null;
  }
}
