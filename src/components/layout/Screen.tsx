import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

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
  const nav = useNavigate();
  return (
    <div className="topbar" style={transparent ? { background: "transparent", borderColor: "transparent" } : undefined}>
      {back && (
        <button className="topbar__btn topbar__btn--ghost" onClick={onBack ?? (() => nav(-1))} aria-label="뒤로">
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
  nav,
  children,
}: {
  title?: ReactNode;
  back?: boolean;
  onBack?: () => void;
  right?: ReactNode;
  topBar?: boolean;
  /** add bottom padding so content clears the bottom nav */
  nav?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="screen">
      {topBar && <TopBar title={title} back={back} onBack={onBack} right={right} />}
      <div className={`screen__body ${nav ? "screen__body--nav" : ""}`}>{children}</div>
    </div>
  );
}
