import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
import { formatMoney } from "../lib/format";
import type { Invoice, MySubscription, Plan } from "../lib/types";

/* ---------------- date helpers (locale ko-KR, timezone-safe) ---------------- */
function fmtLong(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}
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
/** Build the applied-subscription detail from the redemption response + refreshed sub. */
function buildSuccess(applyRes: unknown, fresh: MySubscription): VoucherSuccess {
  const plan = str(applyRes, "plan_name") ?? fresh.plan_name ?? "프리미엄";
  const from = str(applyRes, "current_period_start", "valid_from", "starts_at", "start_at");
  const to =
    str(applyRes, "current_period_end", "valid_until", "ends_at", "end_at") ?? fresh.current_period_end ?? null;
  const scheduled =
    !!applyRes &&
    typeof applyRes === "object" &&
    (!!(applyRes as Record<string, unknown>).scheduled || !!(applyRes as Record<string, unknown>).applies_at);
  const validity = from && to ? `${fmtDot(from)}~${fmtDot(to)}` : to ? `~${fmtDot(to)}` : "-";
  return {
    subtitle: scheduled ? `${plan} 구독이 예약되었어요` : `${plan} 구독이 적용되었어요`,
    plan,
    type: "수강권 쿠폰 적용",
    validity,
  };
}

