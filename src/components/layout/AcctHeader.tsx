import { useTranslation } from "../../i18n";
import { BackChevronIcon, CloseIcon } from "../brand/Glyphs";

/**
 * The account and settings screens' header: a back chevron (or, for a flow
 * that quits rather than goes back, a ✕ with its own label) and the title.
 */
export function AcctHeader({
  title,
  onBack,
  quitLabel,
}: {
  title: string;
  onBack: () => void;
  /** Show ✕ instead of the chevron, named by this label. */
  quitLabel?: string;
}) {
  const { t } = useTranslation();
  return (
    <header className="acct__header">
      <button className="acct__back" onClick={onBack} aria-label={quitLabel ?? t("common.back")}>
        {quitLabel ? <CloseIcon /> : <BackChevronIcon size={27} />}
      </button>
      <h1 className="acct__title">{title}</h1>
    </header>
  );
}
