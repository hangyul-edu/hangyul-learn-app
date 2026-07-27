import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, Sheet } from "../components/ui/Modal";
import { Button } from "../components/ui/kit";
import { TextField } from "../components/ui/Field";
import { SkeletonList } from "../components/ui/states";
import { NaverPayLogo, TossPayLogo } from "../components/brand/PayBrand";
import { billingApi, payApi, type CardRegion } from "../api/endpoints";
import { useAuth } from "../hooks/auth";
import { useToast } from "../hooks/toast";
import { ApiError, errorMessage } from "../lib/http";
import {
  NOTICE_GUIDANCE,
  failureModalCopy,
  formatRetryAt,
  noticeReason,
  successPlanLine,
} from "../lib/paymentRecovery";
import type { MethodProvider, PaymentMethod } from "../lib/types";

const QK = ["payment-methods"] as const;
const RECOVERY_QK = ["payment-recovery"] as const;
const RETURN_URL = () => window.location.origin + "/account/payment";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* --------------------------------- icons -------------------------------- */
const BackChevron = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M15 5l-7 7 7 7" stroke="#272c30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Trash = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M5 7h14M10 7V5.5A1.5 1.5 0 0 1 11.5 4h1A1.5 1.5 0 0 1 14 5.5V7M6.5 7l.8 11a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9L17.5 7" stroke="#aeb7be" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Plus = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);
const CardGlyph = ({ brand }: { brand?: string | null }) => {
  const fill = brand === "visa" ? "#1a1f71" : brand === "mastercard" ? "#eb5c1e" : brand === "amex" ? "#2e77bb" : "#5b6470";
  return (
    <span className="pm__thumb" aria-hidden="true" style={{ background: `linear-gradient(135deg, ${fill} 0%, #2b2019 130%)` }}>
      <svg width="24" height="18" viewBox="0 0 24 18" fill="none">
        <rect x="1" y="1" width="22" height="16" rx="2.5" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.5)" strokeWidth="0.9" />
        <rect x="3" y="5.5" width="5" height="3.5" rx="0.8" fill="#ffd980" />
      </svg>
    </span>
  );
};
const Radio = ({ checked }: { checked: boolean }) => (
  <span className={`pm__radio ${checked ? "is-on" : ""}`} aria-hidden="true">
    {checked && <span className="pm__radio-dot" />}
  </span>
);
const WarnTriangle = ({ size = 20, color = "#f97316" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 3.2l9 15.6H3l9-15.6z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M12 9.5v4.2" stroke={color} strokeWidth="1.9" strokeLinecap="round" />
    <circle cx="12" cy="16.4" r="1.05" fill={color} />
  </svg>
);
const CheckMark = () => (
  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" stroke="#137a3f" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* -------------------------------- helpers ------------------------------- */
// Logo height (px). Both marks share the same height so their icons render at
// the same size (each icon fills its 32-unit-tall viewBox at 1:1), while Toss
// Pay still reads wider via its longer icon+wordmark lockup. Sizing lives here
// (the config), not in the card markup, so each provider stays tunable.
const EASY_PAY: {
  provider: MethodProvider;
  label: string;
  Logo: (p: { height?: number }) => JSX.Element;
  logoHeight: number;
}[] = [
  { provider: "toss_pay", label: "토스페이", Logo: TossPayLogo, logoHeight: 30 },
  { provider: "naver_pay", label: "네이버페이", Logo: NaverPayLogo, logoHeight: 30 },
];

function cardName(m: PaymentMethod): string {
  if (m.issuer) return m.issuer;
  const paren = m.display_name.indexOf("(");
  return paren > 0 ? m.display_name.slice(0, paren).trim() : m.display_name;
}

/* One connection/registration flow driven through the shared Sheet. */
type Flow = {
  title: string;
  authorizeUrl: string;
  placeholder: string;
  confirm: (token: string) => Promise<void>;
};

/* -------------------------------- screen -------------------------------- */
type ResultModal = { kind: "success" } | { kind: "failure"; failureClass?: string | null } | null;

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
    ? [successPlanLine(planName), "이제 모든 학습 콘텐츠를 계속 이용할 수 있어요"]
    : failureModalCopy(failureClass);
  return (
    <div className="overlay overlay--center pm-result-overlay" role="dialog" aria-modal="true" aria-label={success ? "결제 완료" : "결제 실패"}>
      <div className="pm-result" onClick={(e) => e.stopPropagation()}>
        <div className={`pm-result__icon ${success ? "is-ok" : "is-fail"}`}>
          {success ? <CheckMark /> : <WarnTriangle size={30} color="#d84343" />}
        </div>
        <h2 className="pm-result__title">{success ? "결제가 완료됐어요" : "결제에 실패했어요"}</h2>
        <p className="pm-result__desc">{l1}<br />{l2}</p>
        <button ref={btnRef} className="pm-result__btn" onClick={onConfirm} aria-label={success ? "결제 완료 확인" : "다른 결제수단 선택하기"}>
          {success ? "확인" : "다른 결제수단 선택"}
        </button>
      </div>
    </div>
  );
}

export function PaymentMethods() {
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const { bootstrapMe } = useAuth();
  const q = useQuery({ queryKey: QK, queryFn: payApi.methods });
  const recoveryQ = useQuery({ queryKey: RECOVERY_QK, queryFn: billingApi.recovery });
  const methods = q.data?.methods ?? [];
  const cards = methods.filter((m) => m.kind === "card");

  const [removeTarget, setRemoveTarget] = useState<PaymentMethod | null>(null);
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
      toast.error(errorMessage(e));
    },
    onSettled: invalidate,
  });

  function selectPrimary(m: PaymentMethod) {
    // A primary change mid-retry could invalidate the in-flight charge — block it.
    if (m.is_default || setDefault.isPending || retry.isPending) return;
    setDefault.mutate(m.method_id);
  }

  /* --- deletion / disconnect --- */
  const remove = useMutation({
    mutationFn: async (target: PaymentMethod) => {
      // Deleting the primary while other methods remain: hand the primary to a
      // remaining method atomically (server soft-deletes the target). Otherwise
      // a plain delete — which the backend rejects (409) only when it is the
      // primary during an active subscription and there is no replacement.
      const others = methods.filter((m) => m.method_id !== target.method_id);
      if (target.is_default && others.length > 0) {
        await payApi.replace(target.method_id, others[0].method_id);
      } else {
        await payApi.remove(target.method_id);
      }
    },
    onSuccess: () => {
      setRemoveTarget(null);
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)), // keep the modal open
  });

  /* --- failed-automatic-payment recovery --- */
  const recovery = recoveryQ.data;
  const showNotice =
    !recoveryQ.isLoading &&
    !!recovery?.recovery_required &&
    !!recovery.can_retry_immediately &&
    !!recovery.outstanding_invoice_id;
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
        toast.show("결제 결과를 확인하고 있어요. 잠시 후 결제 상태가 업데이트됩니다.");
        invalidateRecovery();
        return;
      }
      if (result?.kind === "success") {
        setResultModal({ kind: "success" });
      } else if (result?.kind === "failure") {
        setResultModal({ kind: "failure", failureClass: result.failureClass });
      }
      invalidate();
      invalidateRecovery();
    },
    onError: (e) => {
      const msg = e instanceof Error && e.message === "resolved"
        ? "결제가 이미 처리되어 목록을 새로고침했어요."
        : errorMessage(e);
      toast.error(msg);
    },
  });

  function doRetry() {
    if (!showNotice || !recovery?.outstanding_invoice_id) return;
    // Never charge against a stale method id: wait for a pending primary change.
    if (setDefault.isPending || retry.isPending) return;
    if (!primaryMethod) {
      toast.error("결제에 사용할 결제수단을 먼저 선택해 주세요.");
      scrollToCards();
      return;
    }
    retry.mutate(recovery.outstanding_invoice_id);
  }

  async function confirmSuccess() {
    setResultModal(null);
    // Reconcile everything the success touched: recovery notice, wallet, and the
    // global premium entitlement (so locked content unlocks without a restart).
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

  /* --- registration / connection flows --- */
  async function start(key: string, open: () => Promise<Flow>) {
    if (starting) return; // prevent duplicate launches
    setStarting(key);
    try {
      setToken("");
      setFlow(await open());
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setStarting(null);
    }
  }
  const startCard = (region: CardRegion) =>
    start(`card-${region}`, async () => {
      const res = await payApi.cardIntent(RETURN_URL(), region);
      return {
        title: region === "domestic" ? "국내 카드 등록" : "해외 카드 등록",
        authorizeUrl: res.widget.success_url,
        placeholder: "결제창에서 발급된 인증키(authKey)",
        confirm: (t) => payApi.cardConfirm(res.intent_id, t).then(() => undefined),
      };
    });
  const startTossPay = () =>
    start("toss_pay", async () => {
      const res = await payApi.tosspayIntent(RETURN_URL());
      return {
        title: "토스페이 연결",
        authorizeUrl: res.authorize_url,
        placeholder: "연결 후 전달된 인증 코드(code)",
        // The authorize URL carries state=intent_id; the real redirect returns
        // both code and state. Reuse the intent id as state for manual confirm.
        confirm: (t) => payApi.tosspayConfirm(res.intent_id, t, res.intent_id).then(() => undefined),
      };
    });
  const startNaverPay = () =>
    start("naver_pay", async () => {
      const res = await payApi.naverpayIntent(RETURN_URL());
      return {
        title: "네이버페이 연결",
        authorizeUrl: res.authorize_url,
        placeholder: "연결 후 전달된 예약 번호(reserve_id)",
        confirm: (t) => payApi.naverpayConfirm(res.intent_id, t).then(() => undefined),
      };
    });

  async function confirmFlow() {
    if (!flow || !token.trim() || confirming) return;
    setConfirming(true);
    try {
      await flow.confirm(token.trim());
      setFlow(null);
      setToken("");
      toast.success("등록되었어요");
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
      <header className="pm__header">
        <button className="pm__back" onClick={() => nav(-1)} aria-label="뒤로 가기">
          <BackChevron />
        </button>
        <h1 className="pm__title">결제수단 관리</h1>
      </header>

      <div className="pm__scroll">
        {q.isLoading ? (
          <div className="pm__section"><SkeletonList rows={3} height={64} /></div>
        ) : q.isError ? (
          <div className="pm__state">
            <span>결제수단을 불러오지 못했어요.</span>
            <button className="pm__retry" onClick={() => q.refetch()}>다시 시도</button>
          </div>
        ) : (
          <>
            {/* --- Failed automatic payment recovery notice --- */}
            {showNotice && recovery && (
              <section className="pm__notice-fail" role="alert" aria-label="자동 결제 실패 안내">
                <div className="pm__notice-fail-head">
                  <WarnTriangle size={20} />
                  <span className="pm__notice-fail-title">결제에 실패했어요</span>
                </div>
                <p className="pm__notice-fail-desc">
                  {noticeReason(recovery.failure_class)} {NOTICE_GUIDANCE}
                </p>
                {formatRetryAt(recovery.next_automatic_retry_at) && (
                  <p className="pm__notice-fail-retry">
                    다음 자동 결제 시도일: {formatRetryAt(recovery.next_automatic_retry_at)}
                  </p>
                )}
                <button
                  ref={retryBtnRef}
                  className="pm__pay-now"
                  onClick={doRetry}
                  disabled={retry.isPending || setDefault.isPending}
                  aria-label="지금 바로 구독료 결제하기"
                  aria-busy={retry.isPending}
                >
                  {retry.isPending ? (
                    <>
                      <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                      결제 중...
                    </>
                  ) : (
                    "지금 바로 결제하기"
                  )}
                </button>
              </section>
            )}

            {/* --- Credit / debit cards --- */}
            <section className="pm__section" aria-label="신용/체크카드" ref={cardsRef}>
              <h2 className="pm__section-title">신용/체크카드</h2>
              <ul className="pm__list" role="list">
                {cards.map((m) => (
                  <li key={m.method_id}>
                    <div
                      className="pm__row"
                      role="button"
                      tabIndex={0}
                      aria-pressed={m.is_default}
                      aria-label={`${m.display_name}, 기본 결제수단 ${m.is_default ? "선택됨" : "선택 안 됨"}`}
                      onClick={() => selectPrimary(m)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectPrimary(m); } }}
                    >
                      <Radio checked={m.is_default} />
                      <CardGlyph brand={m.brand} />
                      <div className="pm__row-main">
                        <span className="pm__row-name">{cardName(m)}</span>
                        {m.masked_card_number && <span className="pm__row-masked">({m.masked_card_number})</span>}
                      </div>
                      <button
                        className="pm__del"
                        aria-label={`${m.display_name} 삭제`}
                        onClick={(e) => { e.stopPropagation(); setRemoveTarget(m); }}
                      >
                        <Trash />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              <button className="pm__add" onClick={() => startCard("domestic")} disabled={!!starting || retry.isPending} aria-label="국내 카드 추가">
                <span className="pm__add-plus"><Plus /></span>
                <span className="pm__add-label">카드 추가(국내 카드)</span>
              </button>
              <button className="pm__add" onClick={() => startCard("international")} disabled={!!starting || retry.isPending} aria-label="해외 카드 추가">
                <span className="pm__add-plus"><Plus /></span>
                <span className="pm__add-label">카드 추가(해외 카드)</span>
              </button>
            </section>

            {/* --- Easy payment --- */}
            <section className="pm__section" aria-label="간편 결제">
              <h2 className="pm__section-title">간편 결제</h2>
              <ul className="pm__list pm__list--ez" role="list">
                {EASY_PAY.map(({ provider, label, Logo, logoHeight }) => {
                  const connected = methods.find((m) => m.provider === provider);
                  const connect = provider === "toss_pay" ? startTossPay : startNaverPay;
                  return (
                    <li key={provider}>
                      {connected ? (
                        <div
                          className="pm__row pm__ez"
                          role="button"
                          tabIndex={0}
                          aria-pressed={connected.is_default}
                          aria-label={`${label}, 기본 결제수단 ${connected.is_default ? "선택됨" : "선택 안 됨"}`}
                          onClick={() => selectPrimary(connected)}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectPrimary(connected); } }}
                        >
                          <Radio checked={connected.is_default} />
                          <div className="pm__row-main pm__row-main--logo"><Logo height={logoHeight} /></div>
                          <button
                            className="pm__del"
                            aria-label={`${label} 연결 해제`}
                            onClick={(e) => { e.stopPropagation(); setRemoveTarget(connected); }}
                          >
                            <Trash />
                          </button>
                        </div>
                      ) : (
                        <div className="pm__row pm__row--connect pm__ez">
                          <div className="pm__row-main pm__row-main--logo"><Logo height={logoHeight} /></div>
                          <button className="pm__connect" onClick={connect} disabled={!!starting || retry.isPending} aria-label={`${label} 연결하기`}>
                            연결하기
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* --- Notice --- */}
            <section className="pm__notice" aria-label="유의사항">
              <h2 className="pm__notice-title">유의사항</h2>
              <ul className="pm__notice-body">
                <li>최초 1회 등록 후 서비스 이용 시 자동으로 결제됩니다.</li>
                <li>결제 수단별로 결제 가능 여부, 취소 정책이 다를 수 있습니다. 각 결제수단의 사용안내를 확인해 주세요.</li>
                <li>국내 카드 : 국민, 비씨, 삼성, 롯데, 우리, 하나, 신한, 현대, 농협 등</li>
                <li>해외 카드 : VISA, Master, JCB</li>
              </ul>
            </section>
          </>
        )}
      </div>

      {/* --- registration / connection sheet --- */}
      <Sheet open={!!flow} onClose={() => !confirming && setFlow(null)} title={flow?.title}>
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          결제창에서 인증을 마친 뒤 발급되는 값을 붙여넣어 등록을 완료해요.
        </p>
        {flow?.authorizeUrl && (
          <a className="btn btn--secondary btn--block" href={flow.authorizeUrl} target="_blank" rel="noreferrer" style={{ marginBottom: 12 }}>
            결제창 열기 ↗
          </a>
        )}
        <TextField label="인증 값" placeholder={flow?.placeholder} value={token} onChange={(e) => setToken(e.target.value)} />
        <div style={{ height: 12 }} />
        <Button block loading={confirming} disabled={!token.trim()} onClick={confirmFlow}>등록 완료</Button>
      </Sheet>

      {/* --- deletion / disconnect confirmation --- */}
      <Dialog
        open={!!removeTarget}
        onClose={remove.isPending ? undefined : () => setRemoveTarget(null)}
        title="해당 결제수단을 삭제할까요?"
        text="삭제 후에는 복구할 수 없어요"
      >
        <div className="pm__modal-actions">
          <button className="pm__modal-btn pm__modal-btn--cancel" disabled={remove.isPending} onClick={() => setRemoveTarget(null)}>
            취소
          </button>
          <button className="pm__modal-btn pm__modal-btn--delete" disabled={remove.isPending} onClick={() => removeTarget && remove.mutate(removeTarget)}>
            삭제
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
        <span className="pm__sr" role="status">{retry.isPending ? "결제를 진행하고 있어요" : "기본 결제수단 변경 중"}</span>
      )}
    </div>
  );
}
