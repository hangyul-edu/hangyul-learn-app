import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { useTranslation, type TranslationKey } from "../../i18n";
import { NaverPayLogo, TossPayLogo } from "../../components/brand/PayBrand";
import { Spinner } from "../../components/ui/Spinner";
import { NOTICE_GUIDANCE_KEY, failureModalKeys, formatRetryAt, noticeReasonKey } from "../../lib/paymentRecovery";
import { useModalFocus } from "../../hooks/useModalFocus";
import type { MethodProvider, PaymentMethod, PaymentRecovery } from "../../lib/types";
import cardArt from "../../assets/brand/pm-card-art.svg";
import trashIcon from "../../assets/brand/ic-trash.svg";
import successIcon from "../../assets/brand/ic-modal-success.svg";
import radioOn from "../../assets/brand/pm-radio-on.svg";
import radioOff from "../../assets/brand/pm-radio-off.svg";
import addPlus from "../../assets/brand/pm-add-plus.svg";

/* --------------------------------- icons -------------------------------- */
/* Group 1410118763 — the 10x12 bin glyph exported from SET-002. */
const Trash = () => <img src={trashIcon} width={10} height={12} alt="" aria-hidden="true" />;
/* Group 1410118744 (1988:24838) — the 25px brand disc with its white plus. */
const Plus = () => <img className="pm__add-plus" src={addPlus} alt="" aria-hidden="true" />;
/* Group 1410118747 — the 46x27.26 card illustration exported from SET-002.
   The design uses one mark for every issuer, so `brand` is not consulted. */
export const CardGlyph = () => <img className="pm__thumb" src={cardArt} alt="" aria-hidden="true" />;
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

/** The Korean wallets, in display order. */
export const EASY_PAY: {
  provider: MethodProvider;
  labelKey: TranslationKey;
  Logo: () => JSX.Element;
}[] = [
  { provider: "toss_pay", labelKey: "paymentMethods.tossPay", Logo: TossPayLogo },
  { provider: "naver_pay", labelKey: "paymentMethods.naverPay", Logo: NaverPayLogo },
];

/**
 * A method on file: a row that makes it the primary (Enter / Space too) with
 * its radio, the method's face, and a delete button.
 */
export function MethodRow({
  className = "",
  selected,
  locked,
  label,
  deleteLabel,
  onSelect,
  onDelete,
  children,
}: {
  className?: string;
  selected: boolean;
  locked: boolean;
  label: string;
  deleteLabel: string;
  onSelect: () => void;
  onDelete: () => void;
  children: ReactNode;
}) {
  // Enter / Space on the row itself picks it; keys pressed on the delete
  // button inside it bubble up here and must stay that button's own.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    }
  };
  return (
    <div
      className={["pm__row", className, locked && "pm__row--locked"].filter(Boolean).join(" ")}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-disabled={locked || undefined}
      aria-label={label}
      onClick={onSelect}
      onKeyDown={onKeyDown}
    >
      <Radio checked={selected} />
      {children}
      <button
        className="pm__del"
        aria-label={deleteLabel}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <Trash />
      </button>
    </div>
  );
}

/** The add-a-card entry: the plus disc, a label and its sub-line. */
export function AddMethodButton({
  label,
  sub,
  a11yLabel,
  disabled,
  onClick,
}: {
  label: string;
  sub: string;
  a11yLabel: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button className="pm__add" onClick={onClick} disabled={disabled} aria-label={a11yLabel}>
      <Plus />
      <span className="pm__add-text">
        <span className="pm__add-label">{label}</span>
        <span className="pm__add-sub">{sub}</span>
      </span>
    </button>
  );
}

