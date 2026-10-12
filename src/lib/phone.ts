/**
 * Phone numbers: the country list behind every country-code picker, checking
 * and normalising what the user typed, and hashing for friend discovery.
 *
 * Country rules — every calling code, number lengths, trunk prefixes (Korea's
 * `0` in `010…` is dropped after `+82`, Italy's `0` in `06…` is kept), which
 * ranges are mobile — come from libphonenumber's metadata, the same data the
 * server's `phonenumbers` uses, so both produce the identical E.164 string.
 *
 * The `mobile` metadata build is used: every number entered here must take
 * an SMS (or, for friend search, belongs to an account that verified one), so
 * "valid" means "a valid mobile number". It is ~16 KB gzipped smaller than
 * `max`; a landline therefore reads as invalid rather than as a distinct
 * case, and the server refuses non-mobile ranges again on its own.
 */
import {
  getCountries,
  getCountryCallingCode,
  isSupportedCountry,
  parsePhoneNumberFromString,
  validatePhoneNumberLength,
  type CountryCode,
  type PhoneNumber,
} from "libphonenumber-js/mobile";
// The per-type length ranges aren't exposed by the helpers; the same metadata
// read through `Metadata` has them (one copy is bundled — `mobile` imports
// this file too).
import { Metadata } from "libphonenumber-js/core";
import mobileMetadata from "libphonenumber-js/metadata.mobile.json";

export type { CountryCode };

export interface PhoneCountry {
  /** ISO 3166-1 alpha-2 (plus libphonenumber's AC / TA / XK). */
  code: CountryCode;
  /** "+82" */
  dial: string;
  flag: string;
}

