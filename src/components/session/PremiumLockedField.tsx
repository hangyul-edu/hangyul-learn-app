import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../../i18n";
import icSend from "../../assets/brand/ic-send.svg";

/** How long the "★ Premium only" tag stays up after a tap. */
export const PREMIUM_TAG_MS = 2500;

/** The session panel's field as a regular member sees it (TAL-008 conversation
 * request 739:46693, TAL-016 TOPIK question type 1916:25853): locked. A tap
 * does nothing but raise the "★ Premium only" tag over it for a moment — the
 * server refuses the request too (402). */
export function PremiumLockedField({ placeholder, send = false }: { placeholder: string; send?: boolean }) {
  const { t } = useTranslation();
  const [tagShown, setTagShown] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  // The live field's copy opens with ✨; the locked frames swap it for 🔒.
  const text = placeholder.replace(/^✨\s*/u, "");

  function showTag() {
    setTagShown(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setTagShown(false), PREMIUM_TAG_MS);
  }

  return (
    <div className="sess__locked">
      {tagShown && (
        <span className="sess__locked-tag" aria-hidden="true">
          {t("session.premiumTag")}
        </span>
      )}
      <button
        type="button"
        className="sess__prompt sess__locked-field"
        onClick={showTag}
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