/** The failed-automatic-payment notice and its pay-now button. */
export function RecoveryNotice({
  recovery,
  blockedText,
  canRetry,
  paying,
  busy,
  onRetry,
  retryBtnRef,
}: {
  recovery: PaymentRecovery;
  blockedText: string;
  canRetry: boolean;
  paying: boolean;
  /** Another change (a primary switch) is in flight. */
  busy: boolean;
  onRetry: () => void;
  retryBtnRef: React.RefObject<HTMLButtonElement>;
}) {
  const { t, language } = useTranslation();
  const nextRetry = formatRetryAt(recovery.next_automatic_retry_at, language, t);
  return (
    <section className="pm__notice-fail" role="alert" aria-label={t("paymentMethods.failNoticeA11y")}>
      <div className="pm__notice-fail-head">
        <WarnTriangle />
        <span className="pm__notice-fail-title">{t("paymentMethods.failNoticeTitle")}</span>
      </div>
      <p className="pm__notice-fail-desc">
        {t(noticeReasonKey(recovery.failure_class))} {t(NOTICE_GUIDANCE_KEY)}
      </p>
      {nextRetry && <p className="pm__notice-fail-retry">{t("paymentMethods.nextRetry", { date: nextRetry })}</p>}
      {blockedText && (
        <p className="pm__notice-fail-blocked" role="status">
          {blockedText}
        </p>
      )}
      <button
        ref={retryBtnRef}
        className="pm__pay-now"
        onClick={onRetry}
        disabled={!canRetry || paying || busy}
        aria-label={t("paymentMethods.payNowA11y")}
        aria-busy={paying}
      >
        {paying ? (
          <>
            <Spinner size={18} stroke={2} />
            {t("paymentMethods.paying")}
          </>
        ) : (
          t("paymentMethods.payNow")
        )}
      </button>
    </section>
  );
}

/* Non-dismissable payment-result modal (§8/§9/§10): no outside-tap/back close,
   scroll locked, focus moved to the action button and restored on close. */
export function PaymentResultModal({
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
          {/* 1542:23308 labels the success button OK; 1542:23318 "Try another method". */}
          {success ? t("common.ok") : t("paymentMethods.chooseAnother")}
        </button>
      </div>
    </div>
  );
}

/** How SET-010 names the card: the issuer and the masked number in brackets,
 *  as the list rows show it. */
function cardFace(m: PaymentMethod): string {
  if (m.display_name.includes("(") || !m.masked_card_number) return m.display_name;
  return `${m.display_name} (${m.masked_card_number})`;
}

/**
 * "카드 등록이 완료됐습니다" — SET-010 (KO 1332:22357 / EN 1332:24034): the
 * status-badge card with the registered card named in a Gray 1 panel under the
 * copy. Shown only once the server has confirmed the registration; the single
 * button acknowledges it (`onConfirm`), which is when the screen carries on
 * (back to the purchase screen when that is where the member came from).
 * Backdrop is non-dismissable; the button / Escape confirm.
 */
export function CardRegisteredModal({ method, onConfirm }: { method: PaymentMethod; onConfirm: () => void }) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocus({ open: true, containerRef: dialogRef, onEscape: onConfirm, initialFocus: ".wdd__btn" });
  return (
    <div className="overlay overlay--center wd__overlay">
      <div
        ref={dialogRef}
        className="wdd wdd--card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="crd-title"
        aria-describedby="crd-desc"
      >
        <div className="wdd__icon" aria-hidden="true">
          <CheckMark />
        </div>
        <h2 className="wdd__title" id="crd-title">{t("paymentMethods.cardRegisteredTitle")}</h2>
        <p className="wdd__copy" id="crd-desc">{t("paymentMethods.cardRegisteredDesc")}</p>
        {/* Frame 427319206 — the card art and its name on Gray 1, r8. */}
        <div className="crd__panel">
          <CardGlyph />
          <span className="crd__name">{cardFace(method)}</span>
        </div>
        <button className="wdd__btn" onClick={onConfirm}>{t("paymentMethods.cardRegisteredConfirm")}</button>
      </div>
    </div>
  );
}
