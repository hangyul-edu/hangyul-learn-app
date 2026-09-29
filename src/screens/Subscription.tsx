import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation, type TranslationKey } from "../i18n";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sheet, ConfirmDialog } from "../components/ui/Modal";
import { Button } from "../components/ui/kit";
import { SkeletonList } from "../components/ui/states";
import { VoucherModal } from "../components/VoucherModal";
import { VoucherSuccessModal, type VoucherSuccess } from "../components/VoucherSuccessModal";
import { FailModal } from "../components/FailModal";
import { subApi, billingApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { ApiError, errorMessage } from "../lib/http";
import { paymentErrorMessage } from "../lib/paymentErrors";
import { formatMoney, formatLongDate } from "../lib/format";
import type { Invoice, MySubscription, Plan } from "../lib/types";
import { CancelReasonModal } from "../components/CancelReasonModal";
import { DetailHeader } from "../components/DetailHeader";

/* ---------------- date helpers (locale ko-KR, timezone-safe) ---------------- */
function fmtShort(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const yy = String(d.getFullYear()).slice(2);
  return `${yy}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}
function fmtSlash(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}
function fmtDot(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}
/** Read the first present string field from an unknown response object. */
function str(o: unknown, ...keys: string[]): string | null {
  if (!o || typeof o !== "object") return null;
  for (const k of keys) {
    const v = (o as Record<string, unknown>)[k];
    if (typeof v === "string" && v) return v;
  }
  return null;
}
/**
 * Build the applied-subscription detail from the redemption response + refreshed
 * sub. `t` is passed in because this runs outside the component tree.
 */
function buildSuccess(
  applyRes: unknown,
  fresh: MySubscription,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
): VoucherSuccess {
  const plan = str(applyRes, "plan_name") ?? fresh.plan_name ?? t("subscription.planFallback");
  const from = str(applyRes, "current_period_start", "valid_from", "starts_at", "start_at");
  const to =
    str(applyRes, "current_period_end", "valid_until", "ends_at", "end_at") ?? fresh.current_period_end ?? null;
  const scheduled =
    !!applyRes &&
    typeof applyRes === "object" &&
    (!!(applyRes as Record<string, unknown>).scheduled || !!(applyRes as Record<string, unknown>).applies_at);
  const validity = from && to ? `${fmtDot(from)}~${fmtDot(to)}` : to ? `~${fmtDot(to)}` : "-";
  return {
    subtitle: t(scheduled ? "subscription.voucherScheduled" : "subscription.voucherApplied", { plan }),
    plan,
    type: t("subscription.voucherType"),
    validity,
  };
}

export function Subscription() {
  const { t, language } = useTranslation();
  const nav = useNavigate();
  const loc = useLocation();
  const toast = useToast();
  const qc = useQueryClient();
  /** Bound to the active language so dates re-render when it changes. */
  const longDate = (iso?: string | null) => formatLongDate(iso, language);

  // Arriving from the More card's 구독하기 CTA opens plan selection straight away.
  const [planOpen, setPlanOpen] = useState(() => !!(loc.state as { openPlans?: boolean } | null)?.openPlans);
  const [voucherOpen, setVoucherOpen] = useState(false);
  const [voucherCode, setVoucherCode] = useState(""); // controlled; survives the fail-modal swap
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [couponFailOpen, setCouponFailOpen] = useState(false);
  const [voucherSuccess, setVoucherSuccess] = useState<VoucherSuccess | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const mine = useQuery({ queryKey: ["sub-me"], queryFn: subApi.mine });
  const plans = useQuery({ queryKey: ["sub-plans"], queryFn: subApi.plans, enabled: planOpen });
  const planList: Plan[] = plans.data?.plans ?? plans.data?.items ?? [];

  // Payment history — cursor-based infinite scroll (billingApi.invoices → next_cursor).
  const inv = useInfiniteQuery({
    queryKey: ["invoices-inf"],
    queryFn: ({ pageParam }) => billingApi.invoices(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
  const rows = useMemo(() => {
    const seen = new Set<string>();
    const out: Invoice[] = [];
    for (const page of inv.data?.pages ?? [])
      for (const it of page.invoices ?? [])
        if (!seen.has(it.invoice_id)) {
          seen.add(it.invoice_id);
          out.push(it);
        }
    return out;
  }, [inv.data]);

  // Load the next page when the sentinel nears the viewport (single flight).
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && inv.hasNextPage && !inv.isFetchingNextPage) inv.fetchNextPage();
      },
      { rootMargin: "240px" },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [inv.hasNextPage, inv.isFetchingNextPage, inv.fetchNextPage]);

  function refresh() {
    qc.invalidateQueries({ queryKey: ["sub-me"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["invoices-inf"] });
  }

  async function subscribe(p: Plan, trial: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      if (trial) {
        await subApi.startTrial(p.plan_id);
        toast.success(t("subscription.trialStarted"));
      } else {
        const res = await subApi.subscribe(p.plan_id);
        if (res?.subscription?.status === "payment_pending") toast.show(t("subscription.subPending"));
        else toast.success(t("subscription.subStarted"));
      }
      setPlanOpen(false);
      refresh();
    } catch (e) {
      // subscription.currency_mismatch: the card is charged in another currency.
      toast.error(paymentErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  // Redemption is server-authoritative: validate then apply. Entitlement is never
  // updated locally — refresh() re-reads /subscriptions/me on success. The server
  // enforces validity, eligibility, immediate-vs-scheduled application, one-time use.
  // A code-domain rejection (4xx: invalid / expired / already used) shows the
  // dedicated failure modal; a temporary failure (network / 5xx / unknown) stays
  // inline in the voucher modal via the generic error line.
  async function redeem(code: string) {
    if (busy) return;
    setBusy(true);
    setVoucherError(null);
    try {
      await subApi.validateCoupon(code);
      const applyRes = await subApi.applyCoupon(code);
      // Authoritative refresh: re-read /subscriptions/me for the applied state,
      // seed the cache so the screen already reflects it, invalidate related data.
      const fresh = await subApi.mine();
      qc.setQueryData(["sub-me"], fresh);
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["invoices-inf"] });
      setVoucherOpen(false);
      setVoucherSuccess(buildSuccess(applyRes, fresh, t)); // → success modal
    } catch (e) {
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
        // Code-domain rejection — replace the input modal with the failure modal
        // (code preserved for edit-and-retry). No entitlement change.
        setVoucherOpen(false);
        setCouponFailOpen(true);
      } else {
        setVoucherError(errorMessage(e)); // temporary — keep modal open, allow retry
      }
    } finally {
      setBusy(false);
    }
  }

  // MOR-011's 해지 does not cancel yet — it hands over to the optional
  // reason step (MOR-012). Both of that step's buttons finish the cancellation;
  // only the reason sent with it differs.
  function toReasonStep() {
    setCancelOpen(false);
    setReasonOpen(true);
  }

  async function doCancel(reason?: string) {
    setBusy(true);
    try {
      await subApi.cancel(reason);
      toast.success(t("subscription.cancelScheduled"));
      setReasonOpen(false);
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function doResume() {
    if (busy) return;
    setBusy(true);
    try {
      await subApi.resume();
      toast.success(t("subscription.resumed"));
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  // --- Subscription state mapping (authoritative from /subscriptions/me) ---
  const m = mine.data;
  const status = m?.status ?? "";
  const hasSub = !!m && (m.is_premium || ["trial", "active", "cancelled", "grace_period"].includes(status));
  const scheduledCancel = !!m?.cancel_at_period_end;
  const planName = m?.plan_name ?? t("subscription.planFallback");
  const endIso = m?.current_period_end;
  const endDate = longDate(endIso);

  return (
    <div className="screen subm">
      <div className="subm__scroll">
        <DetailHeader title={t("subscription.title")} />
        <div className="subm__top">

          <h2 className="subm__h">{t("subscription.myPlanHeading")}</h2>

          {mine.isLoading ? (
            <SkeletonList rows={1} height={90} />
          ) : mine.isError ? (
            <div className="subm__err">
              <span>{t("subscription.loadError")}</span>
              <button className="subm__retry" onClick={() => mine.refetch()}>{t("common.retry")}</button>
            </div>
          ) : hasSub ? (
            <div className="subm__sub">
              <div className="subm__srow">
                <span className="subm__label">{t("subscription.planLabel")}</span>
                <span className="subm__value">{planName}</span>
              </div>
              {endDate && (
                <div className="subm__srow">
                  {/* MOR-014 keeps the 다음 결제일 label in the cancelling state
                      too and adds a 구독 상태 row underneath. */}
                  <span className="subm__label">{t("subscription.nextBilling")}</span>
                  <span className="subm__value">{endDate}</span>
                </div>
              )}
              {scheduledCancel && (
                <div className="subm__srow">
                  <span className="subm__label">{t("subscription.statusLabel")}</span>
                  <span className="subm__value">{t("subscription.statusCanceling")}</span>
                </div>
              )}
              {/* `trial_ending` is a trial in its last 72h — exactly when a
                  member most wants to cancel before the first charge. */}
              {!scheduledCancel && ["trial", "trial_ending", "active"].includes(status) && (
                <button className="subm__cancel" onClick={() => setCancelOpen(true)}>{t("subscription.cancel")}</button>
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
              <button className="subm__cnotice-btn" onClick={doResume} disabled={busy}>
                {t("subscription.resume")}
              </button>
            </div>
          )}

          {/* Course-access / voucher code */}
          <div className="subm__voucher">
            <span className="subm__voucher-label">{t("subscription.voucherLabel")}</span>
            <button
              className="subm__voucher-btn"
              onClick={() => {
                setVoucherCode(""); // fresh entry
                setVoucherError(null);
                setVoucherOpen(true);
              }}
            >
              {t("subscription.register")}
            </button>
          </div>
        </div>

        {/* Payment information (cool-gray region to the bottom) */}
        <div className="subm__pay">
          <h2 className="subm__h">{t("subscription.billingHeading")}</h2>

          {inv.isLoading ? (
            <SkeletonList rows={4} height={58} />
          ) : inv.isError && rows.length === 0 ? (
            <div className="subm__err">
              <span>{t("subscription.billingLoadError")}</span>
              <button className="subm__retry" onClick={() => inv.refetch()}>{t("common.retry")}</button>
            </div>
          ) : rows.length === 0 ? (
            <p className="subm__empty-pay">{t("subscription.noBilling")}</p>
          ) : (
            <>
              {/* 624:9871 — the date/description pair sits in its own group, 71
                  from the amount, mirroring the row layout below. */}
              <div className="subm__thead" role="row" aria-hidden="true">
                <span className="subm__thgroup">
                  <span className="subm__th">{t("subscription.colDate")}</span>
                  <span className="subm__th subm__th--desc">{t("subscription.colDescription")}</span>
                </span>
                <span className="subm__th subm__th--amt">{t("subscription.colAmount")}</span>
              </div>
              <ul className="subm__plist" role="list">
                {rows.map((r) => (
                  <li
                    key={r.invoice_id}
                    className="subm__prow"
                    aria-label={t("subscription.invoiceA11y", {
                      date: longDate(r.paid_at ?? r.period_start),
                      plan: r.plan_name,
                      from: longDate(r.period_start),
                      to: longDate(r.period_end),
                      amount: formatMoney(r.total.amount_cents, r.total.currency),
                    })}
                  >
                    {/* 624:9876 — date + description are one group 19 apart; the
                        amount trails it by 66, not flushed to the right edge. */}
                    <div className="subm__pmain">
                      <span className="subm__pdate">{fmtShort(r.paid_at ?? r.period_start)}</span>
                      <div className="subm__pdesc">
                        <div className="subm__pname">{r.plan_name}</div>
                        <div className="subm__pperiod">
                          {fmtSlash(r.period_start)}
                          <br />- {fmtSlash(r.period_end)}
                        </div>
                      </div>
                    </div>
                    <span className="subm__pamt">{formatMoney(r.total.amount_cents, r.total.currency)}</span>
                  </li>
                ))}
              </ul>

              <div className="subm__foot" ref={sentinel}>
                {inv.isFetchingNextPage ? (
                  <span className="spinner" style={{ width: 22, height: 22, borderWidth: 2.5 }} />
                ) : inv.isFetchNextPageError ? (
                  <button className="subm__retry" onClick={() => inv.fetchNextPage()}>{t("subscription.loadMore")}</button>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Plan selection (reuses subApi.subscribe / startTrial) */}
      <Sheet open={planOpen} onClose={() => !busy && setPlanOpen(false)} title={t("subscription.planSheetTitle")}>
        {plans.isLoading ? (
          <SkeletonList rows={2} height={72} />
        ) : planList.length === 0 ? (
          <p className="subm__empty-pay">{t("subscription.noPlansAvailable")}</p>
        ) : (
          <div className="stack" style={{ gap: 10 }}>
            {planList.map((p) => (
              <div key={p.plan_id} className="subm__plan">
                <div style={{ flex: 1 }}>
                  <div className="subm__plan-name">{p.name}</div>
                  <div className="subm__plan-sub">
                    {formatMoney(p.price_cents, p.currency || "KRW")} / {t(p.interval === "year" ? "subscription.perYear" : "subscription.perMonth")}
                    {p.trial_days ? t("subscription.trialDaysFree", { n: p.trial_days }) : ""}
                  </div>
                </div>
                <Button size="sm" loading={busy} onClick={() => subscribe(p, !!p.trial_days)}>
                  {t(p.trial_days ? "subscription.startTrial" : "subscription.subscribeShort")}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Sheet>

      {/* Voucher / course-code registration (reuses subApi.validateCoupon / applyCoupon) */}
      <VoucherModal
        open={voucherOpen}
        loading={busy}
        error={voucherError}
        code={voucherCode}
        onCodeChange={setVoucherCode}
        onClose={() => {
          if (busy) return;
          setVoucherOpen(false);
          setVoucherError(null);
        }}
        onSubmit={redeem}
      />

      {/* Code-domain failure. 확인 returns to the input modal with the code
          preserved for edit-and-retry; no API, no entitlement change. */}
      <FailModal
        open={couponFailOpen}
        title={t("subscription.voucherFailTitle")}
        description={
          <>
            {t("subscription.invalidCode")}
            <br />
            {t("subscription.invalidCodeSub")}
          </>
        }
        onClose={() => {
          setCouponFailOpen(false);
          setVoucherOpen(true); // reopen with preserved code
        }}
      />

      <VoucherSuccessModal open={!!voucherSuccess} data={voucherSuccess} onClose={() => setVoucherSuccess(null)} />

      {/* MOR-011 (624:10155) — no badge; the first body line is Brand 1 and the
          rest Gray 5, and the dismiss button reads 취소 / Keep Plan. */}
      <ConfirmDialog
        open={cancelOpen}
        title={t("subscription.cancelConfirmTitle")}
        warn={t("subscription.cancelConfirmText")}
        text={t("subscription.cancelConfirmText2")}
        cancelLabel={t("subscription.cancelConfirmKeep")}
        confirmLabel={t("subscription.cancelConfirmGo")}
        loading={busy}
        onCancel={() => setCancelOpen(false)}
        onConfirm={toReasonStep}
      />

      <CancelReasonModal
        open={reasonOpen}
        loading={busy}
        onSkip={() => !busy && void doCancel()}
        onSubmit={(reason) => void doCancel(reason)}
      />
    </div>
  );
}