export function Subscription() {
  const nav = useNavigate();
  const loc = useLocation();
  const toast = useToast();
  const qc = useQueryClient();

  // Arriving from the More card's 구독하기 CTA opens plan selection straight away.
  const [planOpen, setPlanOpen] = useState(() => !!(loc.state as { openPlans?: boolean } | null)?.openPlans);
  const [voucherOpen, setVoucherOpen] = useState(false);
  const [voucherCode, setVoucherCode] = useState(""); // controlled; survives the fail-modal swap
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [couponFailOpen, setCouponFailOpen] = useState(false);
  const [voucherSuccess, setVoucherSuccess] = useState<VoucherSuccess | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const mine = useQuery({ queryKey: ["sub-me"], queryFn: subApi.mine });
  const plans = useQuery({ queryKey: ["plans"], queryFn: subApi.plans, enabled: planOpen });
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
      if (trial) await subApi.startTrial(p.plan_id);
      else await subApi.subscribe(p.plan_id);
      toast.success(trial ? "무료 체험을 시작했어요! 🎉" : "구독을 시작했어요! 🎉");
      setPlanOpen(false);
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
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
      setVoucherSuccess(buildSuccess(applyRes, fresh)); // → success modal
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

  async function doCancel() {
    setBusy(true);
    try {
      await subApi.cancel();
      toast.success("해지 예약되었어요");
      setCancelOpen(false);
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
      toast.success("구독을 다시 시작했어요");
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
  const isTrial = status === "trial";
  const planName = m?.plan_name ?? "프리미엄";
  const endIso = isTrial ? m?.trial_end ?? m?.current_period_end : m?.current_period_end;
  const endDate = fmtLong(endIso);

  return (
    <div className="screen subm">
      <div className="subm__scroll">
        <div className="subm__top">
          <header className="acct__header">
            <button className="acct__back" onClick={() => nav(-1)} aria-label="뒤로">
              <svg width="27" height="27" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <h1 className="acct__title">구독 관리</h1>
          </header>

          <h2 className="subm__h">내 구독정보</h2>

          {mine.isLoading ? (
            <SkeletonList rows={1} height={90} />
          ) : mine.isError ? (
            <div className="subm__err">
              <span>구독 정보를 불러오지 못했어요.</span>
              <button className="subm__retry" onClick={() => mine.refetch()}>다시 시도</button>
            </div>
          ) : hasSub ? (
            <div className="subm__sub">
              <div className="subm__srow">
                <span className="subm__label">이용 구독 플랜</span>
                <span className="subm__value">{planName}</span>
              </div>
              {endDate && (
                <div className="subm__srow">
                  <span className="subm__label">{scheduledCancel ? "이용 종료일" : "다음 결제일"}</span>
                  <span className="subm__value">{endDate}</span>
                </div>
              )}
              {scheduledCancel ? (
                <button className="subm__cancel" onClick={doResume} disabled={busy}>구독 다시 시작하기</button>
              ) : (
                ["trial", "active"].includes(status) && (
                  <button className="subm__cancel" onClick={() => setCancelOpen(true)}>해지하기</button>
                )
              )}
            </div>
          ) : (
            <div className="subm__nosub">
              <div className="subm__nosub-text">
                <p className="subm__nosub-1">현재 구독 중인 플랜이 없습니다</p>
                <p className="subm__nosub-2">지금 구독하고 모든 학습을 자유롭게 이용하세요</p>
              </div>
              <button className="subm__subscribe" onClick={() => setPlanOpen(true)}>구독하기</button>
            </div>
          )}

          {/* Course-access / voucher code */}
          <div className="subm__voucher">
            <span className="subm__voucher-label">수강권 코드 등록</span>
            <button
              className="subm__voucher-btn"
              onClick={() => {
                setVoucherCode(""); // fresh entry
                setVoucherError(null);
                setVoucherOpen(true);
              }}
            >
              등록하기
            </button>
          </div>
        </div>

        {/* Payment information (cool-gray region to the bottom) */}
        <div className="subm__pay">
          <h2 className="subm__h">결제 정보</h2>

          {inv.isLoading ? (
            <SkeletonList rows={4} height={58} />
          ) : inv.isError && rows.length === 0 ? (
            <div className="subm__err">
              <span>결제 내역을 불러오지 못했어요.</span>
              <button className="subm__retry" onClick={() => inv.refetch()}>다시 시도</button>
            </div>
          ) : rows.length === 0 ? (
            <p className="subm__empty-pay">결제 내역이 없습니다</p>
          ) : (
            <>
              <div className="subm__thead" role="row" aria-hidden="true">
                <span className="subm__th">날짜</span>
                <span className="subm__th">설명/기간</span>
                <span className="subm__th subm__th--amt">결제 금액</span>
              </div>
              <ul className="subm__plist" role="list">
                {rows.map((r) => (
                  <li
                    key={r.invoice_id}
                    className="subm__prow"
                    aria-label={`${fmtLong(r.paid_at ?? r.period_start)}, ${r.plan_name}, 이용 기간 ${fmtLong(r.period_start)}부터 ${fmtLong(r.period_end)}까지, 결제 금액 ${formatMoney(r.total.amount_cents, r.total.currency)}`}
                  >
                    <span className="subm__pdate">{fmtShort(r.paid_at ?? r.period_start)}</span>
                    <div className="subm__pdesc">
                      <div className="subm__pname">{r.plan_name}</div>
                      <div className="subm__pperiod">
                        {fmtSlash(r.period_start)}
                        <br />- {fmtSlash(r.period_end)}
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
                  <button className="subm__retry" onClick={() => inv.fetchNextPage()}>다시 불러오기</button>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Plan selection (reuses subApi.subscribe / startTrial) */}
      <Sheet open={planOpen} onClose={() => !busy && setPlanOpen(false)} title="구독 플랜 선택">
        {plans.isLoading ? (
          <SkeletonList rows={2} height={72} />
        ) : planList.length === 0 ? (
          <p className="subm__empty-pay">이용 가능한 플랜이 없어요.</p>
        ) : (
          <div className="stack" style={{ gap: 10 }}>
            {planList.map((p) => (
              <div key={p.plan_id} className="subm__plan">
                <div style={{ flex: 1 }}>
                  <div className="subm__plan-name">{p.name}</div>
                  <div className="subm__plan-sub">
                    {formatMoney(p.price_cents, p.currency || "KRW")} / {p.interval === "year" ? "년" : "월"}
                    {p.trial_days ? ` · ${p.trial_days}일 무료` : ""}
                  </div>
                </div>
                <Button size="sm" loading={busy} onClick={() => subscribe(p, !!p.trial_days)}>
                  {p.trial_days ? "체험 시작" : "구독"}
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
        title="쿠폰 등록에 실패했습니다"
        description={
          <>
            유효하지 않거나 이미 사용된 코드예요
            <br />
            코드를 확인하고 다시 시도해 주세요
          </>
        }
        onClose={() => {
          setCouponFailOpen(false);
          setVoucherOpen(true); // reopen with preserved code
        }}
      />

      <VoucherSuccessModal open={!!voucherSuccess} data={voucherSuccess} onClose={() => setVoucherSuccess(null)} />

      <ConfirmDialog
        open={cancelOpen}
        emoji="😢"
        title="구독을 해지할까요?"
        text="남은 기간까지는 계속 이용할 수 있어요."
        confirmLabel="해지하기"
        danger
        loading={busy}
        onCancel={() => setCancelOpen(false)}
        onConfirm={doCancel}
      />
    </div>
  );
}
