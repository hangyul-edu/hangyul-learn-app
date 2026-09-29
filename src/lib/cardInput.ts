/**
 * Pure helpers for the overseas-card form (POST /payment-methods/cards/international).
 *
 * PCI DSS (docs/payments/09-security.md §9.1): nothing here stores, logs or
 * reports a value — every function takes the typed text and returns a derived
 * value. The server repeats every check; these only let the form point at the
 * field to fix before anything leaves the device.
 */

export type CardBrand = "visa" | "mastercard" | "amex" | "jcb" | "diners" | "discover" | "unionpay";

/** Display names for the detected network (brand names are not translated). */
export const CARD_BRAND_NAMES: Record<CardBrand, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  jcb: "JCB",
  diners: "Diners Club",
  discover: "Discover",
  unionpay: "UnionPay",
};

/** The longest PAN the API accepts. */
export const CARD_NUMBER_MAX_DIGITS = 19;
const CARD_NUMBER_MIN_DIGITS = 12;

/** Digits only (spaces, hyphens and anything else dropped), capped at 19. */
export function cardDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, CARD_NUMBER_MAX_DIGITS);
}

const between = (value: number, lo: number, hi: number) => value >= lo && value <= hi;

/**
 * The card network from the number's prefix — for display only (a hint next
 * to the field). Toss decides what it accepts; the form never blocks on this.
 */
export function detectCardBrand(digits: string): CardBrand | null {
  const d = cardDigits(digits);
  if (!d) return null;
  const p = (n: number) => Number(d.slice(0, n));
  if (d.startsWith("4")) return "visa";
  if (d.length >= 2 && (p(2) === 34 || p(2) === 37)) return "amex";
  if (d.length >= 2 && between(p(2), 51, 55)) return "mastercard";
  if (d.length >= 4 && between(p(4), 2221, 2720)) return "mastercard";
  if (d.length >= 4 && between(p(4), 3528, 3589)) return "jcb";
  if (d.length >= 2 && (p(2) === 36 || p(2) === 38 || p(2) === 39)) return "diners";
  if (d.length >= 3 && between(p(3), 300, 305)) return "diners";
  if (d.length >= 4 && p(4) === 6011) return "discover";
  if (d.length >= 2 && p(2) === 65) return "discover";
  if (d.length >= 3 && between(p(3), 644, 649)) return "discover";
  if (d.length >= 2 && p(2) === 62) return "unionpay";
  return null;
}

/** Group the digits for display: 4-6-5 for Amex, 4-6-4 for 14-digit Diners, else blocks of 4. */
export function formatCardNumber(digits: string): string {
  const d = cardDigits(digits);
  const brand = detectCardBrand(d);
  const pattern = brand === "amex" ? [4, 6, 5] : brand === "diners" && d.length <= 14 ? [4, 6, 4] : null;
  if (!pattern) return d.replace(/(\d{4})(?=\d)/g, "$1 ");
  const parts: string[] = [];
  let at = 0;
  for (const size of pattern) {
    if (at >= d.length) break;
    parts.push(d.slice(at, at + size));
    at += size;
  }
  if (at < d.length) parts.push(d.slice(at));
  return parts.join(" ");
}

/** The Luhn (mod 10) checksum the server also applies. */
export function luhnValid(digits: string): boolean {
  const d = cardDigits(digits);
  if (!d) return false;
  let total = 0;
  for (let i = 0; i < d.length; i++) {
    let v = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) {
      v *= 2;
      if (v > 9) v -= 9;
    }
    total += v;
  }
  return total % 10 === 0;
}

/** Length 12–19 and a passing Luhn check. */
export function cardNumberValid(digits: string): boolean {
  const d = cardDigits(digits);
  return d.length >= CARD_NUMBER_MIN_DIGITS && luhnValid(d);
}

/**
 * Re-format what the member typed in the expiry field as `MM/YY`. A lone
 * first digit above 1 is taken as a month (`7` → `07/`).
 */
export function formatExpiryInput(value: string): string {
  let d = value.replace(/\D/g, "");
  if (d.length === 1 && Number(d) > 1) d = `0${d}`;
  d = d.slice(0, 4);
  if (d.length <= 2) return d.length === 2 && value.trim().endsWith("/") ? `${d}/` : d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

/** `MM/YY` → month + four-digit year, or null when incomplete / not a month. */
export function parseExpiry(value: string): { month: number; year: number } | null {
  const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const month = Number(m[1]);
  if (month < 1 || month > 12) return null;
  return { month, year: 2000 + Number(m[2]) };
}

/** A card expiring this month is still valid; only earlier months are expired. */
export function isExpired(month: number, year: number, now: Date = new Date()): boolean {
  return year * 12 + month < now.getFullYear() * 12 + now.getMonth() + 1;
}

/** `YYMMDD` with month 01–12 and day 01–31 (the server's own rule). */
export function birthDateValid(value: string): boolean {
  if (!/^\d{6}$/.test(value)) return false;
  const month = Number(value.slice(2, 4));
  const day = Number(value.slice(4, 6));
  return between(month, 1, 12) && between(day, 1, 31);
}

export type CardField = "currency" | "cardNumber" | "expiry" | "birthDate";
export type CardFieldProblem = "required" | "invalid" | "expired";
export type CardFieldErrors = Partial<Record<CardField, CardFieldProblem>>;

/** Client-side pre-check of the whole form; an empty object means "send it". */
export function validateInternationalCard(
  input: { currency: string; cardNumber: string; expiry: string; birthDate: string },
  requiresBirthDate: boolean,
  now: Date = new Date(),
): CardFieldErrors {
  const errors: CardFieldErrors = {};
  if (!input.currency) errors.currency = "required";
  const digits = cardDigits(input.cardNumber);
  if (!digits) errors.cardNumber = "required";
  else if (!cardNumberValid(digits)) errors.cardNumber = "invalid";
  if (!input.expiry.trim()) errors.expiry = "required";
  else {
    const exp = parseExpiry(input.expiry);
    if (!exp) errors.expiry = "invalid";
    else if (isExpired(exp.month, exp.year, now)) errors.expiry = "expired";
  }
  if (requiresBirthDate) {
    if (!input.birthDate) errors.birthDate = "required";
    else if (!birthDateValid(input.birthDate)) errors.birthDate = "invalid";
  }
  return errors;
}
