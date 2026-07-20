/**
 * Client-side phone-number normalization + hashing for the privacy-preserving
 * friend-discovery APIs.
 *
 * The backend never receives a plaintext number: the client normalizes to
 * E.164 (a leading `+` then digits) and SHA-256-hashes it, mirroring the
 * server's `normalize_e164` / `hash_phone`. Matching happens on the digest, so
 * both sides must produce the identical canonical string.
 */

/** Canonicalize a dialled input to `+<countrycode><national>` (E.164). */
export function normalizeE164(dial: string, raw: string): string {
  const dialDigits = dial.replace(/\D/g, "");
  const digits = raw.replace(/\D/g, "");
  // The user pasted a full international number (already carries the country
  // code) — don't prepend the dial a second time.
  if (dialDigits && digits.startsWith(dialDigits) && digits.length > dialDigits.length) {
    return `+${digits}`;
  }
  // Otherwise treat it as a national number: drop the trunk prefix (leading 0s)
  // and prepend the selected country's dial code.
  return `+${dialDigits}${digits.replace(/^0+/, "")}`;
}

/** Lowercase SHA-256 hex digest via Web Crypto (matches the server's hash_phone). */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Hash a dialled phone input straight to the digest the discovery APIs expect. */
export function hashPhone(dial: string, raw: string): Promise<string> {
  return sha256Hex(normalizeE164(dial, raw));
}

/** Enough digits to be a plausible phone number — gates search submission. */
export function isLikelyPhone(raw: string): boolean {
  return raw.replace(/\D/g, "").length >= 7;
}
