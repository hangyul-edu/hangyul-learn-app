import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, Sheet } from "../components/ui/Modal";
import { Button } from "../components/ui/kit";
import { TextField } from "../components/ui/Field";
import { SkeletonList } from "../components/ui/states";
import { NaverPayLogo, TossPayLogo } from "../components/brand/PayBrand";
import { payApi, type CardRegion } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import type { MethodProvider, PaymentMethod } from "../lib/types";

const QK = ["payment-methods"] as const;
const RETURN_URL = () => window.location.origin + "/account/payment";

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

/* -------------------------------- helpers ------------------------------- */
const EASY_PAY: { provider: MethodProvider; label: string; Logo: (p: { height?: number }) => JSX.Element }[] = [
  { provider: "toss_pay", label: "토스페이", Logo: TossPayLogo },
  { provider: "naver_pay", label: "네이버페이", Logo: NaverPayLogo },
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
export function PaymentMethods() {
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: QK, queryFn: payApi.methods });
  const methods = q.data?.methods ?? [];
  const cards = methods.filter((m) => m.kind === "card");

  const [removeTarget, setRemoveTarget] = useState<PaymentMethod | null>(null);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [token, setToken] = useState("");
  const [starting, setStarting] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: QK });

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
    if (m.is_default || setDefault.isPending) return;
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
            {/* --- Credit / debit cards --- */}
            <section className="pm__section" aria-label="신용/체크카드">
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

              <button className="pm__add" onClick={() => startCard("domestic")} disabled={!!starting} aria-label="국내 카드 추가">
                <span className="pm__add-plus"><Plus /></span>
                <span className="pm__add-label">카드 추가(국내 카드)</span>
              </button>
              <button className="pm__add" onClick={() => startCard("international")} disabled={!!starting} aria-label="해외 카드 추가">
                <span className="pm__add-plus"><Plus /></span>
                <span className="pm__add-label">카드 추가(해외 카드)</span>
              </button>
            </section>

            {/* --- Easy payment --- */}
            <section className="pm__section" aria-label="간편 결제">
              <h2 className="pm__section-title">간편 결제</h2>
              <ul className="pm__list" role="list">
                {EASY_PAY.map(({ provider, label, Logo }) => {
                  const connected = methods.find((m) => m.provider === provider);
                  const connect = provider === "toss_pay" ? startTossPay : startNaverPay;
                  return (
                    <li key={provider}>
                      {connected ? (
                        <div
                          className="pm__row"
                          role="button"
                          tabIndex={0}
                          aria-pressed={connected.is_default}
                          aria-label={`${label}, 기본 결제수단 ${connected.is_default ? "선택됨" : "선택 안 됨"}`}
                          onClick={() => selectPrimary(connected)}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectPrimary(connected); } }}
                        >
                          <Radio checked={connected.is_default} />
                          <div className="pm__row-main pm__row-main--logo"><Logo /></div>
                          <button
                            className="pm__del"
                            aria-label={`${label} 연결 해제`}
                            onClick={(e) => { e.stopPropagation(); setRemoveTarget(connected); }}
                          >
                            <Trash />
                          </button>
                        </div>
                      ) : (
                        <div className="pm__row pm__row--connect">
                          <div className="pm__row-main pm__row-main--logo"><Logo /></div>
                          <button className="pm__connect" onClick={connect} disabled={!!starting} aria-label={`${label} 연결하기`}>
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

      {selectDisabled && <span className="pm__sr" role="status">기본 결제수단 변경 중</span>}
    </div>
  );
}
