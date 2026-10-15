import { useTranslation } from "../../i18n";
import icSend from "../../assets/brand/ic-send.svg";

/** The session's customization field: a natural-language request for the rest
 * of the set ("more travel sentences"), sent with the arrow button. */
export function CustomPrompt({
  value,
  onChange,
  onSubmit,
  busy,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (text: string) => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const text = value.trim();
  return (
    <div className="sess__prompt">
      <input
        className="sess__prompt-input"
        placeholder={t("session.customPlaceholder")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={t("session.customInputA11y")}
      />
      <button
        className="sess__prompt-send"
        onClick={() => text && onSubmit(text)}
        disabled={!text || busy}
        aria-label={t("session.customSubmitA11y")}
      >
        <img className="sess__prompt-send-ic" src={icSend} alt="" aria-hidden="true" />
      </button>
    </div>
  );
}
