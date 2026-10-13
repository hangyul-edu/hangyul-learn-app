import { useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { subApi } from "../api/endpoints";
import { useTranslation } from "../i18n";
import { useToast } from "../hooks/toast";
import { ApiError } from "../lib/http";
import { formatLongDate, formatMoney } from "../lib/format";
import { currencyLabel, paymentErrorMessage } from "../lib/paymentErrors";
import { PHONE_COUNTRIES, countryName } from "../lib/phone";
import type { BillingCountryState } from "../lib/types";
import { ConfirmDialog, Sheet } from "./ui/Modal";
import { Button } from "./ui/kit";

/** The web billing currency of a country, as the server decides it
 *  (subscriptions/domain/billing_country.web_currency_for). Only used to
 *  label the list; prices always come from the server. */
export function webCurrencyFor(country: string): string {
  return country.toUpperCase() === "KR" ? "KRW" : "USD";
}

/** What a billing-country change would leave as it is, from the server's
 *  409 billing_country.confirmation_required. */
interface KeepNotice {
  country: string;
  newCurrency: string;
  currency: string;
  amount: number | null;
  nextBillingAt: string | null;
}

/**
 * Saving a billing country. When the member's running subscription is billed
 * in another currency the server refuses until they acknowledge that the
 * subscription keeps its currency, price and renewal date; `dialog` explains
 * exactly that and sends the acknowledgement only on their explicit "yes".
 */
export function useSaveBillingCountry(onSaved?: (state: BillingCountryState) => void) {
  const { t, language } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [keep, setKeep] = useState<KeepNotice | null>(null);

  async function save(country: string, acknowledge = false): Promise<boolean> {
    setSaving(true);
    try {
      const state = await subApi.setBillingCountry(country, acknowledge);
      setKeep(null);
      qc.setQueryData(["billing-country"], state);
      qc.invalidateQueries({ queryKey: ["sub-offers"] });
      qc.invalidateQueries({ queryKey: ["billing-country"] });
      toast.success(t("billingCountry.saved"));
      onSaved?.(state);
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.code === "billing_country.confirmation_required") {
        const d = e.details ?? {};
        setKeep({
          country,
          newCurrency: String(d.new_currency ?? webCurrencyFor(country)),
          currency: String(d.subscription_currency ?? ""),
          amount: typeof d.renewal_amount_cents === "number" ? d.renewal_amount_cents : null,
          nextBillingAt: typeof d.next_billing_at === "string" ? d.next_billing_at : null,
        });
      } else if (e instanceof ApiError && e.code === "billing_country.unsupported") {
        toast.error(t("billingCountry.unsupported"));
      } else {
        toast.error(paymentErrorMessage(e));
      }
      return false;
    } finally {
      setSaving(false);
    }
  }

  const dialog: ReactNode = (
    <ConfirmDialog
      open={!!keep}
      title={t("billingCountry.keepTitle")}
      text={
        keep && (
          <>
            {t("billingCountry.keepBody1", {
              country: countryName(keep.country, language),
              newCurrency: currencyLabel(keep.newCurrency, t),
            })}
            <br />
            {t("billingCountry.keepBody2", {
              currency: currencyLabel(keep.currency, t),
              amount: keep.amount !== null ? formatMoney(keep.amount, keep.currency) : "-",
              date: formatLongDate(keep.nextBillingAt, language) || "-",
            })}
            <br />
            {t("billingCountry.keepBody3")}
          </>
        )
      }
      confirmLabel={t("billingCountry.keepConfirm")}
      loading={saving}
      onConfirm={() => keep && void save(keep.country, true)}
      onCancel={() => setKeep(null)}
    />
  );

  return { save, saving, dialog };
}

/**
 * Choose the billing country: every country, in the app language's order,
 * searchable by name (app language or English) or ISO code, each labelled
 * with the currency it is billed in. Saving goes through
 * `useSaveBillingCountry`, so a running subscription in another currency is
 * explained and confirmed first.
 */
export function BillingCountrySheet({
  open,
  current,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** The confirmed or suggested country to start from. */
  current: string | null;
  onClose: () => void;
  onSaved?: (state: BillingCountryState) => void;
}) {
  const { t, language } = useTranslation();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const { save, saving, dialog } = useSaveBillingCountry((state) => {
    setPicked(null);
    setQuery("");
    onSaved?.(state);
    onClose();
  });
  const selected = picked ?? current;

  const entries = useMemo(
    () =>
      PHONE_COUNTRIES.map(({ code }) => {
        const name = countryName(code, language);
        return { code, name, haystack: `${name} ${countryName(code, "en")} ${code}`.toLowerCase() };
      }).sort((a, b) => a.name.localeCompare(b.name, language)),
    [language],
  );
  const q = query.trim().toLowerCase();
  const visible = q ? entries.filter((e) => e.haystack.includes(q)) : entries;

  return (
    <>
      <Sheet open={open} onClose={saving ? () => undefined : onClose} title={t("billingCountry.sheetTitle")}>
        <p className="bcs__hint">{t("billingCountry.sheetHint")}</p>
        <input
          className="country-select__search bcs__search"
          type="search"
          value={query}
          placeholder={t("billingCountry.search")}
          aria-label={t("billingCountry.search")}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ul className="bcs__list" role="listbox" aria-label={t("billingCountry.sheetTitle")}>
          {visible.length === 0 && <li className="bcs__empty">{t("billingCountry.noResults")}</li>}
          {visible.map((e) => (
            <li key={e.code} role="option" aria-selected={e.code === selected}>
              <button
                type="button"
                className={`bcs__item${e.code === selected ? " is-selected" : ""}`}
                onClick={() => setPicked(e.code)}
              >
                <span className="bcs__name">{e.name}</span>
                <span className="bcs__currency">{webCurrencyFor(e.code)}</span>
              </button>
            </li>
          ))}
        </ul>
        {selected && (
          <p className="bcs__chosen" role="status">
            {countryName(selected, language)} ·{" "}
            {t("billingCountry.currencyFor", { currency: currencyLabel(webCurrencyFor(selected), t) })}
          </p>
        )}
        <Button block loading={saving} disabled={!selected} onClick={() => selected && void save(selected)}>
          {t("billingCountry.save")}
        </Button>
      </Sheet>
      {dialog}
    </>
  );
}
