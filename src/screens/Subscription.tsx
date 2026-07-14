import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sheet, Dialog, ConfirmDialog } from "../components/ui/Modal";
import { Button } from "../components/ui/kit";
import { TextField } from "../components/ui/Field";
import { SkeletonList } from "../components/ui/states";
import { subApi, billingApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import { formatMoney } from "../lib/format";
import type { Invoice, Plan } from "../lib/types";

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

export function Subscription() {
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();

  const [planOpen, setPlanOpen] = useState(false);
  const [voucherOpen, setVoucherOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [code, setCode] = useState("");
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

  async function redeem() {
    if (!code.trim() || busy) return;
    setBusy(true);
    try {
      await subApi.validateCoupon(code.trim());
      await subApi.applyCoupon(code.trim());
      toast.success("수강권을 등록했어요! 🎁");
      setCode("");
      setVoucherOpen(false);
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
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
            <button className="subm__voucher-btn" onClick={() => setVoucherOpen(true)}>등록하기</button>
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
      <Dialog open={voucherOpen} onClose={() => !busy && setVoucherOpen(false)} emoji="🎁" title="수강권 코드 등록" text="발급받은 코드를 입력해 주세요.">
        <div className="stack" style={{ gap: 10 }}>
          <TextField placeholder="XXXX-XXXX-XXXX" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <Button block loading={busy} disabled={!code.trim()} onClick={redeem}>등록하기</Button>
          <Button variant="ghost" block disabled={busy} onClick={() => setVoucherOpen(false)}>취소</Button>
        </div>
      </Dialog>

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
