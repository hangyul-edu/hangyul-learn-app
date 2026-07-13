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

export const TIER_COLOR: Record<string, string> = {
  green: "var(--tier-green)",
  lime: "var(--tier-lime)",
  yellow: "var(--tier-yellow)",
  orange: "var(--tier-orange)",
  red: "var(--tier-red)",
};

export const TIER_LABEL: Record<string, string> = {
  green: "그린 리그",
  lime: "라임 리그",
  yellow: "옐로 리그",
  orange: "오렌지 리그",
  red: "레드 리그",
};
