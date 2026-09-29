import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sheet } from "./ui/Modal";
import { Button } from "./ui/kit";
import { TextField } from "./ui/Field";
import { SkeletonList } from "./ui/states";
import { payApi, type InternationalCardRegistration } from "../api/endpoints";
import { useTranslation, type TranslationKey } from "../i18n";
import {
  CARD_BRAND_NAMES,
  cardDigits,
  detectCardBrand,
  formatCardNumber,
  formatExpiryInput,
  parseExpiry,
  validateInternationalCard,
  type CardField,
  type CardFieldProblem,
} from "../lib/cardInput";
import { currencyLabel, intlCardError } from "../lib/paymentErrors";
import { randomUuid } from "../lib/uuid";
import type { PaymentMethod } from "../lib/types";

/** Options are not card data, so they may live in the query cache. */
export const INTL_OPTIONS_QK = ["intl-card-options"] as const;

const PROBLEM_KEY: Record<CardField, Partial<Record<CardFieldProblem, TranslationKey>>> = {
  currency: { required: "paymentMethods.intl.errors.currencyRequired" },
  cardNumber: {
    required: "paymentMethods.intl.errors.cardNumberRequired",
    invalid: "paymentMethods.intl.errors.cardNumberInvalid",
  },
  expiry: {
    required: "paymentMethods.intl.errors.expiryRequired",
    invalid: "paymentMethods.intl.errors.expiryInvalid",
    expired: "paymentMethods.intl.errors.expiryExpired",
  },
  birthDate: {
    required: "paymentMethods.intl.errors.birthRequired",
    invalid: "paymentMethods.intl.errors.birthInvalid",
  },
};

/**
 * The app's own form for an overseas-issued card (POST
 * /payment-methods/cards/international). Korean-issued cards never come here:
 * they use Toss's hosted window.
 *
 * PCI DSS (docs/payments/09-security.md §9.1) — this component is in scope:
 * - card fields live only in this component's state and are wiped the moment
 *   a submit starts (whatever the outcome) and whenever the sheet closes;
 * - the request is sent directly (no useMutation, whose cache would keep the
 *   variables) and nothing is logged, persisted, put in a URL or a toast;
 * - no CVC / PIN is asked for, and only the fields in the contract are sent;
 * - after success only the server's masked number is ever shown (in the list).
 */
