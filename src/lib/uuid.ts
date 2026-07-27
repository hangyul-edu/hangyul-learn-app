/**
 * Random id generator that works in non-secure browsing contexts.
 *
 * `crypto.randomUUID()` only exists in a *secure context* (HTTPS or
 * localhost). On a plain-HTTP origin — e.g. a dev/preview server reached by IP
 * like `http://10.0.0.5:5173` — it is `undefined`, so calling it throws
 * "crypto.randomUUID is not a function". This helper uses it when available and
 * otherwise falls back to `getRandomValues` (still cryptographically random),
 * then to `Math.random` as a last resort, so id generation never crashes.
 */
export function randomUuid(): string {
  const c: Crypto | undefined = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  if (c && typeof c.getRandomValues === "function") {
    const b = c.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40; // version 4
    b[8] = (b[8] & 0x3f) | 0x80; // variant 10
    const h = Array.from(b, (x) => x.toString(16).padStart(2, "0"));
    return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`;
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
