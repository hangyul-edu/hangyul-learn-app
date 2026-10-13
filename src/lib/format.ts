import type { TranslationKey } from "../i18n";
import type { AppLanguage } from "./language";
import { formatPhoneForDisplay } from "./phone";
import { deviceTimeZone } from "./timezone";

type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string;

/**
 * Compact relative age ("just now" / N minutes / N hours / N days), formatted in
 * the active language. `t` is passed in because this runs outside React.
 */
export function timeAgo(iso: string | null | undefined, t: Translate, locale = "ko-KR"): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const s = Math.floor((Date.now() - then) / 1000);
  if (s < 60) return t("time.justNow");
  if (s < 3600) return t("time.minutesAgo", { n: Math.floor(s / 60) });
  if (s < 86400) return t("time.hoursAgo", { n: Math.floor(s / 3600) });
  if (s < 604800) return t("time.daysAgo", { n: Math.floor(s / 86400) });
  return new Date(iso).toLocaleDateString(locale, { month: "long", day: "numeric" });
}

// Notice dates are shown on the device's calendar, like every other date in
// the app (the instant is converted, never sliced from the raw string).
function displayDateParts(
  iso: string | null | undefined,
  timeZone: string,
): { y: string; m: string; d: string } | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const pick = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const y = pick("year");
  const m = pick("month");
  const d = pick("day");
  return y && m && d ? { y, m, d } : null;
}

/** Notice-list date, e.g. `26.06.29` (yy.MM.dd). Invalid/missing → "". */
export function formatNoticeListDate(iso?: string | null, timeZone = deviceTimeZone()): string {
  const p = displayDateParts(iso, timeZone);
  return p ? `${p.y.slice(2)}.${p.m}.${p.d}` : "";
}

/** Notice-detail date, e.g. `2026.06.29` (yyyy.MM.dd). Invalid/missing → "". */
export function formatNoticeDetailDate(iso?: string | null, timeZone = deviceTimeZone()): string {
  const p = displayDateParts(iso, timeZone);
  return p ? `${p.y}.${p.m}.${p.d}` : "";
}

export function secondsUntil(iso?: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
}

/** Locale tag for Intl formatting in the active app language. */
export function localeFor(language: AppLanguage): string {
  return language === "en" ? "en-US" : "ko-KR";
}

/**
 * A full date. The designs print "2025년 11월 29일" in Korean and the shortened
 * "Nov 29, 2025" in English (Figma MOR-010, 624:9777 / 784:62109).
 */
export function formatLongDate(iso: string | null | undefined, language: AppLanguage): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(localeFor(language), {
    year: "numeric",
    month: language === "en" ? "short" : "long",
    day: "numeric",
  });
}

/** Currencies with no minor unit: their `*_cents` amounts are whole units (ISO 4217). */
const ZERO_DECIMAL = new Set(["KRW", "JPY"]);

/** Symbols that name their currency unambiguously. USD is always "US$" —
 *  never a bare "$", which reads as any dollar (CAD, AUD, SGD…). */
const UNAMBIGUOUS_SYMBOL: Record<string, string> = { KRW: "₩", USD: "US$" };
/** The bare symbols, for a screen whose design draws "$5.99" and where the
 *  currency is otherwise clear (the purchase screen's plan cards). */
const NARROW_SYMBOL: Record<string, string> = { KRW: "₩", USD: "$" };

/** Format a server `*_cents` amount (the currency's minor unit) for display:
 *  "₩9,900", "US$5.99" — or "$5.99" with `narrow`. Same in every app language. */
export function formatMoney(cents: number, currency = "KRW", { narrow = false } = {}): string {
  const code = currency.toUpperCase();
  const zeroDecimal = ZERO_DECIMAL.has(code);
  const amount = zeroDecimal ? cents : cents / 100;
  const digits = zeroDecimal ? 0 : 2;
  const symbol = (narrow ? NARROW_SYMBOL : UNAMBIGUOUS_SYMBOL)[code];
  if (symbol) {
    const number = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(Math.abs(amount));
    return `${amount < 0 ? "-" : ""}${symbol}${number}`;
  }
  try {
    return new Intl.NumberFormat("ko-KR", {
      style: "currency",
      currency: code,
      maximumFractionDigits: digits,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${code}`;
  }
}

/**
 * Display formatter for a stored (canonical E.164) phone number: Korean
 * numbers as 010-1234-5678, every other country internationally
 * (+1 201 555 0123). Anything unparseable is shown as stored, so nothing is
 * fabricated; the canonical value stays untouched.
 */
export function formatPhone(p?: string | null): string {
  if (!p) return "-";
  return formatPhoneForDisplay(p);
}
