import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { payApi, subApi } from "../../api/endpoints";
import { useAuth } from "../../hooks/auth";
import { useToast } from "../../hooks/toast";
import { useTranslation } from "../../i18n";
import { ApiError } from "../../lib/http";
import { paymentErrorMessage } from "../../lib/paymentErrors";
import type { Plan } from "../../lib/types";
import { pricing } from "./PlanCard";

export type ScreenStatus = "loading" | "ready" | "submitting" | "missing_plans" | "failed";

/** The default method charges another currency than the plan's. */
export type CurrencyBlock = { plan: Plan; card: string; hasMatching: boolean };

/** No method on file pays the plan's currency, and it is not KRW: the fix is
 * adding an overseas card (otherwise, picking the matching method). */
export function needsOverseasCard(block: CurrencyBlock): boolean {
  return !block.hasMatching && block.plan.currency?.toUpperCase() !== "KRW";
}

/**
 * The purchase flow: the offers and methods it is decided from, the selected
 * plan, and starting the trial or subscription — or the gate that sends the
 * member to register a payment method first (keeping the plan they picked).
 */
export function usePurchase() {
  const { t } = useTranslation();
  const { bootstrapMe } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const toast = useToast();
  const qc = useQueryClient();
  // The plan picked before going to register a payment method: the payment
  // screen comes back with it, and Back finds it on this history entry.
  const returned = loc.state as { selectedPlanId?: string; from?: string } | null;
  const [selectedId, setSelectedId] = useState<string | null>(returned?.selectedPlanId ?? null);
  const [payModal, setPayModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  // What this member is offered: one plan per interval, priced for them (the
  // plan's new-member price where it applies), and their one free trial —
  // both decided by the server.
  const offersQ = useQuery({ queryKey: ["sub-offers"], queryFn: subApi.offers });
  const methodsQ = useQuery({ queryKey: ["payment-methods"], queryFn: payApi.methods });

  const plans: Plan[] = offersQ.data?.plans ?? [];
  const methods = methodsQ.data?.methods ?? [];
  // Proceed as long as ANY usable method (card or quick-pay) is registered — the
  // registration popup is only for users with no payment method at all. Being
  // the default is not required (the server resolves the method to charge).
  const hasPaymentMethod = methods.some((m) => m.status === "active");
  // The method the server will charge (method_id is omitted → the default).
  const active = methods.filter((m) => m.status === "active");
  const chargeMethod = active.find((m) => m.is_default) ?? active[0];
  const [currencyBlock, setCurrencyBlock] = useState<CurrencyBlock | null>(null);
  // Free-trial eligibility is server-authoritative (never local): one trial
  // per person, across accounts they withdrew and signed up again.
  const eligible = offersQ.data?.trial.available;

  // Default selection: recommended → annual → first active plan. (No recommended
  // flag on the plan today, so annual is the effective recommendation.)
  // A selection that is no longer offered (taken off sale while the member was
  // away registering a card) falls back the same way.
  useEffect(() => {
    if (plans.length === 0 || plans.some((p) => p.plan_id === selectedId)) return;
    const annual = plans.find((p) => p.interval === "year");
    setSelectedId((annual ?? plans[0]).plan_id);
  }, [plans, selectedId]);

  // The methods decide what the CTA does (register one first, or explain a
  // currency mismatch), so the screen waits for them as for the offers.
  const status: ScreenStatus =
    offersQ.isLoading || methodsQ.isLoading
      ? "loading"
      : offersQ.isError || methodsQ.isError
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
    // A method charges only its billing_currency (domestic / Toss Pay / Naver
    // Pay: KRW). Explain up front instead of letting the server refuse with
    // subscription.currency_mismatch (still mapped below as a fallback).
    const card = chargeMethod?.billing_currency?.toUpperCase();
    const planCur = plan.currency?.toUpperCase();
    if (card && planCur && card !== planCur) {
      const hasMatching = active.some((m) => m.billing_currency?.toUpperCase() === planCur);
      setCurrencyBlock({ plan, card, hasMatching });
      return;
    }
    // What this screen shows is what is charged: the server refuses (409
    // subscription.price_changed) rather than charge another currency or amount.
    const quote = { currency: planCur, quoted_amount_cents: pricing(plan).current };
    submittingRef.current = true;
    setSubmitting(true);
    try {
      // Separate flows: trial only for eligible accounts, paid otherwise. The
      // backend rechecks both, so this can never grant a second trial.
      if (eligible) await subApi.startTrial(plan.plan_id, quote);
      else {
        const res = await subApi.subscribe(plan.plan_id, undefined, quote);
        // Charge not decided yet: no access until it settles, so say so.
        if (res?.subscription?.status === "payment_pending") toast.show(t("subscription.subPending"));
      }
      qc.invalidateQueries({ queryKey: ["sub-me"] });
      qc.invalidateQueries({ queryKey: ["sub-offers"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      // Premium gates read the profile's membership, so re-read it now rather
      // than leave a new trial or subscriber treated as free until a reload.
      await bootstrapMe().catch(() => undefined);
      nav("/subscription", { replace: true });
    } catch (e) {
      // e.g. trial already used → refresh eligibility so the UI switches to paid.
      // subscription.currency_mismatch gets its own copy (card vs plan currency).
      if (e instanceof ApiError && e.code === "subscription.price_changed") toast.error(t("purchase.priceChanged"));
      else toast.error(paymentErrorMessage(e));
      void offersQ.refetch();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  /** To the payment-method screen, which comes back here with the plan after
   *  a registration. The choice is also kept on this history entry, so going
   *  Back without registering keeps it too. */
  function toPaymentMethods(extra: { addCard?: "international" } = {}) {
    nav(loc.pathname, { replace: true, state: { selectedPlanId: selectedId } });
    nav("/account/payment", {
      state: { from: "/subscription/start", selectedPlanId: selectedId, ...extra },
    });
  }

  function goRegisterPayment() {
    setPayModal(false);
    toPaymentMethods();
  }

  /** From the currency explanation: straight to the overseas-card form for a
   *  non-KRW plan (unless a matching method exists and only needs selecting). */
  function goFixCurrency() {
    const block = currencyBlock;
    setCurrencyBlock(null);
    toPaymentMethods(block && needsOverseasCard(block) ? { addCard: "international" } : {});
  }

  return {
    status,
    plans,
    eligible,
    selectedId,
    setSelectedId,
    submitting,
    start,
    retry: () => {
      if (offersQ.isError) void offersQ.refetch();
      if (methodsQ.isError) void methodsQ.refetch();
    },
    payModal,
    closePayModal: () => setPayModal(false),
    goRegisterPayment,
    currencyBlock,
    closeCurrencyBlock: () => setCurrencyBlock(null),
    goFixCurrency,
  };
}
