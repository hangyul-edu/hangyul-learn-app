import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

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
      {loading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : leftIcon}
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

/* ---------------- Progress ring ---------------- */
export function ProgressRing({
  value,
  size = 120,
  stroke = 12,
  label,
  sub,
}: {
  value: number; // 0..1
  size?: number;
  stroke?: number;
  label?: ReactNode;
  sub?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} className="ring">
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ff8700" />
            <stop offset="100%" stopColor="#e65c00" />
          </linearGradient>
        </defs>
        <circle className="ring__track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle
          className="ring__val"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
        }}
      >
        {label}
        {sub}
      </div>
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="progress">
      <div className="progress__bar" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

/* ---------------- Checkbox line ---------------- */
export function CheckLine({
  checked,
  onToggle,
  children,
  round,
}: {
  checked: boolean;
  onToggle: () => void;
  children: ReactNode;
  round?: boolean;
}) {
  return (
    <div className="checkline" onClick={onToggle} role="checkbox" aria-checked={checked}>
      <span className={`checkbox ${round ? "checkbox--round" : ""} ${checked ? "is-on" : ""}`}>✓</span>
      <span style={{ flex: 1, fontSize: 13.5 }}>{children}</span>
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
      <span style={{ flex: 1 }}>
        <div className="optioncard__title">{title}</div>
        {sub && <div className="optioncard__sub">{sub}</div>}
      </span>
      <span className="optioncard__check" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}

/* ---------------- Segmented control ---------------- */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="chiprow">
      {options.map((o) => (
        <Chip key={o.value} active={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </Chip>
      ))}
    </div>
  );
}
