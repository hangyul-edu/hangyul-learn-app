import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../i18n";
import icBack from "../assets/brand/ic-topnav-back.svg";

/**
 * `cp_B_01_topNav` — the one top bar every More-detail page uses.
 *
 * Figma (instance 572:21433): a white 375x50 row, `padding: 13px 20px`, laid out
 * `space-between` as [24px back icon] [Body 5 title] [24px spacer]. The spacer is
 * what keeps the title optically centred, so it is rendered even when there is
 * no trailing control.
 *
 * The nine detail screens each had their own copy of this — back buttons landing
 * anywhere from x=-10 to x=20, icons at 24/26/27px inside 24 or 44px boxes. They
 * all render this instead now, so the bar cannot drift per screen again.
 */
export function DetailHeader({
  title,
  onBack,
  backLabel,
  trailing,
  className,
}: {
  title: ReactNode;
  /** Defaults to browser-back. */
  onBack?: () => void;
  /** Overrides the default "back" a11y label. */
  backLabel?: string;
  /** Optional control on the right (e.g. Friend management's 친구 추가 pill). */
  trailing?: ReactNode;
  /** Extra class for per-screen background/border tweaks. */
  className?: string;
}) {
  const { t } = useTranslation();
  const nav = useNavigate();
  return (
    <header className={`topnav${className ? ` ${className}` : ""}`}>
      <button
        className="topnav__back"
        onClick={onBack ?? (() => nav(-1))}
        aria-label={backLabel ?? t("common.back")}
      >
        <img src={icBack} alt="" aria-hidden="true" />
      </button>
      <h1 className="topnav__title">{title}</h1>
      <span className="topnav__gap">{trailing}</span>
    </header>
  );
}
