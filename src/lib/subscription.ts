import type { MySubscription } from "./types";

/**
 * Effective statuses (GET /subscriptions/me) in which the subscription is in
 * force — the server's premium states (`_PREMIUM_STATES`) plus the derived
 * `trial_ending`, which is a trial in its last 72 hours.
 */
const LIVE_STATUSES = new Set([
  "trial",
  "trial_ending",
  "active",
  "payment_pending",
  "payment_failed",
  "grace_period",
]);

/** A trial, including one in its last 72 hours (`trial_ending`). */
export function isTrialStatus(status: string | null | undefined): boolean {
  return status === "trial" || status === "trial_ending";
}

/**
 * Statuses POST /subscriptions/cancel accepts (Subscription.cancel_at_period
 * refuses only `expired` and `suspended`): a live subscription, a renewal
 * still being retried included.
 */
export function isCancelableStatus(status: string | null | undefined): boolean {
  return !!status && LIVE_STATUSES.has(status);
}

/** Whether the member has a subscription (paid, trial or coupon) in force. */
export function hasLiveSubscription(sub: MySubscription | null | undefined): boolean {
  return !!sub && (LIVE_STATUSES.has(sub.status) || !!sub.coupon_backed);
}
