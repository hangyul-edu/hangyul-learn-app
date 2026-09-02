import type { TranslationKey } from "../i18n";
import type { AppLanguage } from "./language";

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

// The product's configured display timezone. Notice dates are formatted in
// KST so they render identically regardless of the device's local timezone
// (we never slice the raw timestamp string).
const DISPLAY_TZ = "Asia/Seoul";

function displayDateParts(iso?: string | null): { y: string; m: string; d: string } | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DISPLAY_TZ,
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
export function formatNoticeListDate(iso?: string | null): string {
  const p = displayDateParts(iso);
  return p ? `${p.y.slice(2)}.${p.m}.${p.d}` : "";
}

/** Notice-detail date, e.g. `2026.06.29` (yyyy.MM.dd). Invalid/missing → "". */
export function formatNoticeDetailDate(iso?: string | null): string {
  const p = displayDateParts(iso);
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

export function formatMoney(cents: number, currency = "KRW"): string {
  const amount = currency === "KRW" ? cents : cents / 100;
  try {
    return new Intl.NumberFormat("ko-KR", {
      style: "currency",
      currency,
      // The designs print "$5.99", not the locale-qualified "US$5.99" the
      // default `currencyDisplay: "symbol"` produces for USD under ko-KR.
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: currency === "KRW" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${currency}`;
  }
}

/**
 * Display formatter for a stored (canonical, often E.164) phone number. Korean
 * numbers render as 010-1234-5678; other/unknown formats fall back to the raw
 * value so nothing is fabricated. The canonical value stays untouched.
 */
export function formatPhone(p?: string | null): string {
  if (!p) return "-";
  const digits = p.replace(/[^\d+]/g, "");
  let national = digits;
  if (digits.startsWith("+82")) national = "0" + digits.slice(3);
  else if (digits.startsWith("+")) return digits; // non-KR: keep readable E.164
  national = national.replace(/\D/g, "");
  if (national.length === 11) return national.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
  if (national.length === 10) return national.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
  return national || (p ?? "-");
}

/**
 * Supported phone-prefix countries.
 *
 * This table carries ONLY locale-independent data — ISO code, dial code, flag —
 * and points at a catalog key for the display name. It previously mixed the two:
 * KR held the translation key "ui.defaultCountry" while the other eight held
 * hardcoded endonyms, so the selector rendered the raw key for Korea and never
 * localized any of the others. Every name now resolves through `t()`, from one
 * source, in both locales.
 */
export const NATIONALITIES: {
  code: string;
  /** Catalog key — resolve with `t()`; never render this directly. */
  labelKey: TranslationKey;
  dial: string;
  flag: string;
}[] = [
  { code: "KR", labelKey: "ui.countries.KR", dial: "+82", flag: "🇰🇷" },
  { code: "US", labelKey: "ui.countries.US", dial: "+1", flag: "🇺🇸" },
  { code: "JP", labelKey: "ui.countries.JP", dial: "+81", flag: "🇯🇵" },
  { code: "CN", labelKey: "ui.countries.CN", dial: "+86", flag: "🇨🇳" },
  { code: "VN", labelKey: "ui.countries.VN", dial: "+84", flag: "🇻🇳" },
  { code: "TH", labelKey: "ui.countries.TH", dial: "+66", flag: "🇹🇭" },
  { code: "ID", labelKey: "ui.countries.ID", dial: "+62", flag: "🇮🇩" },
  { code: "FR", labelKey: "ui.countries.FR", dial: "+33", flag: "🇫🇷" },
  { code: "DE", labelKey: "ui.countries.DE", dial: "+49", flag: "🇩🇪" },
];
