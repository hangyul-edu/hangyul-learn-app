import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { subApi } from "../api/endpoints";
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
 * A plan card. The annual (year) card is the larger, two-row selected card with
 * the launch ribbon, purple discount badge, struck original-price graphic, and
 * the final price. The monthly (month) card is shorter: radio + label on the
 * left, a black discount pill + struck original on the top-right, and the
 * current price below. All amounts come from the plan API (never hardcoded).
 */
function PlanCard({ plan, selected, onSelect }: { plan: Plan; selected: boolean; onSelect: () => void }) {
  const c = plan.currency;
  const { isYear, original, current, origMonthly, curMonthly, discountPct } = pricing(plan);
  const term = isYear ? "12개월" : "1개월";
  const label = isYear
    ? `12개월 요금제${selected ? ", 선택됨" : ""}. 월 ${money(curMonthly, c)} 상당, 연 ${money(current, c)} 청구.`
    : `1개월 요금제${selected ? ", 선택됨" : ""}. 월 ${money(curMonthly, c)}.`;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      className={`plan plan--${isYear ? "annual" : "monthly"}${selected ? " plan--on" : ""}`}
      onClick={onSelect}
    >
      {isYear && <span className="plan__ribbon">런칭 기념 특별 할인</span>}

      {isYear ? (
        <div className="plan__annual-grid">
          <span className="plan__label">
            <span className="plan__radio" aria-hidden="true" />
            <span className="plan__term">{term}</span>
          </span>
          <span className="plan__annual-right">
            <span className="plan__badge plan__badge--purple">
              <span className="plan__badge-hl">최대 {discountPct}% 할인</span> 된 가격
            </span>
            <span className="plan__orig-line">
              <s>{money(origMonthly, c)}/월 ({money(original, c)})</s>
            </span>
            <span className="plan__final">
              <span className="plan__final-main">{money(curMonthly, c)}</span>
              <span className="plan__final-per">/월</span>
              <span className="plan__final-total">({money(current, c)})</span>
            </span>
          </span>
        </div>
      ) : (
        <div className="plan__row plan__row--month">
          <span className="plan__label">
            <span className="plan__radio" aria-hidden="true" />
            <span className="plan__term">{term}</span>
          </span>
          <span className="plan__month-right">
            <span className="plan__month-top">
              <span className="plan__badge plan__badge--black">{discountPct}% 할인</span>
              <span className="plan__orig-month"><s>{money(origMonthly, c)}/월</s></span>
            </span>
            <span className="plan__month-cur">
              <span className="plan__final-main">{money(curMonthly, c)}</span>
              <span className="plan__final-per">/월</span>
            </span>
          </span>
        </div>
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
      else await subApi.subscribe(plan.plan_id);
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

  const ctaLabel = eligible ? "7일 무료 체험 시작하기" : "지금 바로 시작하기";
  const ctaDisabled = status !== "ready" || !selectedId;

  return (
    <div className="subp">
      <div className="subp__decor" aria-hidden="true" />
      <button className="subp__close" onClick={() => nav(-1)} aria-label="닫기">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" stroke="#9aa0a6" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      <div className="subp__body">
        {status === "loading" ? (
          <div className="subp__loading" aria-busy="true">불러오는 중…</div>
        ) : status === "failed" ? (
          <div className="subp__error">
            <p>정보를 불러오지 못했어요.</p>
            <button className="btn btn--secondary btn--sm" onClick={() => { plansQ.refetch(); mineQ.refetch(); }}>
              다시 시도
            </button>
          </div>
        ) : (
          <>
            {eligible && <p className="subp__eyebrow">일주일 무료로 먼저 체험해보세요</p>}
            <h1 className="subp__headline">
              지금 시작하면,
              <br />
              모든 학습을 자유롭게 이용할 수 있어요
            </h1>
            <p className="subp__desc">한귤과 함께하면 말하는 실력이 달라집니다</p>

            {status === "missing_plans" ? (
              <p className="subp__noplans" role="status">
                이용 가능한 구독 상품이 없어요. 잠시 후 다시 확인해 주세요.
              </p>
            ) : (
              <div className="subp__plans" role="radiogroup" aria-label="구독 상품">
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
              {submitting ? <span className="spinner" style={{ width: 22, height: 22 }} /> : ctaLabel}
            </button>

            <p className="subp__note">
              {eligible
                ? "7일 무료 체험 후 선택한 요금제로 자동 결제돼요. 구독은 언제든지 취소할 수 있어요."
                : "선택한 요금제로 결제가 진행돼요. 구독은 언제든지 취소할 수 있어요."}
            </p>
            <button className="subp__refund" onClick={() => nav("/policy/refund")}>
              환불 정책 보기
            </button>
          </>
        )}
      </div>

      {payModal && (
        <div className="overlay overlay--center" onClick={() => setPayModal(false)}>
          <div className="lgo" role="alertdialog" aria-modal="true" aria-labelledby="pm-title" onClick={(e) => e.stopPropagation()}>
            <h2 className="lgo__title" id="pm-title">결제수단 등록이 필요해요</h2>
            <p className="lgo__copy" style={{ textAlign: "center" }}>
              무료 체험 또는 구독을 시작하려면
              <br />
              먼저 결제수단을 등록해주세요
            </p>
            <div className="lgo__actions">
              <button className="lgo__btn lgo__btn--cancel" onClick={() => setPayModal(false)}>취소</button>
              <button className="lgo__btn lgo__btn--go" onClick={goRegisterPayment}>결제수단 등록하기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
