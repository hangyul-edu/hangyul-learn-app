import { useNavigate } from "react-router-dom";
import { SkeletonList } from "../../components/ui/states";
import { useTranslation } from "../../i18n";
import { formatLongDate, formatMoney } from "../../lib/format";
import { hasLiveSubscription } from "../../lib/subscription";
import type { MySubscription } from "../../lib/types";

/** One label / value line of the plan card. */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="subm__srow">
      <span className="subm__label">{label}</span>
      <span className="subm__value">{value}</span>
    </div>
  );
}

/**
 * 나의 플랜 (authoritative from /subscriptions/me): the plan, next billing,
 * renewal amount and 해지하기 — or the no-plan prompt — and, once a
 * cancellation is scheduled, the notice band with 해지 취소.
 */
export function PlanSection({
  query,
  busy,
  onCancel,
  onResume,
}: {
  query: { isLoading: boolean; isError: boolean; data: MySubscription | null | undefined; refetch: () => unknown };
  busy: boolean;
  onCancel: () => void;
  onResume: () => void;
}) {
  const { t, language } = useTranslation();
  const nav = useNavigate();
  const m = query.data;
  // A cancelled subscription still shows (with 해지 취소) until it lapses.
  const hasSub = hasLiveSubscription(m) || m?.status === "cancelled";
  const status = m?.status ?? "";
  const scheduledCancel = !!m?.cancel_at_period_end;
  const planName = m?.plan_name || t("subscription.planFallback");
  const endDate = formatLongDate(m?.current_period_end, language);
  // What each renewal charges, in the subscription's own currency (kept
  // whatever the phone number now bills in). Not for a coupon pass or a
  // cancellation that will not renew.
  const renewal =
    m?.renewal_amount_cents != null && m.plan_currency && !scheduledCancel && !m.coupon_backed
      ? t(m.interval === "year" ? "subscription.renewalYear" : "subscription.renewalMonth", {
          amount: formatMoney(m.renewal_amount_cents, m.plan_currency),
        })
      : null;
  return (
    <>
      <h2 className="subm__h">{t("subscription.myPlanHeading")}</h2>

      {query.isLoading ? (
        <SkeletonList rows={1} height={90} />
      ) : query.isError ? (
        <div className="subm__err">
          <span>{t("subscription.loadError")}</span>
          <button className="subm__retry" onClick={() => query.refetch()}>{t("common.retry")}</button>
        </div>
      ) : hasSub ? (
        <div className="subm__sub">
          <Row label={t("subscription.planLabel")} value={planName} />
          {endDate && (
            <div className="subm__srow">
              {/* MOR-014 keeps the 다음 결제일 label in the cancelling state
                  too and adds a 구독 상태 row underneath. */}
              <span className="subm__label">{t("subscription.nextBilling")}</span>
              <span className="subm__value">{endDate}</span>
            </div>
          )}
          {renewal && (
            <Row label={t("subscription.renewalLabel")} value={renewal} />
          )}
          {scheduledCancel && (
            <Row label={t("subscription.statusLabel")} value={t("subscription.statusCanceling")} />
          )}
          {/* `trial_ending` is a trial in its last 72h — exactly when a
              member most wants to cancel before the first charge. */}
          {!scheduledCancel && ["trial", "trial_ending", "active"].includes(status) && (
            <button className="subm__cancel" onClick={onCancel}>{t("subscription.cancel")}</button>
          )}
        </div>
      ) : (
        <div className="subm__nosub">
          <div className="subm__nosub-text">
            <p className="subm__nosub-1">{t("subscription.noPlanTitle")}</p>
            <p className="subm__nosub-2">{t("subscription.noPlanSub")}</p>
          </div>
          <button className="subm__subscribe" onClick={() => nav("/subscription/start")}>{t("subscription.subscribe")}</button>
        </div>
      )}

      {/* MOR-014 (624:9944) — once a cancellation is scheduled the 해지하기
          link is replaced by a full-bleed 85px band: three Gray 5 lines and
          a 111x42 해지 취소 button pinned at (228, 22) inside it. */}
      {hasSub && scheduledCancel && (
        <div className="subm__cnotice">
          <p className="subm__cnotice-text">
            {t("subscription.cancelNotice1", { date: endDate })}
            <br />
            {t("subscription.cancelNotice2")}
            <br />
            {t("subscription.cancelNotice3")}
          </p>
          <button className="subm__cnotice-btn" onClick={onResume} disabled={busy}>
            {t("subscription.resume")}
          </button>
        </div>
      )}
    </>
  );
}
