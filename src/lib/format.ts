export function initials(name?: string | null): string {
  if (!name) return "🙂";
  const t = name.trim();
  return t ? t[0].toUpperCase() : "🙂";
}

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

export function maskPhone(p?: string | null): string {
  if (!p) return "-";
  return p.replace(/(\d{2,3})\d+(\d{4})$/, "$1****$2");
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
