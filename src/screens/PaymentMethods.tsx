import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, Sheet } from "../components/ui/Modal";
import { Button } from "../components/ui/kit";
import { TextField } from "../components/ui/Field";
import { SkeletonList } from "../components/ui/states";
import { NaverPayLogo, TossPayLogo } from "../components/brand/PayBrand";
import { billingApi, payApi, subApi } from "../api/endpoints";
import { useAuth } from "../hooks/auth";
import { useToast } from "../hooks/toast";
import { ApiError, errorMessage } from "../lib/http";
import { currencyMismatchText, paymentErrorMessage } from "../lib/paymentErrors";
import { InternationalCardSheet } from "../components/InternationalCardSheet";
import {
  NOTICE_GUIDANCE_KEY,
  failureModalKeys,
  formatRetryAt,
  noticeReasonKey,
  retryBlockedKey,
  retryRefusal,
} from "../lib/paymentRecovery";
import {
  hasReturnParams,
  parseRegistrationReturn,
  savePendingRegistration,
  takePendingRegistration,
} from "../lib/paymentReturn";
import {
  isUserCancel,
  requestEasyPayBillingAuth,
  requestTossBillingAuth,
} from "../lib/tossPayments";
import { useTranslation, type TranslationKey } from "../i18n";
import type { MethodProvider, PaymentMethod, Plan } from "../lib/types";
import { isPayLaunched } from "../lib/launch";
import cardArt from "../assets/brand/pm-card-art.svg";
import trashIcon from "../assets/brand/ic-trash.svg";
import successIcon from "../assets/brand/ic-modal-success.svg";
import radioOn from "../assets/brand/pm-radio-on.svg";
import radioOff from "../assets/brand/pm-radio-off.svg";
import addPlus from "../assets/brand/pm-add-plus.svg";
import { DetailHeader } from "../components/DetailHeader";

const QK = ["payment-methods"] as const;
const RECOVERY_QK = ["payment-recovery"] as const;
const RETURN_URL = () => window.location.origin + "/account/payment";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* --------------------------------- icons -------------------------------- */
/* Group 1410118763 — the 10x12 bin glyph exported from SET-002. */
const Trash = () => <img src={trashIcon} width={10} height={12} alt="" aria-hidden="true" />;
/* Group 1410118744 (1988:24838) — the 25px brand disc with its white plus. */
const Plus = () => <img className="pm__add-plus" src={addPlus} alt="" aria-hidden="true" />;
/* Group 1410118747 — the 46x27.26 card illustration exported from SET-002.
   The design uses one mark for every issuer, so `brand` is not consulted. */
const CardGlyph = () => <img className="pm__thumb" src={cardArt} alt="" aria-hidden="true" />;
/* Group 1410118751 / 1410118752 — the 15px selected / unselected radio. */
const Radio = ({ checked }: { checked: boolean }) => (
  <img className="pm__radio" src={checked ? radioOn : radioOff} alt="" aria-hidden="true" />
);
/* SET-005's title opens with a literal "⚠" inside the text run (1492:21673),
   not a vector layer, so there is no asset to export and the character itself
   renders as a colour emoji on Apple platforms. This reproduces the glyph as
   Figma draws it — a solid Brand color 1 triangle measured at 17 x 14.25 in
   the 4x export of 1488:21639, ink from (15.25, 27.75). */
const WarnTriangle = () => (
  <svg className="pm__notice-fail-warn" width="17" height="14.25" viewBox="0 0 17 14.25" fill="none" aria-hidden="true">
    <path d="M7.42 0.62a1.25 1.25 0 0 1 2.16 0l6.9 11.75a1.25 1.25 0 0 1-1.08 1.88H1.6a1.25 1.25 0 0 1-1.08-1.88L7.42.62Z" fill="#ff6700" />
    <path d="M8.5 4.35v4.3" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="8.5" cy="11.05" r="0.9" fill="#fff" />
  </svg>
);
/* Ellipse 1111 + Polygon 18 (1542:23329/23330) — the 60px success badge. */
const CheckMark = () => <img src={successIcon} alt="" aria-hidden="true" />;

