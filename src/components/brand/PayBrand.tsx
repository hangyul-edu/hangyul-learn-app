import { useTranslation } from "../../i18n";
import tossPayLogo from "../../assets/brand/toss-pay-logo.png";
import naverPayLogo from "../../assets/brand/naver-pay-logo.png";

/**
 * Easy-payment provider marks for the Payment Method Management screen.
 *
 * Both are the artwork Figma itself ships: SET-002 places the providers as
 * raster image fills (`TossPay_Logo_Primary 1` 1332:22027 and `자산 1 1`
 * 1332:22038), so these are those exports, trimmed to their opaque bounds and
 * downscaled. The rendered sizes are the ones measured off the frame — Toss Pay
 * 97x19 and Naver Pay 61x21 — and live in `.paybrand--*` so every call site
 * stays size-free.
 */

/** Toss Pay — 1332:22027, drawn 97x19 at (78, 474) in SET-002. */
export function TossPayLogo() {
  const { t } = useTranslation();
  return <img className="paybrand paybrand--toss" src={tossPayLogo} alt={t("misc.tossPay")} />;
}

/** Naver Pay — 1332:22038, drawn 61x21 at (76, 553) in SET-002. */
export function NaverPayLogo() {
  const { t } = useTranslation();
  return <img className="paybrand paybrand--naver" src={naverPayLogo} alt={t("misc.naverPay")} />;
}
