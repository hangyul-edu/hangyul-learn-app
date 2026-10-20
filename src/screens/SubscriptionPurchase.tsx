import { useNavigate } from "react-router-dom";
import { T, useTranslation } from "../i18n";
import payLetterG from "../assets/brand/pay-letter-g.svg";
import payLetterR from "../assets/brand/pay-letter-r.svg";
import payLetterB from "../assets/brand/pay-letter-b.svg";
import payLetterO from "../assets/brand/pay-letter-o.svg";
import { currencyLabel, currencyMismatchText } from "../lib/paymentErrors";
import { Spinner } from "../components/ui/Spinner";
import { TwoButtonAlert } from "../components/ui/TwoButtonAlert";
import { CloseIcon } from "../components/brand/Glyphs";
import { PlanCard } from "./subscriptionPurchase/PlanCard";
import { needsOverseasCard, usePurchase } from "./subscriptionPurchase/usePurchase";

/**
 * Server-driven subscription purchase screen. One component, two variants:
 * - free-trial-eligible account (`trial_available`) → the 7-day trial version.
 * - ineligible account → the direct-paid version.
 * Eligibility, plans, and payment-method status all come from the backend, which
 * is the source of truth (the client can never grant itself a trial). Starting a
 * trial/subscription requires a registered payment method — otherwise a popup
 * routes the user to registration and preserves the selected plan.
 */
export function SubscriptionPurchase() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const p = usePurchase();
  const block = p.currencyBlock;

  const ctaKey = p.eligible ? "purchase.startTrial" : "purchase.startNow";
  // The trial's length comes with the offers (`trial.days`), not from the copy.
  const vars = { days: p.trialDays };
  const ctaLabel = t(ctaKey, vars).replace(/<\/?s>/g, "");
  const ctaDisabled = p.status !== "ready" || !p.selectedId;

  return (
    <div className="subp">
      {/* Figma SET-030/032 — the soft top-left glow plus the four decorative
          Hangul letters. Exported artwork, not redrawn. */}
      <div className="subp__decor" aria-hidden="true">
        <span className="subp__glow" />
        <img className="subp__deco subp__deco--g" src={payLetterG} alt="" />
        <img className="subp__deco subp__deco--r" src={payLetterR} alt="" />
        <img className="subp__deco subp__deco--b" src={payLetterB} alt="" />
        <img className="subp__deco subp__deco--o" src={payLetterO} alt="" />
      </div>
      <button className="subp__close" onClick={() => nav(-1)} aria-label={t("purchase.close")}>
        <CloseIcon color="#9aa0a6" weight={2} />
      </button>

      <div className={`subp__body${p.eligible ? " subp__body--trial" : ""}`}>
        {p.status === "loading" ? (
          <div className="subp__loading" aria-busy="true">{t("purchase.loading")}</div>
        ) : p.status === "failed" ? (
          <div className="subp__error">
            <p>{t("purchase.loadError")}</p>
            <button className="btn btn--secondary btn--sm" onClick={p.retry}>
              {t("common.retry")}
            </button>
          </div>
        ) : (
          <>
            {p.eligible && <p className="subp__eyebrow">{t("purchase.eyebrow")}</p>}
            <h1 className="subp__headline">
              {t("purchase.heroLine1")}
              <br />
              {t("purchase.heroLine2")}
            </h1>
            <p className="subp__desc">{t("purchase.heroDesc")}</p>

            {p.status === "missing_plans" ? (
              <p className="subp__noplans" role="status">
                {t("purchase.noProducts")}
              </p>
            ) : (
              <div className="subp__plans" role="radiogroup" aria-label={t("purchase.productsTitle")}>
                {[...p.plans]
                  .sort((a, b) => (a.interval === "year" ? 0 : 1) - (b.interval === "year" ? 0 : 1))
                  .map((plan) => (
                    <PlanCard
                      key={plan.plan_id}
                      plan={plan}
                      selected={plan.plan_id === p.selectedId}
                      onSelect={() => p.setSelectedId(plan.plan_id)}
                    />
                  ))}
              </div>
            )}

            <button className="subp__cta" onClick={p.start} disabled={ctaDisabled} aria-label={ctaLabel}>
              {p.submitting ? (
                <Spinner size={22} />
              ) : (
                <T k={ctaKey} vars={vars} strongClass="subp__cta-hl" />
              )}
            </button>

            <p className="subp__cancel">{t("purchase.cancelAnytime")}</p>
            <p className="subp__note">
              {p.eligible
                ? t("purchase.trialNote", vars)
                : t("purchase.paidNote")}
            </p>
            <button className="subp__refund" onClick={() => nav("/policy/refund")}>
              {t("purchase.refundPolicy")}
            </button>
          </>
        )}
      </div>

      <TwoButtonAlert
        open={p.payModal}
        backdropCancels
        centered
        title={t("purchase.needMethodTitle")}
        body={
          <>
            {t("purchase.needMethodLine1")}
            <br />
            {t("purchase.needMethodLine2")}
          </>
        }
        cancelLabel={t("common.cancel")}
        confirmLabel={t("purchase.registerMethod")}
        onCancel={p.closePayModal}
        onConfirm={p.goRegisterPayment}
      />

      <TwoButtonAlert
        open={p.currencyBlock !== null}
        backdropCancels
        centered
        title={t("purchase.currencyTitle")}
        body={
          block &&
          (block.hasMatching
            ? t("purchase.currencySwitchDefault", { currency: currencyLabel(block.plan.currency, t) })
            : currencyMismatchText(block.card, block.plan.currency, t))
        }
        cancelLabel={t("common.cancel")}
        confirmLabel={t(block && needsOverseasCard(block) ? "purchase.currencyAddIntl" : "purchase.currencyManage")}
        onCancel={p.closeCurrencyBlock}
        onConfirm={p.goFixCurrency}
      />
    </div>
  );
}
