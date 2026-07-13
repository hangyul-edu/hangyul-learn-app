import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Screen } from "../components/layout/Screen";
import { Button, Card } from "../components/ui/kit";
import { ConfirmDialog } from "../components/ui/Modal";
import { TextField } from "../components/ui/Field";
import { Async, SkeletonList } from "../components/ui/states";
import { subApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import { formatMoney } from "../lib/format";
import type { Plan } from "../lib/types";

const STATUS_LABEL: Record<string, { t: string; tone: string }> = {
  trial: { t: "무료 체험 중", tone: "success" },
  active: { t: "이용 중", tone: "success" },
  cancelled: { t: "해지 예정", tone: "danger" },
  expired: { t: "만료됨", tone: "danger" },
  grace_period: { t: "결제 유예", tone: "danger" },
};

export function Subscription() {
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [coupon, setCoupon] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const mine = useQuery({ queryKey: ["sub-me"], queryFn: subApi.mine });
  const plans = useQuery({ queryKey: ["plans"], queryFn: subApi.plans });
  const planList: Plan[] = plans.data?.plans ?? plans.data?.items ?? [];
  const isPremium = mine.data?.is_premium || ["trial", "active"].includes(mine.data?.status ?? "");

  function refresh() {
    qc.invalidateQueries({ queryKey: ["sub-me"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  async function subscribe(plan: Plan, trial: boolean) {
    setBusy(true);
    try {
      if (trial) await subApi.startTrial(plan.plan_id);
      else await subApi.subscribe(plan.plan_id);
      toast.success(trial ? "무료 체험을 시작했어요! 🎉" : "구독을 시작했어요! 🎉");
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function applyCoupon() {
    if (!coupon.trim()) return;
    setCouponBusy(true);
    try {
      await subApi.validateCoupon(coupon.trim());
      await subApi.applyCoupon(coupon.trim());
      toast.success("쿠폰을 적용했어요! 🎁");
      setCoupon("");
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setCouponBusy(false);
    }
  }

  return (
    <Screen title="멤버십" back>
      <Async loading={mine.isLoading} error={mine.error} data={mine.data} onRetry={() => mine.refetch()} skeleton={<SkeletonList rows={1} height={90} />}>
        {(m) => {
          const st = STATUS_LABEL[m.status] ?? { t: "무료 플랜", tone: "" };
          return (
            <Card variant={isPremium ? "brand" : "soft"} padLg style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 30 }}>{isPremium ? "👑" : "✨"}</div>
              <div style={{ fontWeight: 900, fontSize: 20, marginTop: 6 }}>{isPremium ? m.plan_name ?? "프리미엄" : "무료 플랜"}</div>
              <div style={{ opacity: 0.9, fontSize: 13, marginTop: 2 }}>{st.t}</div>
              {m.current_period_end && <div style={{ opacity: 0.85, fontSize: 12, marginTop: 6 }}>~ {new Date(m.current_period_end).toLocaleDateString("ko-KR")}</div>}
              {["trial", "active"].includes(m.status) && !m.cancel_at_period_end && (
                <Button variant="ghost" size="sm" style={{ marginTop: 12, background: "rgba(255,255,255,.2)", color: "#fff" }} onClick={() => setCancelOpen(true)}>
                  구독 해지
                </Button>
              )}
              {m.cancel_at_period_end && (
                <Button variant="ghost" size="sm" style={{ marginTop: 12 }} loading={busy} onClick={async () => { setBusy(true); try { await subApi.resume(); toast.success("구독을 다시 시작했어요"); refresh(); } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); } }}>
                  해지 취소
                </Button>
              )}
            </Card>
          );
        }}
      </Async>

      {!isPremium && (
        <>
          <div className="section-title">프리미엄으로 업그레이드</div>
          <div className="card card--flat" style={{ background: "var(--surface-2)", marginBottom: 12 }}>
            <div className="stack" style={{ gap: 8, fontSize: 13.5 }}>
              <div className="row" style={{ gap: 8 }}><span>✓</span> 하루 목표 무제한 (5개 → 40개)</div>
              <div className="row" style={{ gap: 8 }}><span>✓</span> AI 튜터 무제한 대화</div>
              <div className="row" style={{ gap: 8 }}><span>✓</span> 모든 강의와 추천 문장</div>
            </div>
          </div>
          <Async loading={plans.isLoading} error={plans.error} data={plans.data} onRetry={() => plans.refetch()} skeleton={<SkeletonList rows={2} height={80} />}>
            {() => (
              <div className="stack" style={{ gap: 10 }}>
                {planList.map((p) => (
                  <Card key={p.plan_id} className="row">
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800 }}>{p.name}</div>
                      <div className="muted" style={{ fontSize: 13 }}>
                        {formatMoney(p.price_cents, p.currency || "KRW")} / {p.interval === "year" ? "년" : "월"}
                        {p.trial_days ? ` · ${p.trial_days}일 무료` : ""}
                      </div>
                    </div>
                    {p.trial_days ? (
                      <Button size="sm" loading={busy} onClick={() => subscribe(p, true)}>체험 시작</Button>
                    ) : (
                      <Button size="sm" loading={busy} onClick={() => subscribe(p, false)}>구독</Button>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </Async>
        </>
      )}

      <div className="section-title" style={{ marginTop: 22 }}>🎁 쿠폰 등록</div>
      <div style={{ display: "flex", gap: 8 }}>
        <TextField placeholder="XXXX-XXXX-XXXX" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} />
        <Button style={{ height: 50 }} loading={couponBusy} disabled={!coupon.trim()} onClick={applyCoupon}>등록</Button>
      </div>

      <div className="stack" style={{ gap: 8, marginTop: 22 }}>
        <button className="listrow" onClick={() => nav("/account/payment")}>
          <span style={{ fontSize: 20 }}>💳</span>
          <div className="listrow__main"><div className="listrow__title">결제 수단 관리</div></div>
          <span className="listrow__chev">›</span>
        </button>
        <button className="listrow" onClick={() => nav("/account/billing")}>
          <span style={{ fontSize: 20 }}>🧾</span>
          <div className="listrow__main"><div className="listrow__title">결제 내역</div></div>
          <span className="listrow__chev">›</span>
        </button>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        emoji="😢"
        title="구독을 해지할까요?"
        text="남은 기간까지는 계속 이용할 수 있어요."
        confirmLabel="해지하기"
        danger
        loading={busy}
        onCancel={() => setCancelOpen(false)}
        onConfirm={async () => { setBusy(true); try { await subApi.cancel(); toast.success("해지 예약되었어요"); refresh(); setCancelOpen(false); } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); } }}
      />
    </Screen>
  );
}
