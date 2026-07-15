/**
 * User-facing copy + formatting for the failed-automatic-payment recovery flow.
 *
 * The backend returns stable failure *codes* only (never raw provider messages);
 * this module maps them to safe Korean copy and formats the next-retry timestamp
 * in the user's locale/timezone. Keeping the mapping here (not in the backend)
 * lets copy change without an API change.
 */

/** Notice-card sentence describing why the automatic payment failed (§3). */
export function noticeReason(failureClass?: string | null): string {
  switch (failureClass) {
    case "insufficient_funds":
      return "잔액 부족으로 결제가 되지 않았어요.";
    case "card_expired":
      return "등록된 카드의 유효기간이 만료되어 결제가 되지 않았어요.";
    case "declined_generic":
      return "카드사에서 결제를 승인하지 않았어요.";
    case "method_revoked":
      return "등록된 결제수단을 사용할 수 없어 결제가 되지 않았어요.";
    case "provider_outage":
      return "일시적인 결제 오류로 자동결제가 완료되지 않았어요.";
    default:
      return "등록된 결제수단으로 자동결제가 완료되지 않았어요.";
  }
}

/** Guidance appended after the failure reason in the notice card. */
export const NOTICE_GUIDANCE =
  "다른 결제수단을 선택한 후 아래 버튼을 눌러 즉시 재결제할 수 있습니다.";

/** Two-line failure-modal copy, adjusted per reason (§9). */
export function failureModalCopy(failureClass?: string | null): [string, string] {
  switch (failureClass) {
    case "insufficient_funds":
      return ["잔액 부족으로 결제가 진행되지 않았어요", "다른 결제수단을 선택하거나 잔액을 확인해 주세요"];
    case "card_expired":
    case "method_revoked":
      return ["현재 결제수단을 사용할 수 없어요", "다른 결제수단을 선택해 다시 시도해 주세요"];
    case "provider_outage":
      return ["일시적인 오류로 결제가 완료되지 않았어요", "잠시 후 다시 시도해 주세요"];
    default:
      return ["구독료 결제가 진행되지 않았어요", "다른 결제수단을 선택하거나 잠시 후 다시 시도해 주세요"];
  }
}

/** Success-modal description; uses the real plan name rather than always "프리미엄" (§8). */
export function successPlanLine(planName?: string | null): string {
  const label = planName && planName.trim() ? planName.trim() : "프리미엄";
  return `${label} 구독이 정상적으로 결제됐어요`;
}

/**
 * Format the next automatic retry timestamp in the user's locale/timezone (§14):
 * 오늘/내일 relative days, month·day for later dates, and the year when it differs.
 * Returns "" for a missing/invalid value so callers can omit the row.
 */
export function formatRetryAt(iso?: string | null, now: Date = new Date()): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const time = new Intl.DateTimeFormat("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const dayDelta = Math.round(
    (startOfDay(d).getTime() - startOfDay(now).getTime()) / 86_400_000,
  );
  if (dayDelta === 0) return `오늘 ${time}`;
  if (dayDelta === 1) return `내일 ${time}`;
  const datePart = new Intl.DateTimeFormat("ko-KR", {
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
    month: "long",
    day: "numeric",
  }).format(d);
  return `${datePart} ${time}`;
}
