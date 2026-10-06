import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../../i18n";

export function TopBar({
  title,
  onBack,
  back,
  right,
  transparent,
}: {
  title?: ReactNode;
  onBack?: () => void;
  back?: boolean;
  right?: ReactNode;
  transparent?: boolean;
}) {
  const { t } = useTranslation();
  const nav = useNavigate();
  return (
    <div className="topbar" style={transparent ? { background: "transparent", borderColor: "transparent" } : undefined}>
      {back && (
        <button className="topbar__btn topbar__btn--ghost" onClick={onBack ?? (() => nav(-1))} aria-label={t("common.back")}>
          ‹
        </button>
      )}
      <div className="topbar__title">{title}</div>
      <div className="spacer" />
      {right}
    </div>
  );
}

export function Screen({
  title,
  back,
  onBack,
  right,
  topBar = true,
  header,
  nav,
  className,
  children,
}: {
  title?: ReactNode;
  back?: boolean;
  onBack?: () => void;
  right?: ReactNode;
  topBar?: boolean;
  /** A screen-specific top bar (e.g. DetailHeader) in place of the generic one. */
  header?: ReactNode;
  /** add bottom padding so content clears the bottom nav */
  nav?: boolean;
  /** Extra class on the screen root, e.g. a screen-specific background. */
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className ? `screen ${className}` : "screen"}>
      {header ?? (topBar && <TopBar title={title} back={back} onBack={onBack} right={right} />)}
      <div className={`screen__body ${nav ? "screen__body--nav" : ""}`}>{children}</div>
    </div>
  );
}
