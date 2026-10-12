import { useCallback } from "react";
import { useTranslation, type TranslationKey } from "../i18n";
import { countryName, phoneCountry, type PhoneProblem } from "../lib/phone";

/**
 * The message for a phone number `checkPhone` refused, naming the selected
 * country and its calling code so a wrong country is easy to spot
 * ("…isn't a valid South Korea (+82) mobile number").
 */
export function usePhoneProblemMessage(): (country: string, problem: PhoneProblem) => string {
  const { t, language } = useTranslation();
  return useCallback(
    (country: string, problem: PhoneProblem) => {
      const c = phoneCountry(country);
      return t(`phoneInput.${problem}` as TranslationKey, { country: countryName(c.code, language), dial: c.dial });
    },
    [t, language],
  );
}
