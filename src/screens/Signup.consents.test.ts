/**
 * The optional consents must reach the signup API under the names it accepts.
 *
 * This is the frontend half of a bug that produced no error anywhere. The
 * screen sent the ticked boxes as `marketing_consent` /
 * `service_notification_consent` / `promotional_notification_consent` — names
 * the signup schema has no fields for — while hardcoding the accepted
 * `*_opt_in` fields to `false`. Pydantic ignores fields it does not declare,
 * so the request succeeded and the consent was simply dropped.
 *
 * The one that mattered is `service_notification_opt_in`: it seeds the
 * `service_notifications` flag, and the push fan-out returns early when that
 * is off. Every account was therefore created unable to receive a push. The
 * inbox row was still written, which is why the server looked healthy while
 * the 19:00 study reminder never arrived on anyone's phone.
 */
import { describe, expect, it } from "vitest";
import { consentPayload } from "../lib/signupAgreements";

const NONE = {
  age: true,
  terms: true,
  privacy: true,
  third: true,
  marketing: false,
  serviceNotice: false,
  adNotice: false,
};

describe("the consent payload", () => {
  it("sends a ticked service-notification box as the field that gates push", () => {
    // The single assertion this file exists for.
    expect(consentPayload({ ...NONE, serviceNotice: true })).toMatchObject({
      service_notification_opt_in: true,
    });
  });

  it("carries the other two optional consents too", () => {
    expect(consentPayload({ ...NONE, marketing: true, adNotice: true })).toMatchObject({
      marketing_opt_in: true,
      ad_notification_opt_in: true,
    });
  });

  it("passes an unticked box through as false rather than dropping it", () => {
    expect(consentPayload(NONE)).toEqual({
      marketing_opt_in: false,
      service_notification_opt_in: false,
      ad_notification_opt_in: false,
    });
  });

  it("uses only field names the signup API declares", () => {
    // The failure mode was a name the API silently ignores, so the key set is
    // pinned exactly: an extra or renamed key fails here rather than at 19:00
    // on somebody's phone.
    expect(Object.keys(consentPayload(NONE)).sort()).toEqual([
      "ad_notification_opt_in",
      "marketing_opt_in",
      "service_notification_opt_in",
    ]);
  });

  it("sends none of the dead `_consent` names", () => {
    const keys = Object.keys(consentPayload({ ...NONE, serviceNotice: true }));
    for (const dead of [
      "marketing_consent",
      "service_notification_consent",
      "promotional_notification_consent",
    ]) {
      expect(keys).not.toContain(dead);
    }
  });

  it("never hardcodes a consent, whatever the boxes say", () => {
    // Both directions, so a stubbed `false` cannot creep back in.
    const all = { ...NONE, marketing: true, serviceNotice: true, adNotice: true };
    expect(Object.values(consentPayload(all)).every(Boolean)).toBe(true);
    expect(Object.values(consentPayload(NONE)).some(Boolean)).toBe(false);
  });
});
