import { useEffect, useRef, useState } from "react";
import { useModalFocus } from "../hooks/useModalFocus";
import { useTranslation, type TranslationKey } from "../i18n";
import type { CancellationReason } from "../lib/types";
import radioOn from "../assets/brand/radio-on.svg";
import radioOff from "../assets/brand/radio-off.svg";
import { Spinner } from "./ui/Spinner";

/**
 * Cancellation-reason step — Figma MOR-012 (725:20721) and its "other" variant
 * MOR-013 (726:21002).
 *
 * It sits between the cancellation confirmation (MOR-011) and the API call: the
 * reason is explicitly optional, so 건너뛰기 / Skip cancels with no reason and
 * 제출 / Submit cancels with the chosen one. `subscriptionApi.cancel` already
 * takes the reason, so neither path changes what the server does.
 *
 * Picking 기타 (직접입력) reveals the free-text box (MOR-013); every other choice
 * hides it again and discards what was typed.
 *
 * The ids are the server's `CancellationReason` values — anything else is
 * refused (422) and nothing is cancelled.
 */
const REASONS: { id: CancellationReason; label: TranslationKey }[] = [
  { id: "too_expensive", label: "cancelReason.price" },
  { id: "low_usage", label: "cancelReason.usage" },
  { id: "missing_features", label: "cancelReason.features" },
  { id: "using_other_service", label: "cancelReason.competitor" },
  { id: "other", label: "cancelReason.other" },
];

export function CancelReasonModal({
  open,
  loading,
  onSkip,
  onSubmit,
}: {
  open: boolean;
  loading: boolean;
  onSkip: () => void;
  /** Called with the chosen reason, plus the typed text when 기타 is picked. */
  onSubmit: (reason: CancellationReason, detail?: string) => void;
}) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<CancellationReason | null>(null);
  const [detail, setDetail] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPicked(null);
    setDetail("");
  }, [open]);

  useModalFocus({ open, containerRef: dialogRef, onEscape: loading ? undefined : onSkip, initialFocus: "none", trap: false });

  if (!open) return null;

  const isOther = picked === "other";
  const typed = detail.trim();
  // 기타 still needs something typed before it can be submitted.
  const canSubmit = picked !== null && (!isOther || typed !== "");

  return (
    <div className="overlay overlay--center wd__overlay">
      <div
        ref={dialogRef}
        className="crm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="crm-title"
        aria-describedby="crm-desc"
      >
        <h2 className="crm__title" id="crm-title">{t("cancelReason.title")}</h2>
        <p className="crm__sub" id="crm-desc">{t("cancelReason.subtitle")}</p>

        <div className="crm__list" role="radiogroup" aria-labelledby="crm-title">
          {REASONS.map((r) => (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={picked === r.id}
              className="crm__opt"
              onClick={() => setPicked(r.id)}
            >
              <img className="crm__radio" src={picked === r.id ? radioOn : radioOff} alt="" aria-hidden="true" />
              <span className="crm__label">{t(r.label)}</span>
            </button>
          ))}
        </div>

        {isOther && (
          <textarea
            className="crm__detail"
            placeholder={t("cancelReason.placeholder")}
            aria-label={t("cancelReason.placeholder")}
            maxLength={500}
            value={detail}
            disabled={loading}
            onChange={(e) => setDetail(e.target.value)}
          />
        )}

        <div className="crm__actions">
          <button className="crm__btn crm__btn--skip" onClick={onSkip} disabled={loading}>
            {t("cancelReason.skip")}
          </button>
          <button
            className="crm__btn crm__btn--go"
            onClick={() => picked && onSubmit(picked, isOther ? typed : undefined)}
            disabled={loading || !canSubmit}
          >
            {loading ? <Spinner size={22} stroke={2.5} /> : t("cancelReason.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
