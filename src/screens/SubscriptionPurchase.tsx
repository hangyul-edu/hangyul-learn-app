import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { parts, translate, useTranslation } from "../i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { subApi } from "../api/endpoints";
import payLetterG from "../assets/brand/pay-letter-g.svg";
import payLetterR from "../assets/brand/pay-letter-r.svg";
import payLetterB from "../assets/brand/pay-letter-b.svg";
import payLetterO from "../assets/brand/pay-letter-o.svg";
import payRibbon from "../assets/brand/pay-ribbon.svg";
import payRadioOn from "../assets/brand/pay-radio-on.svg";
import payRadioOff from "../assets/brand/pay-radio-off.svg";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import type { MySubscription, PaymentMethod, Plan } from "../lib/types";

type ScreenStatus = "loading" | "ready" | "submitting" | "missing_plans" | "failed";

function money(cents: number, currency = "USD"): string {
  const amount = cents / 100;
  if (currency === "KRW") return `₩${Math.round(amount).toLocaleString()}`;
  return `$${amount.toFixed(2)}`;
}
/** Displayed amounts. The server sends authoritative presentation values
 *  (original/current totals + monthly-equivalents + discount %); we prefer
 *  those and fall back to deriving from the two price tiers for older payloads. */
function pricing(p: Plan) {
  const isYear = p.interval === "year";
  const original = p.original_total_cents ?? p.price_cents;
  const current = p.current_total_cents ?? p.promo_price_cents ?? p.price_cents;
  return {
    isYear,
    original,
    current,
    origMonthly: p.original_monthly_cents ?? (isYear ? original / 12 : original),
    curMonthly: p.current_monthly_cents ?? (isYear ? current / 12 : current),
    discountPct:
      p.discount_percent ??
      (original > 0 && current < original ? Math.round((1 - current / original) * 100) : 0),
  };
}

/**
 * A plan card, laid out exactly as Figma SET-032 draws it (KO 898:19476 /
 * EN 898:19697, and identically in SET-030 apart from the trial copy):
 *
 *   annual  335x130, r16, 1px Brand border — the launch ribbon overhangs the
 *           top-left, the purple badge sits at (196, 25), the struck price is
 *           right-aligned at 310/54 and the final price at 308/75.
 *   monthly 335x90, r16, 1px Gray 3 — radio centred on the left, the black
 *           discount pill at (188, 20), struck price and current price
 *           right-aligned at 303.
 *
 * Neither authoritative frame carries a hand-drawn arrow across the card, so
 * there is none here. All amounts come from the plan API (never hardcoded).
 */
function PlanCard({ plan, selected, onSelect }: { plan: Plan; selected: boolean; onSelect: () => void }) {
  const { t, language } = useTranslation();
  const c = plan.currency;
  const { isYear, original, current, origMonthly, curMonthly, discountPct } = pricing(plan);
  const term = t(isYear ? "purchase.planYear" : "purchase.planMonth");
  const sel = selected ? t("purchase.selectedSuffix") : "";
  const label = isYear
    ? t("purchase.planYearA11y", {
        selected: sel,
        monthly: money(curMonthly, c),
        total: money(current, c),
      })
    : t("purchase.planMonthA11y", { selected: sel, monthly: money(curMonthly, c) });
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      className={`plan plan--${isYear ? "annual" : "monthly"}${selected ? " plan--on" : ""}`}
      onClick={onSelect}
    >
      {isYear && (
        /* Rectangle 4985 — drawn vertically (27x148) in Figma and rotated a
           quarter turn; the label rides on top of it. */
        <span className="plan__ribbon">
          <img className="plan__ribbon-art" src={payRibbon} alt="" aria-hidden="true" />
          <span className="plan__ribbon-text">{t("purchase.launchDiscount")}</span>
        </span>
      )}

      <span className="plan__label">
        <img className="plan__radio" src={selected ? payRadioOn : payRadioOff} alt="" aria-hidden="true" />
        <span className="plan__term">{term}</span>
      </span>

      {isYear ? (
        <>
          <span className="plan__badge plan__badge--purple">
            {parts(translate(language, "purchase.discountedPrice", { pct: discountPct })).map((seg, i) =>
              seg.strong ? (
                <span className="plan__badge-hl" key={i}>
                  {seg.text}
                </span>
              ) : (
                <span key={i}>{seg.text}</span>
              ),
            )}
          </span>
          <span className="plan__orig-line">
            <s>{t("purchase.perMonthPriceWithTotal", { price: money(origMonthly, c), total: money(original, c) })}</s>
          </span>
          <span className="plan__final">
            <span className="plan__final-main">{money(curMonthly, c)}</span>
            <span className="plan__final-per">{t("purchase.perMonth")}</span>
            <span className="plan__final-total">({money(current, c)})</span>
          </span>
        </>
      ) : (
        <>
          {/* Badge and original price share one right-anchored row, so the badge
              stays flush against the price whatever width the label takes. The
              rule runs through the whole price, suffix included. */}
          <span className="plan__month-row">
            <span className="plan__badge plan__badge--black">
              {t("purchase.discountPct", { pct: discountPct })}
            </span>
            <span className="plan__orig-month">
              <s>
                {money(origMonthly, c)}
                {t("purchase.perMonth")}
              </s>
            </span>
          </span>
          <span className="plan__month-cur">
            <span className="plan__final-main">{money(curMonthly, c)}</span>
            <span className="plan__final-per">{t("purchase.perMonth")}</span>
          </span>
        </>
      )}
    </button>
  );
}