/** Regional-indicator flag emoji for an ISO code ("KR" → 🇰🇷). */
function flagOf(code: string): string {
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** Every country and territory with its own calling-code metadata (~245). */
export const PHONE_COUNTRIES: PhoneCountry[] = getCountries().map((code) => ({
  code,
  dial: `+${getCountryCallingCode(code)}`,
  flag: flagOf(code),
}));

const BY_CODE = new Map(PHONE_COUNTRIES.map((c) => [c.code as string, c]));

/** The pickers' default, and the fallback for an unknown/legacy stored code. */
export const DEFAULT_PHONE_COUNTRY: CountryCode = "KR";

export function isPhoneCountry(code: string | null | undefined): code is CountryCode {
  return !!code && BY_CODE.has(code);
}

/** The picker entry for `code`, falling back to the default country. */
export function phoneCountry(code: string | null | undefined): PhoneCountry {
  return BY_CODE.get(code ?? "") ?? BY_CODE.get(DEFAULT_PHONE_COUNTRY)!;
}

/**
 * What the phone input keeps of a keystroke or paste: digits, plus a `+` only
 * in front. Spaces, dashes, dots and brackets from a pasted
 * "+82 (10) 1234-5678" are dropped; the length is capped generously (an IDD
 * prefix plus the 15-digit E.164 maximum) so a paste is never cut short.
 */
export function sanitizePhoneInput(raw: string): string {
  const trimmed = raw.trim();
  const plus = trimmed.startsWith("+") || trimmed.startsWith("＋") ? "+" : "";
  return plus + trimmed.replace(/\D/g, "").slice(0, 18);
}

export type PhoneProblem = "empty" | "tooShort" | "tooLong" | "invalid";

export type PhoneCheck =
  | {
      ok: true;
      /** Canonical E.164, e.g. "+821012345678". */
      e164: string;
      /** The number's own country — may differ from the picker (see `adoptCountry`). */
      country: CountryCode | undefined;
    }
  | { ok: false; problem: PhoneProblem };

const metadata = new Metadata(mobileMetadata);

interface NumberingPlanWithTypes {
  possibleLengths(): number[];
  type(name: "MOBILE"): { possibleLengths(): number[] } | undefined;
}

/**
 * Why an invalid number is invalid. Lengths are judged against the country's
 * *mobile* numbers: the general lengths include short service codes, so they
 * would call almost any stub "possible" (Korea allows 5-digit numbers).
 */
function lengthProblem(value: string, region: CountryCode, parsed: PhoneNumber | undefined): PhoneProblem {
  const general = validatePhoneNumberLength(value, region);
  if (general === "TOO_LONG") return "tooLong";
  if (!parsed) return general === "TOO_SHORT" || general === "NOT_A_NUMBER" ? "tooShort" : "invalid";
  const plan = parsed.country ?? region;
  if (!isSupportedCountry(plan)) return "invalid";
  metadata.selectNumberingPlan(plan);
  // `type()` exists at runtime but is missing from the published typings.
  const numbering = metadata.numberingPlan as unknown as NumberingPlanWithTypes | undefined;
  const mobile = numbering?.type("MOBILE")?.possibleLengths() ?? numbering?.possibleLengths();
  if (!mobile?.length) return "invalid";
  const digits = parsed.nationalNumber.length;
  if (digits < Math.min(...mobile)) return "tooShort";
  if (digits > Math.max(...mobile)) return "tooLong";
  return "invalid";
}

/**
 * Check what the user typed against the selected country.
 *
 * Accepts a national number with or without its trunk prefix ("010…" or
 * "10…"), a full international number ("+44…"), or one dialled with the
 * selected country's international prefix ("0044…" from Germany). Valid
 * means a valid *mobile* number (see the module note).
 */
export function checkPhone(country: string, input: string): PhoneCheck {
  const value = sanitizePhoneInput(input);
  if (!value.replace("+", "")) return { ok: false, problem: "empty" };
  const region = phoneCountry(country).code;
  const parsed = parsePhoneNumberFromString(value, region);
  if (!parsed || !parsed.isValid()) return { ok: false, problem: lengthProblem(value, region, parsed) };
  return { ok: true, e164: parsed.number, country: parsed.country };
}

/**
 * When the user typed or pasted an international number for a different
 * calling code than the picker shows ("+44 7911…" with 🇰🇷 selected), the
 * picker should follow the number. Returns the country to switch to and the
 * national digits to leave in the field, or null when nothing should change.
 *
 * Only a different *calling code* moves the picker: a Canadian number typed
 * nationally with 🇺🇸 selected stays on US (both are +1), since the picker
 * also records the user's nationality.
 */
export function adoptCountry(country: string, input: string): { country: CountryCode; national: string } | null {
  const value = sanitizePhoneInput(input);
  if (!value.startsWith("+")) return null;
  const parsed = parsePhoneNumberFromString(value);
  if (!parsed || !parsed.isValid() || !parsed.country) return null;
  const national = parsed.formatNational().replace(/\D/g, "");
  if (parsed.countryCallingCode === getCountryCallingCode(phoneCountry(country).code)) {
    return { country: phoneCountry(country).code, national };
  }
  return { country: parsed.country, national };
}

/**
 * The phone field's next state after a keystroke or paste: the sanitised text,
 * or — for a complete international number with another calling code — the
 * number's country and its national digits (see `adoptCountry`).
 */
export function applyPhoneInput(country: string, raw: string): { country: string; input: string } {
  const adopted = adoptCountry(country, raw);
  if (adopted) return { country: adopted.country, input: adopted.national };
  return { country, input: sanitizePhoneInput(raw) };
}

/** A country's name in `language` (`Intl.DisplayNames`), or its ISO code
 *  where the runtime lacks region names. */
export function countryName(code: string, language: string): string {
  try {
    return new Intl.DisplayNames([language], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/**
 * Canonical E.164 for friend search: the checked number when it is valid,
 * otherwise a best effort (selected calling code + digits, trunk zeros
 * dropped) so a search is still sent rather than silently blocked.
 */
export function normalizeE164(country: string, raw: string): string {
  const checked = checkPhone(country, raw);
  if (checked.ok) return checked.e164;
  const value = sanitizePhoneInput(raw);
  if (value.startsWith("+")) return value;
  return `${phoneCountry(country).dial}${value.replace(/^0+/, "")}`;
}

/** Lowercase SHA-256 hex digest via Web Crypto (matches the server's hash_phone). */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Hash a phone input straight to the digest the discovery APIs expect. */
export function hashPhone(country: string, raw: string): Promise<string> {
  return sha256Hex(normalizeE164(country, raw));
}

/** Enough digits to be a plausible phone number — gates search submission. */
export function isLikelyPhone(raw: string): boolean {
  return raw.replace(/\D/g, "").length >= 7;
}

/**
 * Display a stored E.164 number: Korean numbers in the domestic style users
 * know (010-1234-5678), every other country in international format
 * (+1 415 555 0100). Anything unparseable is shown as stored.
 */
export function formatPhoneForDisplay(stored: string): string {
  const parsed = parsePhoneNumberFromString(stored);
  if (!parsed) return stored;
  return parsed.country === "KR" ? parsed.formatNational() : parsed.formatInternational();
}