export function InternationalCardSheet({
  open,
  onClose,
  preferredCurrency,
  onRegistered,
}: {
  open: boolean;
  onClose: () => void;
  /** Currency of the plan the member is on / buying; preselected when offered. */
  preferredCurrency?: string | null;
  onRegistered: (method: PaymentMethod) => void;
}) {
  const { t } = useTranslation();
  const optionsQ = useQuery({
    queryKey: INTL_OPTIONS_QK,
    queryFn: payApi.internationalCardOptions,
    enabled: open,
    staleTime: 0,
  });

  const [currency, setCurrency] = useState("");
  const [cardNumber, setCardNumber] = useState(""); // digits only
  const [expiry, setExpiry] = useState(""); // "MM/YY"
  const [birthDate, setBirthDate] = useState(""); // "YYMMDD"
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<CardField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [cleared, setCleared] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  // Set only after a response that never arrived (network / 502): the retry
  // must reuse it so Toss is not asked twice. Every other submit gets a new one.
  const retryKeyRef = useRef<string | null>(null);

  const clearCardFields = () => {
    setCardNumber("");
    setExpiry("");
    setBirthDate("");
  };

  // Closing wipes everything, card data first.
  useEffect(() => {
    if (open) return;
    clearCardFields();
    setFieldErrors({});
    setFormError(null);
    setCleared(false);
    setUnavailable(false);
    setCurrency("");
    retryKeyRef.current = null;
  }, [open]);

  const listed = optionsQ.data?.available ? optionsQ.data.currencies : [];
  // A live subscription binds the card to its plan's currency: offer only that.
  const required = optionsQ.data?.required_currency?.toUpperCase() ?? null;
  const offered = required ? listed.filter((o) => o.currency === required) : listed;
  const requiredMissing = !!required && listed.length > 0 && offered.length === 0;
  const preferred = required ?? preferredCurrency?.toUpperCase() ?? null;

  // Pick a currency once the options arrive (or when the current one vanished).
  useEffect(() => {
    if (!open || offered.length === 0) return;
    if (offered.some((o) => o.currency === currency)) return;
    const pick = offered.find((o) => o.currency === preferred) ?? offered[0];
    setCurrency(pick.currency);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, optionsQ.data, preferred]);

  const option = offered.find((o) => o.currency === currency);
  const requiresBirthDate = !!option?.requires_holder_birth_date;
  const brand = detectCardBrand(cardNumber);
  const brandListed =
    !brand || !option || option.accepted_brands.length === 0 || option.accepted_brands.includes(brand);

  function chooseCurrency(code: string) {
    if (code === currency) return;
    setCurrency(code);
    retryKeyRef.current = null; // another currency is another registration
    setFieldErrors((f) => ({ ...f, currency: undefined, birthDate: undefined }));
  }

  // Stable: the Sheet re-arms its Back-gesture history entry whenever this changes.
  const close = useCallback(() => {
    if (submittingRef.current) return;
    onClose();
  }, [onClose]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    const problems = validateInternationalCard({ currency, cardNumber, expiry, birthDate }, requiresBirthDate);
    const fields = Object.keys(problems) as CardField[];
    if (fields.length > 0) {
      const next: Partial<Record<CardField, string>> = {};
      for (const f of fields) {
        const key = PROBLEM_KEY[f][problems[f]!];
        if (key) next[f] = t(key);
      }
      setFieldErrors(next);
      return;
    }
    const exp = parseExpiry(expiry)!;
    const key = retryKeyRef.current ?? randomUuid();
    retryKeyRef.current = null;
    const body: InternationalCardRegistration = {
      client_idempotency_key: key,
      currency,
      card_number: cardDigits(cardNumber),
      expiry_month: exp.month,
      expiry_year: exp.year,
    };
    if (requiresBirthDate) body.holder_birth_date = birthDate;
    // The body is the only copy from here on; the form forgets the card now.
    clearCardFields();
    setFieldErrors({});
    setFormError(null);
    setCleared(false);
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const { method } = await payApi.registerInternationalCard(body);
      onRegistered(method);
    } catch (err) {
      const mapped = intlCardError(err, t);
      if (mapped.retrySameKey) retryKeyRef.current = key;
      if (mapped.kind === "unavailable") {
        setUnavailable(true);
        return;
      }
      if (mapped.kind === "currencies_changed") void optionsQ.refetch();
      if (mapped.suggestCurrency && offered.some((o) => o.currency === mapped.suggestCurrency)) {
        setCurrency(mapped.suggestCurrency);
      }
      // Under the field when it is on screen; otherwise (currency, or a birth
      // date this currency doesn't ask for) as the form-level message.
      const onScreen =
        mapped.field === "cardNumber" || mapped.field === "expiry" || (mapped.field === "birthDate" && requiresBirthDate);
      if (mapped.field && onScreen) setFieldErrors({ [mapped.field]: mapped.message });
      else setFormError(mapped.message);
      setCleared(true);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const showUnavailable =
    unavailable ||
    requiredMissing ||
    (optionsQ.isSuccess && (!optionsQ.data.available || optionsQ.data.currencies.length === 0));

  let content;
  if (optionsQ.isLoading) {
    content = <SkeletonList rows={3} height={48} />;
  } else if (optionsQ.isError) {
    content = (
      <div className="pm-intl__state">
        <p>{t("paymentMethods.intl.optionsError")}</p>
        <Button variant="secondary" block onClick={() => optionsQ.refetch()}>{t("common.retry")}</Button>
      </div>
    );
  } else if (showUnavailable) {
    content = (
      <div className="pm-intl__state" role="status">
        <p className="pm-intl__state-title">{t("paymentMethods.intl.unavailableTitle")}</p>
        <p className="pm-intl__state-text">
          {requiredMissing && !unavailable
            ? t("paymentMethods.intl.requiredUnavailable", { currency: currencyLabel(required, t) })
            : t("paymentMethods.intl.unavailableText")}
        </p>
        <Button variant="secondary" block onClick={close}>{t("common.confirm")}</Button>
      </div>
    );
  } else {
    content = (
      <form className="pm-intl" onSubmit={submit} noValidate>
        <p className="pm-intl__intro">{t("paymentMethods.intl.intro")}</p>

        <div className="field">
          <span className="field__label" id="pm-intl-currency">{t("paymentMethods.intl.currencyLabel")}</span>
          <div className="chiprow" role="radiogroup" aria-labelledby="pm-intl-currency">
            {offered.map((o) => (
              <button
                key={o.currency}
                type="button"
                role="radio"
                aria-checked={o.currency === currency}
                className={`chip ${o.currency === currency ? "is-active" : ""}`}
                onClick={() => chooseCurrency(o.currency)}
                disabled={submitting || !!required}
              >
                {currencyLabel(o.currency, t)}
              </button>
            ))}
          </div>
          {fieldErrors.currency ? (
            <span className="field__error">⚠ {fieldErrors.currency}</span>
          ) : currency ? (
            <span className="field__hint">
              {t("paymentMethods.intl.currencyHint", { currency: currencyLabel(currency, t) })}
              {required ? (
                <> {t("paymentMethods.intl.currencyRequired", { currency: currencyLabel(currency, t) })}</>
              ) : preferred === currency && (
                <> {t("paymentMethods.intl.currencyPreselected", { currency: currencyLabel(currency, t) })}</>
              )}
            </span>
          ) : null}
        </div>

        <TextField
          label={t("paymentMethods.intl.cardNumberLabel")}
          aria-label={t("paymentMethods.intl.cardNumberLabel")}
          name="cc-number"
          type="text"
          inputMode="numeric"
          autoComplete="cc-number"
          autoCorrect="off"
          spellCheck={false}
          maxLength={23}
          placeholder={t("paymentMethods.intl.cardNumberPlaceholder")}
          value={formatCardNumber(cardNumber)}
          onChange={(e) => {
            setCardNumber(cardDigits(e.target.value));
            setFieldErrors((f) => ({ ...f, cardNumber: undefined }));
          }}
          disabled={submitting}
          aria-invalid={!!fieldErrors.cardNumber}
          error={fieldErrors.cardNumber}
          hint={
            brand
              ? brandListed
                ? t("paymentMethods.intl.brandDetected", { brand: CARD_BRAND_NAMES[brand] })
                : t("paymentMethods.intl.brandNotListed", {
                    brand: CARD_BRAND_NAMES[brand],
                    currency: currencyLabel(currency, t),
                  })
              : undefined
          }
        />

        <TextField
          label={t("paymentMethods.intl.expiryLabel")}
          aria-label={t("paymentMethods.intl.expiryLabel")}
          name="cc-exp"
          type="text"
          inputMode="numeric"
          autoComplete="cc-exp"
          autoCorrect="off"
          spellCheck={false}
          maxLength={5}
          placeholder={t("paymentMethods.intl.expiryPlaceholder")}
          value={expiry}
          onChange={(e) => {
            setExpiry(formatExpiryInput(e.target.value));
            setFieldErrors((f) => ({ ...f, expiry: undefined }));
          }}
          disabled={submitting}
          aria-invalid={!!fieldErrors.expiry}
          error={fieldErrors.expiry}
        />

        {requiresBirthDate && (
          <TextField
            label={t("paymentMethods.intl.birthLabel")}
            aria-label={t("paymentMethods.intl.birthLabel")}
            name="holder-birth-date"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            placeholder={t("paymentMethods.intl.birthPlaceholder")}
            value={birthDate}
            onChange={(e) => {
              setBirthDate(e.target.value.replace(/\D/g, "").slice(0, 6));
              setFieldErrors((f) => ({ ...f, birthDate: undefined }));
            }}
            disabled={submitting}
            aria-invalid={!!fieldErrors.birthDate}
            error={fieldErrors.birthDate}
          />
        )}

        {(formError || cleared) && (
          <div className="pm-intl__error" role="alert">
            {formError && <p>{formError}</p>}
            {cleared && <p className="pm-intl__error-sub">{t("paymentMethods.intl.cleared")}</p>}
          </div>
        )}

        <p className="pm-intl__security">{t("paymentMethods.intl.security")}</p>

        <Button type="submit" block loading={submitting} disabled={submitting}>
          {t("paymentMethods.intl.submit")}
        </Button>
      </form>
    );
  }

  return (
    <Sheet open={open} onClose={close} title={t("paymentMethods.internationalCardTitle")}>
      {content}
    </Sheet>
  );
}
