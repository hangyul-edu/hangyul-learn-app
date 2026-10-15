import { useNavigate } from "react-router-dom";
import { useMySubscription } from "../../api/queries";
import { useTranslation } from "../../i18n";
import { formatLongDate } from "../../lib/format";
import { hasLiveSubscription, isTrialStatus } from "../../lib/subscription";
import icChevron from "../../assets/brand/ic-16-chevron.svg";
import subTrialRibbon from "../../assets/brand/sub-trial-ribbon.svg";
import icStarCheck from "../../assets/brand/ic-star-check.svg";

/**
 * 나의 플랜 — one card, server-driven states. Subscription state is
 * authoritative from /subscriptions/me: trial vs paid vs none is derived from
 * the server status, never from UI copy.
 */
export function PlanCard() {
  const { t, language } = useTranslation();
  const nav = useNavigate();
  const sub = useMySubscription();
  const s = sub.data;
  const subState: "trial" | "paid" | "none" = isTrialStatus(s?.status) ? "trial" : hasLiveSubscription(s) ? "paid" : "none";
  const planName = s?.plan_name || t("more.planFallback");
  // MOR-001 prints the date in the app language, not always in Korean.
  const nextBilling = formatLongDate(s?.current_period_end, language);
  // While loading or on error the state is unknown — render a neutral (paid-style)
  // card, never the orange no-subscription CTA.
  const cardVariant = sub.isLoading || sub.isError ? "paid" : subState;
  // No-subscription state has TWO separate targets: the status row (→
  // Subscription Management) and the 구독하기 CTA (→ plan selection). They are
  // sibling buttons, so a CTA tap never triggers the row's action.
  return (
    <section className={`more__sub more__sub--${cardVariant}`} aria-label={t("more.myPlan")}>
      <span className="more__sub-label">{t("more.myPlan")}</span>
      {sub.isLoading ? (
        <div className="more__sub-skeleton" aria-hidden="true" />
      ) : sub.isError ? (
        <div className="more__sub-errrow" role="status">
          <span className="more__sub-empty">{t("more.subLoadError")}</span>
          <button className="more__sub-retry" onClick={() => sub.refetch()}>{t("common.retry")}</button>
        </div>
      ) : subState === "none" ? (
        <>
          <button
            className="more__sub-plan more__sub-emptyrow"
            onClick={() => nav("/subscription")}
            aria-label={t("more.noPlanA11y")}
          >
            <span className="more__sub-title-row">
              <span className="more__sub-empty">{t("more.noPlan")}</span>
              <img className="more__sub-chevron" src={icChevron} alt="" aria-hidden="true" />
            </span>
          </button>
          <button
            className="more__sub-cta"
            onClick={() => nav("/subscription/start")}
            aria-label={t("more.subscribeA11y")}
          >
            {t("more.subscribe")}
          </button>
        </>
      ) : (
        <button
          className="more__sub-plan"
          onClick={() => nav("/subscription")}
          aria-label={t("accountFlow.nextBillingA11y", {
            plan: planName,
            billing: nextBilling ? t("accountFlow.nextBillingSuffix", { date: nextBilling }) : "",
          })}
        >
          {subState === "trial" && (
            <span className="more__sub-ribbon">
              <img className="more__sub-ribbon-art" src={subTrialRibbon} alt="" aria-hidden="true" />
              <span className="more__sub-ribbon-row">
                <img className="more__sub-ribbon-check" src={icStarCheck} alt="" aria-hidden="true" />
                <span className="more__sub-ribbon-text">{t("more.freeTrial")}</span>
              </span>
            </span>
          )}
          <span className="more__sub-title-row">
            <span className="more__sub-title">{planName}</span>
            <img className="more__sub-chevron" src={icChevron} alt="" aria-hidden="true" />
          </span>
          {nextBilling && (
            <span className="more__sub-billing">
              <span>{t("more.nextBilling")}</span>
              <span>{nextBilling}</span>
            </span>
          )}
        </button>
      )}
    </section>
  );
}
