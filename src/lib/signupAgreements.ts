import type { TranslationKey } from "../i18n";
import { TERMS_OF_SERVICE, type PolicyId } from "./policies";

/**
 * The signup agreements, shared by email signup and the social signup's terms
 * screen so both ask for exactly the same items in the same words.
 */
export type AgreeKey = "age" | "terms" | "privacy" | "third" | "marketing" | "serviceNotice" | "adNotice";
export type Agreements = Record<AgreeKey, boolean>;

/** The four required consents gate signup; the three optional ones do not.
 *  All seven are listed in Figma AME-004 (215:6769 / 784:55065). */
export const REQUIRED_AGREEMENTS: AgreeKey[] = ["age", "terms", "privacy", "third"];
export const AGREEMENTS: { key: AgreeKey; label: TranslationKey; underline?: boolean; doc?: PolicyId }[] = [
  { key: "age", label: "signup.agreeAge" },
  // The same document the Terms & Policies page shows — not a signup-only copy.
  { key: "terms", label: "signup.agreeTerms", underline: true, doc: TERMS_OF_SERVICE },
  { key: "privacy", label: "signup.agreePrivacy", doc: "privacy" },
  { key: "third", label: "signup.agreeThird", doc: "third-party" },
  { key: "marketing", label: "signup.agreeMarketing" },
  { key: "serviceNotice", label: "signup.agreeServiceNotice" },
  { key: "adNotice", label: "signup.agreeAdNotice" },
];

export const NO_AGREEMENTS: Agreements = {
  age: false, terms: false, privacy: false, third: false,
  marketing: false, serviceNotice: false, adNotice: false,
};

/**
 * The three optional consents, in the field names the signup API accepts.
 *
 * Extracted so the mapping can be tested on its own, because getting it wrong
 * is silent: the API ignores fields it does not declare, so a misnamed consent
 * is dropped without an error and the account is created as if the box were
 * never ticked. That is what happened — these went out as `*_consent`, which
 * the schema has no fields for, while the accepted `*_opt_in` names were
 * hardcoded false. `service_notification_opt_in` seeds the service-notifications
 * toggle the push fan-out gates on, so every account was created unable to
 * receive a push.
 */
export function consentPayload(agree: Agreements) {
  return {
    marketing_opt_in: agree.marketing,
    service_notification_opt_in: agree.serviceNotice,
    ad_notification_opt_in: agree.adNotice,
  };
}

/** All seven agreements in the API's field names. */
export function agreementPayload(agree: Agreements) {
  return {
    age_consent: agree.age,
    terms_accepted: agree.terms,
    privacy_accepted: agree.privacy,
    third_party_accepted: agree.third,
    ...consentPayload(agree),
  };
}