/* -------------------------------- helpers ------------------------------- */
// Logo height (px). Both marks share the same height so their icons render at
// the same size (each icon fills its 32-unit-tall viewBox at 1:1), while Toss
// Pay still reads wider via its longer icon+wordmark lockup. Sizing lives here
// (the config), not in the card markup, so each provider stays tunable.
const EASY_PAY: {
  provider: MethodProvider;
  labelKey: TranslationKey;
  Logo: () => JSX.Element;
}[] = [
  { provider: "toss_pay", labelKey: "paymentMethods.tossPay", Logo: TossPayLogo },
  { provider: "naver_pay", labelKey: "paymentMethods.naverPay", Logo: NaverPayLogo },
];

function cardName(m: PaymentMethod): string {
  if (m.issuer) return m.issuer;
  const paren = m.display_name.indexOf("(");
  return paren > 0 ? m.display_name.slice(0, paren).trim() : m.display_name;
}

/* Subscription states whose plan currency binds the default method — the
   server's _RENEWING_STATES plus the derived `trial_ending`. */
const RENEWING = new Set(["trial", "trial_ending", "active", "payment_pending", "payment_failed", "grace_period", "suspended"]);

/* One connection/registration flow driven through the shared Sheet: a link to
   the provider's window (which returns to this page, handled on mount) plus a
   manual entry for the value it returns. */
type Flow = {
  title: string;
  authorizeUrl: string;
  placeholder: string;
  confirm: (token: string) => Promise<void>;
};

/* -------------------------------- screen -------------------------------- */
type ResultModal = { kind: "success" } | { kind: "failure"; failureClass?: string | null } | null;

/** A retry the server refused (retry limits, a method it cannot charge); `message` is the explanation. */
class RetryRefusedError extends Error {}

/* Non-dismissable payment-result modal (§8/§9/§10): no outside-tap/back close,
   scroll locked, focus moved to the action button and restored on close. */
function PaymentResultModal({
  variant,
  planName,
  failureClass,
  onConfirm,
}: {
  variant: "success" | "failure";
  planName?: string | null;
  failureClass?: string | null;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const btnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    btnRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);
  const success = variant === "success";
  const [l1, l2] = success
    ? [
        t("paymentRecovery.successPlanLine", {
          plan: planName?.trim() || t("paymentMethods.planFallback"),
        }),
        t("paymentMethods.paySuccessSub"),
      ]
    : (failureModalKeys(failureClass).map((k) => t(k)) as [string, string]);
  return (
    <div className="overlay overlay--center pm-result-overlay" role="dialog" aria-modal="true" aria-label={t(success ? "paymentMethods.paySuccessA11y" : "paymentMethods.payFailA11y")}>
      <div className="pm-result" onClick={(e) => e.stopPropagation()}>
        <div className={`pm-result__icon ${success ? "is-ok" : "is-fail"}`}>
          {/* SET-007 draws the failure mark as the ⚠ character, not a vector. */}
          {success ? <CheckMark /> : <span aria-hidden="true">⚠</span>}
        </div>
        <h2 className="pm-result__title">{t(success ? "paymentMethods.paySuccessTitle" : "paymentMethods.payFailTitle")}</h2>
        <p className="pm-result__desc">{l1}<br />{l2}</p>
        <button ref={btnRef} className="pm-result__btn" onClick={onConfirm} aria-label={t(success ? "paymentMethods.paySuccessConfirmA11y" : "paymentMethods.payFailConfirmA11y")}>
          {success ? t("common.confirm") : t("paymentMethods.chooseAnother")}
        </button>
      </div>
    </div>
  );
}

