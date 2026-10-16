import { useTranslation } from "../../i18n";
import { useToast } from "../../hooks/toast";
import icSend from "../../assets/brand/ic-send.svg";

/** The session panel's field as a regular member sees it (TAL-008 conversation
 * request 739:46693, TAL-016 TOPIK question type 1916:25853): the field locked
 * under a "★ Premium only" tag. A tap explains why instead of doing anything —
 * the server refuses the request too (402). */
export function PremiumLockedField({ placeholder, send = false }: { placeholder: string; send?: boolean }) {
  const { t } = useTranslation();
  const toast = useToast();
  // The live field's copy opens with ✨; the locked frames swap it for 🔒.
  const text = placeholder.replace(/^✨\s*/u, "");
  return (
    <div className="sess__locked">
      <span className="sess__locked-tag" aria-hidden="true">
        {t("session.premiumTag")}
      </span>
      <button
        type="button"
        className="sess__prompt sess__locked-field"
        onClick={() => toast.show(t("session.premiumOnlyNotice"))}
        aria-label={`${text} (${t("session.premiumOnlyNotice")})`}
      >
        <span className="sess__locked-text" aria-hidden="true">
          <span className="sess__locked-lock">🔒</span> {text}
        </span>
        {send && <img className="sess__prompt-send-ic sess__locked-send" src={icSend} alt="" aria-hidden="true" />}
      </button>
    </div>
  );
}
