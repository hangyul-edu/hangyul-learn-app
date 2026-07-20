/**
 * Contact-hash provider for contact-based friend recommendations.
 *
 * The recommendation API matches SHA-256 hashes of the user's contact phone
 * numbers. Reading the address book is a native-platform capability: a native
 * wrapper may expose `window.hangyulContacts.getPhoneHashes()` (returning
 * already-normalized, on-device-hashed digests — raw numbers never leave the
 * device). On the plain web there is no reliable Contacts API, so this returns
 * an empty list and the sheet simply shows the "no recommendations" state with
 * the invitation-link CTA. Phone search still works without any contact access.
 */

interface ContactBridge {
  getPhoneHashes?: () => Promise<string[]> | string[];
}

declare global {
  interface Window {
    hangyulContacts?: ContactBridge;
  }
}

export async function getContactPhoneHashes(): Promise<string[]> {
  const bridge = typeof window !== "undefined" ? window.hangyulContacts : undefined;
  if (!bridge?.getPhoneHashes) return [];
  try {
    const hashes = await bridge.getPhoneHashes();
    return Array.isArray(hashes) ? hashes.filter((h) => typeof h === "string") : [];
  } catch {
    return [];
  }
}
