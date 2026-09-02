import type { TranslationKey } from "../i18n";
/**
 * The five FAQ categories shown on the (hardcoded) landing screen.
 *
 * Only the landing labels + order are hardcoded — everything after it (the
 * questions, search results, answers) is loaded from the backend. Each card
 * maps to a stable backend category slug (see the support module's
 * `FaqCategory` literal); the label is only a display string and is never
 * used as the API key.
 *
 * The backend also defines a `learning_features` category. It has no dedicated
 * landing card by product decision, but its entries still surface through
 * full-dataset search.
 */
export interface FaqCategory {
  /** Backend category identifier — the API key. */
  slug: string;
  /** Emoji shown on the left of the card / heading. */
  emoji: string;
  /** Catalog key for the display label. Presentation only. */
  label: TranslationKey;
}

export const FAQ_CATEGORIES: FaqCategory[] = [
  { slug: "getting_started", emoji: "🚀", label: "faq.catHowTo" },
  { slug: "payments_subscriptions_refunds", emoji: "💳", label: "faq.catBilling" },
  { slug: "account_settings", emoji: "⚙️", label: "faq.catAccount" },
  { slug: "errors_troubleshooting", emoji: "🛠️", label: "faq.catError" },
  { slug: "other", emoji: "💼", label: "faq.catPartnership" },
];

export function findFaqCategory(slug: string | null | undefined): FaqCategory | undefined {
  if (!slug) return undefined;
  return FAQ_CATEGORIES.find((c) => c.slug === slug);
}
