import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { Spinner } from "./Spinner";
import { CheckIcon } from "../brand/Glyphs";

/* ---------------- Button ---------------- */
type Variant = "primary" | "secondary" | "ghost" | "danger";
export function Button({
  variant = "primary",
  size,
  block,
  pill,
  loading,
  leftIcon,
  children,
  className = "",
  disabled,
  ...rest
}: {
  variant?: Variant;
  size?: "sm" | "lg";
  block?: boolean;
  pill?: boolean;
  loading?: boolean;
  leftIcon?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = [
    "btn",
    `btn--${variant}`,
    size === "sm" && "btn--sm",
    size === "lg" && "btn--lg",
    block && "btn--block",
    pill && "btn--pill",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button className={cls} disabled={disabled || loading} {...rest}>
      {loading ? <Spinner size={18} stroke={2} /> : leftIcon}
      {!loading && children}
    </button>
  );
}

/* ---------------- Card ---------------- */
export function Card({
  children,
  className = "",
  onClick,
  variant,
  padLg,
  style,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  variant?: "brand" | "soft" | "flat";
  padLg?: boolean;
  style?: CSSProperties;
}) {
  const cls = [
    "card",
    variant === "brand" && "card--brand",
    variant === "soft" && "card--soft",
    variant === "flat" && "card--flat",
    padLg && "card--pad-lg",
    onClick && "card-btn",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  if (onClick)
    return (
      <button className={cls} onClick={onClick} type="button" style={style}>
        {children}
      </button>
    );
  return <div className={cls} style={style}>{children}</div>;
}

/* ---------------- Chip ---------------- */
export function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`chip ${active ? "is-active" : ""} ${onClick ? "" : "chip--static"}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/* ---------------- Badge ---------------- */
export function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: "brand" | "success" | "danger" | "premium";
}) {
  return <span className={`badge ${tone ? `badge--${tone}` : ""}`}>{children}</span>;
}

/* ---------------- Avatar ---------------- */
export function Avatar({
  name,
  url,
  size = 44,
  emoji,
}: {
  name?: string | null;
  url?: string | null;
  size?: number;
  emoji?: string;
}) {
  const letter = name?.trim()?.[0]?.toUpperCase();
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {url ? <img src={url} alt="" /> : emoji || letter || "🙂"}
    </div>
  );
}

/* ---------------- Option card ---------------- */
export function OptionCard({
  selected,
  onClick,
  emoji,
  title,
  sub,
}: {
  selected: boolean;
  onClick: () => void;
  emoji?: string;
  title: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <button type="button" className={`optioncard ${selected ? "is-selected" : ""}`} onClick={onClick}>
      {emoji && <span className="optioncard__emoji">{emoji}</span>}
      <span className="optioncard__body">
        <div className="optioncard__title">{title}</div>
        {sub && <div className="optioncard__sub">{sub}</div>}
      </span>
      <span className="optioncard__check" aria-hidden="true">
        <CheckIcon />
      </span>
    </button>
  );
}