/**
 * Server-driven subscription purchase screen. One component, two variants:
 * - free-trial-eligible account (`!trial_started`) → the 7-day trial version.
 * - ineligible account → the direct-paid version.
 * Eligibility, plans, and payment-method status all come from the backend, which
 * is the source of truth (the client can never grant itself a trial). Starting a
 * trial/subscription requires a registered payment method — otherwise a popup
 * routes the user to registration and preserves the selected plan.
 */
export function SubscriptionPurchase() {
  const { t, language } = useTranslation();
  const nav = useNavigate();
  const loc = useLocation();
  const toast = useToast();
  const qc = useQueryClient();
  // Selected plan is preserved across the payment-method registration round trip.
  const returned = loc.state as { selectedPlanId?: string; from?: string } | null;
  const [selectedId, setSelectedId] = useState<string | null>(returned?.selectedPlanId ?? null);
  const [payModal, setPayModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const plansQ = useQuery({ queryKey: ["sub-plans"], queryFn: subApi.plans });
  const mineQ = useQuery({ queryKey: ["sub-me"], queryFn: subApi.mine });
  const methodsQ = useQuery({ queryKey: ["payment-methods"], queryFn: subApi.paymentMethods });

  const plans: Plan[] = plansQ.data?.plans ?? plansQ.data?.items ?? [];
  const mine = mineQ.data as MySubscription | undefined;
  const methods = (methodsQ.data?.methods ?? methodsQ.data?.items ?? []) as PaymentMethod[];
  // Proceed as long as ANY usable method (card or quick-pay) is registered — the
  // registration popup is only for users with no payment method at all. Being
  // the default is not required (the server resolves the method to charge).
  const hasPaymentMethod = methods.some((m) => m.status === "active");
  // Free-trial eligibility is server-authoritative (never local): !trial_started.
  const eligible = mine ? !mine.trial_started : undefined;
  const entryMode: "free_trial" | "direct_paid" = eligible ? "free_trial" : "direct_paid";

  // Default selection: recommended → annual → first active plan. (No recommended
  // flag on the plan today, so annual is the effective recommendation.)
  useEffect(() => {
    if (selectedId || plans.length === 0) return;
    const annual = plans.find((p) => p.interval === "year");
    setSelectedId((annual ?? plans[0]).plan_id);
  }, [plans, selectedId]);

  const status: ScreenStatus =
    plansQ.isLoading || mineQ.isLoading
      ? "loading"
      : plansQ.isError || mineQ.isError
        ? "failed"
        : plans.length === 0
          ? "missing_plans"
          : submitting
            ? "submitting"
            : "ready";

  async function start() {
    if (submittingRef.current) return; // one request per press
    const plan = plans.find((p) => p.plan_id === selectedId);
    if (!plan) return;
    if (!hasPaymentMethod) {
      setPayModal(true); // gate: only when NO payment method is registered
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      // Separate flows: trial only for eligible accounts, paid otherwise. The
      // backend rechecks both, so this can never grant a second trial.
      if (eligible) await subApi.startTrial(plan.plan_id);
      else {
        const res = await subApi.subscribe(plan.plan_id);
        // Charge not decided yet: no access until it settles, so say so.
        if (res?.subscription?.status === "payment_pending") toast.show(t("subscription.subPending"));
      }
      qc.invalidateQueries({ queryKey: ["sub-me"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      nav("/subscription", { replace: true });
    } catch (e) {
      // e.g. trial already used → refresh eligibility so the UI switches to paid.
      toast.error(errorMessage(e));
      void mineQ.refetch();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  function goRegisterPayment() {
    setPayModal(false);
    nav("/account/payment", {
      state: { from: "/subscription/start", selectedPlanId: selectedId, entryMode },
    });
  }

  const ctaKey = eligible ? "purchase.startTrial" : "purchase.startNow";
  const ctaLabel = t(ctaKey).replace(/<\/?s>/g, "");
  const ctaDisabled = status !== "ready" || !selectedId;

  return (
    <div className="subp">
      {/* Figma SET-030/032 — the soft top-left glow plus the four decorative
          Hangul letters. Exported artwork, not redrawn. */}
      <div className="subp__decor" aria-hidden="true">
        <span className="subp__glow" />
        <img className="subp__deco subp__deco--g" src={payLetterG} alt="" />
        <img className="subp__deco subp__deco--r" src={payLetterR} alt="" />
        <img className="subp__deco subp__deco--b" src={payLetterB} alt="" />
        <img className="subp__deco subp__deco--o" src={payLetterO} alt="" />
      </div>
      <button className="subp__close" onClick={() => nav(-1)} aria-label={t("purchase.close")}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" stroke="#9aa0a6" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      <div className={`subp__body${eligible ? " subp__body--trial" : ""}`}>
        {status === "loading" ? (
          <div className="subp__loading" aria-busy="true">{t("purchase.loading")}</div>
        ) : status === "failed" ? (
          <div className="subp__error">
            <p>{t("purchase.loadError")}</p>
            <button className="btn btn--secondary btn--sm" onClick={() => { plansQ.refetch(); mineQ.refetch(); }}>
              {t("common.retry")}
            </button>
          </div>
        ) : (
          <>
            {eligible && <p className="subp__eyebrow">{t("purchase.eyebrow")}</p>}
            <h1 className="subp__headline">
              {t("purchase.heroLine1")}
              <br />
              {t("purchase.heroLine2")}
            </h1>
            <p className="subp__desc">{t("purchase.heroDesc")}</p>

            {status === "missing_plans" ? (
              <p className="subp__noplans" role="status">
                {t("purchase.noProducts")}
              </p>
            ) : (
              <div className="subp__plans" role="radiogroup" aria-label={t("purchase.productsTitle")}>
                {[...plans]
                  .sort((a, b) => (a.interval === "year" ? 0 : 1) - (b.interval === "year" ? 0 : 1))
                  .map((p) => (
                    <PlanCard
                      key={p.plan_id}
                      plan={p}
                      selected={p.plan_id === selectedId}
                      onSelect={() => setSelectedId(p.plan_id)}
                    />
                  ))}
              </div>
            )}

            <button className="subp__cta" onClick={start} disabled={ctaDisabled} aria-label={ctaLabel}>
              {submitting ? (
                <span className="spinner" style={{ width: 22, height: 22 }} />
              ) : (
                parts(translate(language, ctaKey)).map((seg, i) =>
                  seg.strong ? (
                    <span className="subp__cta-hl" key={i}>
                      {seg.text}
                    </span>
                  ) : (
                    <span key={i}>{seg.text}</span>
                  ),
                )
              )}
            </button>

            <p className="subp__cancel">{t("purchase.cancelAnytime")}</p>
            <p className="subp__note">
              {eligible
                ? t("purchase.trialNote")
                : t("purchase.paidNote")}
            </p>
            <button className="subp__refund" onClick={() => nav("/policy/refund")}>
              {t("purchase.refundPolicy")}
            </button>
          </>
        )}
      </div>

      {payModal && (
        <div className="overlay overlay--center" onClick={() => setPayModal(false)}>
          <div className="lgo" role="alertdialog" aria-modal="true" aria-labelledby="pm-title" onClick={(e) => e.stopPropagation()}>
            <h2 className="lgo__title" id="pm-title">{t("purchase.needMethodTitle")}</h2>
            <p className="lgo__copy" style={{ textAlign: "center" }}>
              {t("purchase.needMethodLine1")}
              <br />
              {t("purchase.needMethodLine2")}
            </p>
            <div className="lgo__actions">
              <button className="lgo__btn lgo__btn--cancel" onClick={() => setPayModal(false)}>{t("common.cancel")}</button>
              <button className="lgo__btn lgo__btn--go" onClick={goRegisterPayment}>{t("purchase.registerMethod")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
