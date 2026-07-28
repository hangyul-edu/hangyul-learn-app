export function timeAgo(iso?: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const s = Math.floor((Date.now() - then) / 1000);
  if (s < 60) return "방금 전";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  if (s < 604800) return `${Math.floor(s / 86400)}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
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

export function formatMoney(cents: number, currency = "KRW"): string {
  const amount = currency === "KRW" ? cents : cents / 100;
  try {
    return new Intl.NumberFormat("ko-KR", {
      style: "currency",
      currency,
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

export const NATIONALITIES: { code: string; label: string; dial: string; flag: string }[] = [
  { code: "KR", label: "대한민국", dial: "+82", flag: "🇰🇷" },
  { code: "US", label: "United States", dial: "+1", flag: "🇺🇸" },
  { code: "JP", label: "日本", dial: "+81", flag: "🇯🇵" },
  { code: "CN", label: "中国", dial: "+86", flag: "🇨🇳" },
  { code: "VN", label: "Việt Nam", dial: "+84", flag: "🇻🇳" },
  { code: "TH", label: "ประเทศไทย", dial: "+66", flag: "🇹🇭" },
  { code: "ID", label: "Indonesia", dial: "+62", flag: "🇮🇩" },
  { code: "FR", label: "France", dial: "+33", flag: "🇫🇷" },
  { code: "DE", label: "Deutschland", dial: "+49", flag: "🇩🇪" },
];