export function PaymentMethods() {
  const { t, language } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const { bootstrapMe } = useAuth();
  const q = useQuery({ queryKey: QK, queryFn: payApi.methods });
  const recoveryQ = useQuery({ queryKey: RECOVERY_QK, queryFn: billingApi.recovery });
  const methods = q.data?.methods ?? [];
  const cards = methods.filter((m) => m.kind === "card");

  /* --- currency binding: a card charged in one currency pays only plans in it --- */
  const subQ = useQuery({ queryKey: ["sub-me"], queryFn: subApi.mine });
  const sub = subQ.data;
  const liveCurrency = sub && RENEWING.has(sub.status) ? sub.plan_currency?.toUpperCase() ?? null : null;
  // Arriving from the purchase screen: the plan being bought (and maybe a
  // request to open the overseas-card form straight away).
  const navState = location.state as { selectedPlanId?: string; addCard?: string } | null;
  const buyingPlanId = navState?.selectedPlanId;
  const offersQ = useQuery({ queryKey: ["sub-offers"], queryFn: subApi.offers, enabled: !!buyingPlanId });
  const plans: Plan[] = offersQ.data?.plans ?? [];
  // Every offered plan is priced in the member's billing currency.
  const buyingCurrency =
    (plans.find((p) => p.plan_id === buyingPlanId)?.currency ?? offersQ.data?.currency)?.toUpperCase() ?? null;
  const preferredCurrency = liveCurrency ?? buyingCurrency;
  const currencyLocked = (m: PaymentMethod) =>
    !!liveCurrency && !!m.billing_currency && m.billing_currency.toUpperCase() !== liveCurrency;
  const methodTag = (m: PaymentMethod): string | null => {
    const region = m.card_region
      ? t(m.card_region === "international" ? "paymentMethods.regionInternational" : "paymentMethods.regionDomestic")
      : null;
    const currency = m.billing_currency?.toUpperCase() ?? null;
    if (region && currency) return t("paymentMethods.cardTag", { region, currency });
    return region ?? currency;
  };

  const [removeTarget, setRemoveTarget] = useState<PaymentMethod | null>(null);
  const [intlOpen, setIntlOpen] = useState(navState?.addCard === "international");
  const [flow, setFlow] = useState<Flow | null>(null);
  const [token, setToken] = useState("");
  const [starting, setStarting] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [resultModal, setResultModal] = useState<ResultModal>(null);
  const cardsRef = useRef<HTMLElement>(null);
  const retryBtnRef = useRef<HTMLButtonElement>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: QK });
  const invalidateRecovery = () => qc.invalidateQueries({ queryKey: RECOVERY_QK });
  const scrollToCards = () => cardsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  /* --- primary selection (optimistic, single-flight, reconciled) --- */
  const setDefault = useMutation({
    mutationFn: (id: string) => payApi.setDefault(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: QK });
      const prev = qc.getQueryData<{ methods: PaymentMethod[] }>(QK);
      qc.setQueryData<{ methods: PaymentMethod[] }>(QK, (old) =>
        old ? { methods: old.methods.map((m) => ({ ...m, is_default: m.method_id === id })) } : old,
      );
      return { prev };
    },
    onError: (e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(QK, ctx.prev);
      toast.error(paymentErrorMessage(e));
    },
    onSettled: invalidate,
  });

  function selectPrimary(m: PaymentMethod) {
    // A primary change mid-retry could invalidate the in-flight charge — block it.
    if (m.is_default || setDefault.isPending || retry.isPending) return;
    if (currencyLocked(m)) {
      // The server would refuse it (payment_method.currency_mismatch); say why up front.
      toast.error(currencyMismatchText(m.billing_currency, liveCurrency));
      return;
    }
    setDefault.mutate(m.method_id);
  }

  /* --- deletion / disconnect --- */
  const remove = useMutation({
    mutationFn: async (target: PaymentMethod) => {
      // Deleting the primary while another usable method remains: hand the
      // primary to it atomically (server soft-deletes the target). Only an
      // active method that can pay the live plan's currency qualifies — the
      // server refuses a revoked one (404) or another currency's (422).
      // Otherwise a plain delete, which the backend rejects (409) only when it
      // is the primary during an active subscription.
      const replacement = methods.find(
        (m) => m.method_id !== target.method_id && m.status === "active" && !currencyLocked(m),
      );
      if (target.is_default && replacement) {
        await payApi.replace(target.method_id, replacement.method_id);
      } else {
        await payApi.remove(target.method_id);
      }
    },
    onSuccess: () => {
      setRemoveTarget(null);
      invalidate();
    },
    onError: (e) => toast.error(paymentErrorMessage(e)), // keep the modal open
  });

  /* --- failed-automatic-payment recovery --- */
  const recovery = recoveryQ.data;
  // The notice stays up whenever a payment needs fixing; only the button
  // depends on whether a retry would be accepted now (the retry limits).
  const showNotice =
    !recoveryQ.isLoading &&
    !!recovery?.recovery_required &&
    !!recovery.outstanding_invoice_id;
  const canRetryNow = !!recovery?.can_retry_immediately;
  const retryBlockedText =
    showNotice && !canRetryNow
      ? blockedText(recovery?.retry_blocked_reason, recovery?.retry_available_at)
      : "";

  function blockedText(reason?: string | null, retryAfter?: string | null): string {
    return t(retryBlockedKey(reason), { time: formatRetryAt(retryAfter, language, t) || "—" });
  }
  const primaryMethod = methods.find((m) => m.is_default && m.status === "active");

  // Determine the authoritative terminal result: the invoice being paid is the
  // ONLY success signal; a still-outstanding recovery is a failure; anything
  // else (e.g. provider timeout → payment_pending) is treated as pending.
  async function verifyRetry(invoiceId: string): Promise<ResultModal | "pending"> {
    for (let i = 0; i < 3; i++) {
      const { invoice } = await billingApi.invoice(invoiceId);
      if (invoice.status === "paid") return { kind: "success" };
      if (i < 2) await sleep(300);
    }
    const rec = await billingApi.recovery();
    if (!rec.recovery_required) return { kind: "success" };
    if (rec.outstanding_invoice_id) return { kind: "failure", failureClass: rec.failure_class };
    return "pending";
  }

  const retry = useMutation({
    mutationFn: async (invoiceId: string): Promise<ResultModal | "pending"> => {
      try {
        await billingApi.retryInvoice(invoiceId);
      } catch (e) {
        // The previous charge is still being sent to the provider: its
        // outcome is not known yet, so this is neither a success nor a failure.
        if (e instanceof ApiError && e.code === "billing.charge_in_progress") return "pending";
        // Refused by the retry limits (too soon, too many today, attempts
        // spent) or because this method cannot be charged: explain why,
        // and re-read the recovery state that drives the button.
        const refusal = retryRefusal(e);
        if (refusal) {
          invalidateRecovery();
          throw new RetryRefusedError(blockedText(refusal.reason, refusal.retryAfter));
        }
        // Already paid (idempotency guard) → verify and treat as recovered.
        if (e instanceof ApiError && e.status === 409) return verifyRetry(invoiceId);
        // Outstanding invoice vanished (resolved elsewhere) → refresh & clear.
        if (e instanceof ApiError && e.status === 404) {
          invalidateRecovery();
          throw new Error("resolved");
        }
        throw e;
      }
      return verifyRetry(invoiceId);
    },
    onSuccess: (result) => {
      if (result === "pending") {
        toast.show(t("paymentMethods.checkingResult"));
        invalidateRecovery();
        return;
      }
      if (result?.kind === "success") {
        setResultModal({ kind: "success" });
        // The paid invoice restores premium: the subscription card, the
        // dashboard's paywall flag and the payment history all changed.
        for (const key of [["sub-me"], ["dashboard"], ["invoices"], ["invoices-inf"]]) {
          qc.invalidateQueries({ queryKey: key });
        }
      } else if (result?.kind === "failure") {
        setResultModal({ kind: "failure", failureClass: result.failureClass });
      }
      invalidate();
      invalidateRecovery();
    },
    onError: (e) => {
      const msg = e instanceof RetryRefusedError
        ? e.message
        : e instanceof Error && e.message === "resolved"
          ? t("paymentMethods.alreadyProcessed")
          : errorMessage(e);
      toast.error(msg);
    },
  });

  function doRetry() {
    if (!showNotice || !canRetryNow || !recovery?.outstanding_invoice_id) return;
    // Never charge against a stale method id: wait for a pending primary change.
    if (setDefault.isPending || retry.isPending) return;
    if (!primaryMethod) {
      toast.error(t("paymentMethods.selectFirst"));
      scrollToCards();
      return;
    }
    retry.mutate(recovery.outstanding_invoice_id);
  }

  async function confirmSuccess() {
    setResultModal(null);
    // Reconcile the recovery notice and the wallet, and re-read the profile's
    // membership. (Premium-gated screens were already refreshed on success.)
    invalidate();
    invalidateRecovery();
    try {
      await bootstrapMe();
    } catch {
      /* entitlement refresh is best-effort; server remains the source of truth */
    }
  }

  function closeFailure() {
    setResultModal(null);
    invalidateRecovery(); // pull any updated failure reason
    scrollToCards();
    retryBtnRef.current?.focus();
  }

  /* --- return from a provider's registration window --- */
  const handledReturn = useRef(false);
  useEffect(() => {
    if (handledReturn.current || !hasReturnParams(location.search)) return;
    handledReturn.current = true;
    const search = location.search;
    // Drop the provider's parameters so a reload does not confirm again.
    navigate({ pathname: location.pathname }, { replace: true, state: location.state });
    const pending = takePendingRegistration();
    if (!pending) return;
    const ret = parseRegistrationReturn(pending, search);
    if (!ret) return;
    if (ret.kind === "failed") {
      // Closing the window is the member's choice, not an error.
      if (ret.code === "PAY_PROCESS_CANCELED" || ret.code === "USER_CANCEL") return;
      toast.error(ret.message || t("paymentMethods.registerFailed"));
      return;
    }
    setConfirming(true);
    const confirm =
      pending.provider === "toss_pay"
        ? payApi.tosspayConfirm
        : pending.provider === "naver_pay"
          ? payApi.naverpayConfirm
          : payApi.cardConfirm;
    confirm(pending.intentId, { authKey: ret.authKey, customerKey: ret.customerKey })
      .then(() => {
        toast.success(t("paymentMethods.registered"));
        invalidate();
      })
      .catch((e) => toast.error(errorMessage(e)))
      .finally(() => setConfirming(false));
    // Runs once per arrival; the handled flag guards StrictMode's re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  /* --- registration / connection flows --- */
  async function start(key: string, open: () => Promise<Flow | null>) {
    if (starting) return; // prevent duplicate launches
    setStarting(key);
    try {
      setToken("");
      setFlow(await open());
    } catch (e) {
      // e.g. payment_method.currency_mismatch: a KRW method while on a USD plan.
      toast.error(paymentErrorMessage(e));
    } finally {
      setStarting(null);
    }
  }
  /* Korean-issued cards: Toss's hosted billing window (it takes only domestic
     cards). Overseas cards use the app's own form — InternationalCardSheet. */
  const startDomesticCard = () =>
    start("card-domestic", async () => {
      const res = await payApi.cardIntent(RETURN_URL());
      if (res.widget.client_key) {
        // Toss opens its window through the SDK and returns to this page.
        savePendingRegistration({ provider: "toss_card", intentId: res.intent_id, customerKey: res.customer_key });
        try {
          await requestTossBillingAuth({
            clientKey: res.widget.client_key,
            customerKey: res.customer_key,
            successUrl: res.widget.success_url,
            failUrl: res.widget.fail_url,
          });
        } catch (e) {
          if (isUserCancel(e)) return null; // the member closed the window
          throw e;
        }
        return null;
      }
      // No client key (card billing not configured, e.g. local dev with the
      // fake provider): only the manual entry remains.
      return {
        title: t("paymentMethods.domesticCardTitle"),
        authorizeUrl: "",
        placeholder: t("paymentMethods.authKeyPlaceholder"),
        confirm: (key) =>
          payApi.cardConfirm(res.intent_id, { authKey: key, customerKey: res.customer_key }).then(() => undefined),
      };
    });
  /* Toss Pay / Naver Pay: the wallet's own window, opened by Toss's SDK
     (flowMode DIRECT), returning here like the card window. */
  const startWallet = (provider: "toss_pay" | "naver_pay") =>
    start(provider, async () => {
      const res =
        provider === "toss_pay" ? await payApi.tosspayIntent(RETURN_URL()) : await payApi.naverpayIntent(RETURN_URL());
      const confirm = provider === "toss_pay" ? payApi.tosspayConfirm : payApi.naverpayConfirm;
      if (res.window.client_key) {
        savePendingRegistration({ provider, intentId: res.intent_id, customerKey: res.customer_key });
        try {
          await requestEasyPayBillingAuth({
            clientKey: res.window.client_key,
            customerKey: res.customer_key,
            successUrl: res.window.success_url,
            failUrl: res.window.fail_url,
            easyPay: res.window.easy_pay,
          });
        } catch (e) {
          if (isUserCancel(e)) return null;
          throw e;
        }
        return null;
      }
      // Not configured on this server (local dev with the fake provider):
      // only the manual entry remains.
      return {
        title: t(provider === "toss_pay" ? "paymentMethods.tossPay" : "paymentMethods.naverPay"),
        authorizeUrl: "",
        placeholder: t("paymentMethods.authKeyPlaceholder"),
        confirm: (key) =>
          confirm(res.intent_id, { authKey: key, customerKey: res.customer_key }).then(() => undefined),
      };
    });
  const startTossPay = () => startWallet("toss_pay");
  const startNaverPay = () => startWallet("naver_pay");

  const closeIntl = useCallback(() => setIntlOpen(false), []);
  const intlRegistered = useCallback(() => {
    setIntlOpen(false);
    toast.success(t("paymentMethods.registered"));
    void qc.invalidateQueries({ queryKey: QK });
  }, [qc, t, toast]);

  async function confirmFlow() {
    if (!flow || !token.trim() || confirming) return;
    setConfirming(true);
    try {
      await flow.confirm(token.trim());
      setFlow(null);
      setToken("");
      toast.success(t("paymentMethods.registered"));
      invalidate();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setConfirming(false);
    }
  }

  const selectDisabled = setDefault.isPending;

  return (
    <div className="screen pm">
      <DetailHeader title={t("paymentMethods.title")} />

      <div className="pm__scroll">
        {q.isLoading ? (
          <div className="pm__section"><SkeletonList rows={3} height={64} /></div>
        ) : q.isError ? (
          <div className="pm__state">
            <span>{t("paymentMethods.loadError")}</span>
            <button className="pm__retry" onClick={() => q.refetch()}>{t("common.retry")}</button>
          </div>
        ) : (
          <>
            {/* --- Failed automatic payment recovery notice --- */}
            {showNotice && recovery && (
              <section className="pm__notice-fail" role="alert" aria-label={t("paymentMethods.failNoticeA11y")}>
                <div className="pm__notice-fail-head">
                  <WarnTriangle />
                  <span className="pm__notice-fail-title">{t("paymentMethods.failNoticeTitle")}</span>
                </div>
                <p className="pm__notice-fail-desc">
                  {t(noticeReasonKey(recovery.failure_class))} {t(NOTICE_GUIDANCE_KEY)}
                </p>
                {formatRetryAt(recovery.next_automatic_retry_at, language, t) && (
                  <p className="pm__notice-fail-retry">
                    {t("paymentMethods.nextRetry", {
                      date: formatRetryAt(recovery.next_automatic_retry_at, language, t),
                    })}
                  </p>
                )}
                {retryBlockedText && (
                  <p className="pm__notice-fail-blocked" role="status">{retryBlockedText}</p>
                )}
                <button
                  ref={retryBtnRef}
                  className="pm__pay-now"
                  onClick={doRetry}
                  disabled={!canRetryNow || retry.isPending || setDefault.isPending}
                  aria-label={t("paymentMethods.payNowA11y")}
                  aria-busy={retry.isPending}
                >
                  {retry.isPending ? (
                    <>
                      <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                      {t("paymentMethods.paying")}
                    </>
                  ) : (
                    t("paymentMethods.payNow")
                  )}
                </button>
              </section>
            )}

            {/* --- Credit / debit cards --- */}
            <section className="pm__section" aria-label={t("paymentMethods.cardsSection")} ref={cardsRef}>
              <h2 className="pm__section-title">{t("paymentMethods.cardsSection")}</h2>
              <ul className="pm__list" role="list">
                {cards.map((m) => {
                  const tag = methodTag(m);
                  const locked = currencyLocked(m);
                  const name = tag ? `${m.display_name} ${tag}` : m.display_name;
                  return (
                  <li key={m.method_id}>
                    <div
                      className={`pm__row ${locked ? "pm__row--locked" : ""}`}
                      role="button"
                      tabIndex={0}
                      aria-pressed={m.is_default}
                      aria-disabled={locked || undefined}
                      aria-label={
                        locked
                          ? t("paymentMethods.currencyLockedA11y", { name })
                          : t("paymentMethods.defaultMethodA11y", {
                              name,
                              state: t(m.is_default ? "paymentMethods.selected" : "paymentMethods.notSelected"),
                            })
                      }
                      onClick={() => selectPrimary(m)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectPrimary(m); } }}
                    >
                      <Radio checked={m.is_default} />
                      <CardGlyph />
                      <div className="pm__row-main">
                        {/* 1332:22003 sets the name and the masked digits as one
                            run — no space before the parenthesis. */}
                        <span className="pm__row-name">{cardName(m)}</span>
                        {m.masked_card_number && <span className="pm__row-masked">({m.masked_card_number})</span>}
                        {/* Region + the only currency it can be charged in, so
                            two cards of the same issuer stay distinguishable. */}
                        {tag && <span className={`pm__row-tag ${m.card_region === "international" ? "is-intl" : ""}`}>{tag}</span>}
                      </div>
                      <button
                        className="pm__del"
                        aria-label={t("paymentMethods.deleteA11y", { name: m.display_name })}
                        onClick={(e) => { e.stopPropagation(); setRemoveTarget(m); }}
                      >
                        <Trash />
                      </button>
                    </div>
                  </li>
                  );
                })}
              </ul>

              {/* Two distinct flows, chosen by where the card was issued:
                  Korean → Toss's window (KRW); overseas → our own form. */}
              <p className="pm__card-hint">{t("paymentMethods.cardChoiceHint")}</p>
              <button className="pm__add" onClick={startDomesticCard} disabled={!!starting || retry.isPending} aria-label={t("paymentMethods.addDomesticA11y")}>
                <Plus />
                <span className="pm__add-text">
                  <span className="pm__add-label">{t("paymentMethods.addDomestic")}</span>
                  <span className="pm__add-sub">{t("paymentMethods.addDomesticSub")}</span>
                </span>
              </button>
              <button className="pm__add" onClick={() => setIntlOpen(true)} disabled={!!starting || retry.isPending} aria-label={t("paymentMethods.addInternationalA11y")}>
                <Plus />
                <span className="pm__add-text">
                  <span className="pm__add-label">{t("paymentMethods.addInternational")}</span>
                  <span className="pm__add-sub">{t("paymentMethods.addInternationalSub")}</span>
                </span>
              </button>
            </section>

            {/* --- Easy payment --- */}
            <section className="pm__section" aria-label={t("paymentMethods.easyPaySection")}>
              <h2 className="pm__section-title">{t("paymentMethods.easyPaySection")}</h2>
              <ul className="pm__list pm__list--ez" role="list">
                {EASY_PAY.filter(
                  // Not-launched wallets (lib/launch.ts) are never offered; one
                  // already on file still shows, so it can be seen and removed.
                  ({ provider }) => isPayLaunched(provider) || methods.some((m) => m.provider === provider),
                ).map(({ provider, labelKey, Logo }) => {
                  const connected = methods.find((m) => m.provider === provider);
                  const connect = provider === "toss_pay" ? startTossPay : startNaverPay;
                  return (
                    <li key={provider}>
                      {connected ? (
                        <div
                          className={`pm__row pm__ez ${currencyLocked(connected) ? "pm__row--locked" : ""}`}
                          role="button"
                          tabIndex={0}
                          aria-pressed={connected.is_default}
                          aria-disabled={currencyLocked(connected) || undefined}
                          aria-label={t("paymentMethods.defaultMethodA11y", {
                            name: t(labelKey),
                            state: t(connected.is_default ? "paymentMethods.selected" : "paymentMethods.notSelected"),
                          })}
                          onClick={() => selectPrimary(connected)}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectPrimary(connected); } }}
                        >
                          <Radio checked={connected.is_default} />
                          <div className="pm__row-main pm__row-main--logo"><Logo /></div>
                          <button
                            className="pm__del"
                            aria-label={t("paymentMethods.disconnectA11y", { name: t(labelKey) })}
                            onClick={(e) => { e.stopPropagation(); setRemoveTarget(connected); }}
                          >
                            <Trash />
                          </button>
                        </div>
                      ) : (
                        <div className="pm__row pm__row--connect pm__ez">
                          <div className="pm__row-main pm__row-main--logo"><Logo /></div>
                          <button className="pm__connect" onClick={connect} disabled={!!starting || retry.isPending} aria-label={t("paymentMethods.connectA11y", { name: t(labelKey) })}>
                            {t("paymentMethods.connect")}
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* --- Notice --- */}
            <section className="pm__notice" aria-label={t("paymentMethods.noticeSection")}>
              <h2 className="pm__notice-title">{t("paymentMethods.noticeSection")}</h2>
              <ul className="pm__notice-body">
                <li>{t("paymentMethods.notice1")}</li>
                <li>{t("paymentMethods.notice2")}</li>
                <li>{t("paymentMethods.notice3")}</li>
                <li>{t("paymentMethods.notice4")}</li>
              </ul>
            </section>
          </>
        )}
      </div>

      {/* --- registration / connection sheet --- */}
      <Sheet open={!!flow} onClose={() => !confirming && setFlow(null)} title={flow?.title}>
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          {t("paymentMethods.flowHint")}
        </p>
        {flow?.authorizeUrl && (
          // Same tab: the window returns to this page, which finishes the
          // registration from the saved intent (sessionStorage is per tab).
          <a className="btn btn--secondary btn--block" href={flow.authorizeUrl} rel="noreferrer" style={{ marginBottom: 12 }}>
            {t("paymentMethods.openPaymentWindow")}
          </a>
        )}
        <TextField label={t("paymentMethods.authValueLabel")} placeholder={flow?.placeholder} value={token} onChange={(e) => setToken(e.target.value)} />
        <div style={{ height: 12 }} />
        <Button block loading={confirming} disabled={!token.trim()} onClick={confirmFlow}>{t("paymentMethods.registerDone")}</Button>
      </Sheet>

      {/* --- overseas-issued card: the app's own form --- */}
      <InternationalCardSheet
        open={intlOpen}
        onClose={closeIntl}
        preferredCurrency={preferredCurrency}
        onRegistered={intlRegistered}
      />

      {/* --- deletion / disconnect confirmation --- */}
      <Dialog
        open={!!removeTarget}
        onClose={remove.isPending ? undefined : () => setRemoveTarget(null)}
        title={t("paymentMethods.deleteTitle")}
        text={t("paymentMethods.deleteText")}
      >
        <div className="pm__modal-actions">
          <button className="pm__modal-btn pm__modal-btn--cancel" disabled={remove.isPending} onClick={() => setRemoveTarget(null)}>
            {t("common.cancel")}
          </button>
          <button className="pm__modal-btn pm__modal-btn--delete" disabled={remove.isPending} onClick={() => removeTarget && remove.mutate(removeTarget)}>
            {t("paymentMethods.delete")}
          </button>
        </div>
      </Dialog>

      {resultModal?.kind === "success" && (
        <PaymentResultModal variant="success" planName={recovery?.plan_name} onConfirm={confirmSuccess} />
      )}
      {resultModal?.kind === "failure" && (
        <PaymentResultModal variant="failure" failureClass={resultModal.failureClass} onConfirm={closeFailure} />
      )}

      {(selectDisabled || retry.isPending) && (
        <span className="pm__sr" role="status">{t(retry.isPending ? "paymentMethods.retryingStatus" : "paymentMethods.changingDefaultStatus")}</span>
      )}
    </div>
  );
}
