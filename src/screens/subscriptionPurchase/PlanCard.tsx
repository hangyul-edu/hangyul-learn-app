import { T, useTranslation } from "../../i18n";
import { formatMoney } from "../../lib/format";
import type { Plan } from "../../lib/types";
import payRadioOn from "../../assets/brand/pay-radio-on.svg";
import payRadioOff from "../../assets/brand/pay-radio-off.svg";

/** Plan amounts are minor units: cents for USD, whole won for KRW (no minor
 *  unit) — dividing every currency by 100 showed ₩15,000 as ₩150. */
function money(cents: number, currency = "USD", language?: string): string {
  // SET-030 / SET-032 draw the plan prices with a bare "$" ("$5.99/mo") and,
  // in Korean, won after the number ("9,900원/월").
  return formatMoney(Math.round(cents), currency.toUpperCase(), { narrow: true, language });
}
/** Displayed amounts: the server's presentation values (original/current
 *  totals, monthly equivalents, discount %). GET /subscriptions/offers computes
 *  them on every plan, the member's new-member price included, so nothing is
 *  derived here. */
export function pricing(p: Plan) {
  return {
    isYear: p.interval === "year",
    original: p.original_total_cents,
    current: p.current_total_cents,
    origMonthly: p.original_monthly_cents,
    curMonthly: p.current_monthly_cents,
    discountPct: p.discount_percent,
  };
}

/**
 * A plan card, laid out exactly as Figma SET-032 draws it (KO 898:19476 /
 * EN 898:19697, and identically in SET-030 apart from the trial copy):
 *
 *   annual  335x130, r16, 1px Brand border — the launch ribbon overhangs the
 *           top-left, the purple badge sits at (196, 25), the struck price is
 *           right-aligned at 310/54 and the final price at 308/75.
 *   monthly 335x90, r16, 1px Gray 3 — radio centred on the left, the black
 *           discount pill at (188, 20), struck price and current price
 *           right-aligned at 303.
 *
 * Neither authoritative frame carries a hand-drawn arrow across the card, so
 * there is none here. All amounts come from the plan API (never hardcoded),
 * and so does the ribbon: it is the badge an admin published on the plan, on
 * either card. Without a discount there is nothing to strike through, so the
 * discount pill and the struck list price are left out.
 */
export function PlanCard({ plan, selected, onSelect }: { plan: Plan; selected: boolean; onSelect: () => void }) {
  const { t, language } = useTranslation();
  const price = (cents: number) => money(cents, plan.currency, language);
  const { isYear, original, current, origMonthly, curMonthly, discountPct } = pricing(plan);
  const discounted = discountPct > 0;
  const ribbon = plan.badge ? plan.badge[language] || plan.badge.en : "";
  const term = t(isYear ? "purchase.planYear" : "purchase.planMonth");
  const sel = selected ? t("purchase.selectedSuffix") : "";
  const label = isYear
    ? t("purchase.planYearA11y", {
        selected: sel,
        monthly: price(curMonthly),
        total: price(current),
      })
    : t("purchase.planMonthA11y", { selected: sel, monthly: price(curMonthly) });
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      className={`plan plan--${isYear ? "annual" : "monthly"}${ribbon ? " plan--ribboned" : ""}${selected ? " plan--on" : ""}`}
      onClick={onSelect}
    >
      {ribbon && (
        /* Rectangle 4985, as wide as its label (global.css .plan__ribbon). */
        <span className="plan__ribbon">
          <span className="plan__ribbon-text">{ribbon}</span>
        </span>
      )}

      <span className="plan__label">
        <img className="plan__radio" src={selected ? payRadioOn : payRadioOff} alt="" aria-hidden="true" />
        <span className="plan__term">{term}</span>
      </span>

      {isYear ? (
        <>
          {discounted && (
            <>
              <span className="plan__badge plan__badge--purple">
                <T k="purchase.discountedPrice" vars={{ pct: discountPct }} strongClass="plan__badge-hl" />
              </span>
              <span className="plan__orig-line">
                <s>{t("purchase.perMonthPriceWithTotal", { price: price(origMonthly), total: price(original) })}</s>
              </span>
            </>
          )}
          <span className="plan__final">
            <span className="plan__final-main">{price(curMonthly)}</span>
            <span className="plan__final-per">{t("purchase.perMonth")}</span>
            <span className="plan__final-total">({price(current)})</span>
          </span>
        </>
      ) : (
        <>
          {/* Badge and original price share one right-anchored row, so the badge
              stays flush against the price whatever width the label takes. The
              rule runs through the whole price, suffix included. */}
          {discounted && (
            <span className="plan__month-row">
              <span className="plan__badge plan__badge--black">
                {t("purchase.discountPct", { pct: discountPct })}
              </span>
              <span className="plan__orig-month">
                <s>
                  {price(origMonthly)}
                  {t("purchase.perMonth")}
                </s>
              </span>
            </span>
          )}
          <span className="plan__month-cur">
            <span className="plan__final-main">{price(curMonthly)}</span>
            <span className="plan__final-per">{t("purchase.perMonth")}</span>
          </span>
        </>
      )}
    </button>
  );
}
