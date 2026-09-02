import { useEffect, useRef, useState } from "react";
import { useTranslation, type TranslationKey } from "../i18n";
import radioOn from "../assets/brand/radio-on.svg";
import radioOff from "../assets/brand/radio-off.svg";

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
 */
const REASONS: { id: string; label: TranslationKey }[] = [
  { id: "price", label: "cancelReason.price" },
  { id: "usage", label: "cancelReason.usage" },
  { id: "features", label: "cancelReason.features" },
  { id: "competitor", label: "cancelReason.competitor" },
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
  /** Called with the chosen reason (free text when 기타 is picked). */
  onSubmit: (reason: string) => void;
}) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<string | null>(null);
  const [detail, setDetail] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPicked(null);
    setDetail("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) {
        e.preventDefault();
        onSkip();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, loading, onSkip]);

  if (!open) return null;

  const isOther = picked === "other";
  const reason = isOther ? detail.trim() : picked ?? "";

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
            onClick={() => onSubmit(reason)}
            disabled={loading || !reason}
          >
            {loading ? <span className="spinner" style={{ width: 22, height: 22, borderWidth: 2.5 }} /> : t("cancelReason.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
