import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { payApi } from "../../api/endpoints";
import { useToast } from "../../hooks/toast";
import { useTranslation } from "../../i18n";
import { errorMessage } from "../../lib/http";
import { paymentErrorMessage } from "../../lib/paymentErrors";
import {
  hasReturnParams,
  parseRegistrationReturn,
  savePendingRegistration,
  takePendingRegistration,
} from "../../lib/paymentReturn";
import { isUserCancel, requestEasyPayBillingAuth, requestTossBillingAuth } from "../../lib/tossPayments";
import { PURCHASE_PATH, rememberReturnTo, takeReturnTo, type ReturnTo } from "./returnTo";
import { METHODS_QK } from "./useRecoveryRetry";

const RETURN_URL = () => window.location.origin + "/account/payment";

/* The manual registration entry, used only when the provider's window is not
   configured (local dev with the fake provider): the member pastes the value
   the window would have returned. */
export type Flow = {
  title: string;
  placeholder: string;
  confirm: (token: string) => Promise<void>;
};

/**
 * Registering a method: a domestic card or a Korean wallet in the provider's
 * window (and the return from it), an overseas card in the app's own form,
 * and the manual entry when no window is configured. Arriving from the
 * purchase screen, a registration leads back to it.
 */
export function useRegistration() {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  // Arriving from the purchase screen: where to go back to once a method is
  // registered, and maybe a request to open the overseas-card form at once.
  const navState = location.state as (ReturnTo & { addCard?: string }) | null;

  const [intlOpen, setIntlOpen] = useState(navState?.addCard === "international");
  const [flow, setFlow] = useState<Flow | null>(null);
  const [token, setToken] = useState("");
  const [starting, setStarting] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: METHODS_QK });
  /** After a registration: back to the purchase screen when that is where the
   *  member came from. Without a window in between, its history entry is the
   *  one right behind this (it keeps the plan there), so step back rather than
   *  stack a second copy its close button would land on. */
  const backToPurchase = (returnTo: ReturnTo | null, viaWindow = false) => {
    if (returnTo?.from !== PURCHASE_PATH) return;
    if (!viaWindow) navigate(-1);
    else navigate(PURCHASE_PATH, { replace: true, state: { selectedPlanId: returnTo.selectedPlanId ?? null } });
  };

  /* --- return from a provider's registration window --- */
  const handledReturn = useRef(false);
  useEffect(() => {
    if (handledReturn.current || !hasReturnParams(location.search)) return;
    handledReturn.current = true;
    const search = location.search;
    // Drop the provider's parameters so a reload does not confirm again.
    navigate({ pathname: location.pathname }, { replace: true, state: location.state });
    const returnTo = takeReturnTo();
    const pending = takePendingRegistration();
    if (!pending) return;
    const ret = parseRegistrationReturn(pending, search);
    if (!ret) return;
    if (ret.kind === "failed") {
      // Closing the window is the member's choice, not an error.
      if (ret.code === "PAY_PROCESS_CANCELED" || ret.code === "USER_CANCEL") return;
      toast.error(ret.message || t("paymentMethods.registerFailed"));
      return;
    }
    setConfirming(true);
    const confirm =
      pending.provider === "toss_pay"
        ? payApi.tosspayConfirm
        : pending.provider === "naver_pay"
          ? payApi.naverpayConfirm
          : payApi.cardConfirm;
    confirm(pending.intentId, { authKey: ret.authKey, customerKey: ret.customerKey })
      .then(() => {
        toast.success(t("paymentMethods.registered"));
        invalidate();
        backToPurchase(returnTo, true);
      })
      .catch((e) => toast.error(errorMessage(e)))
      .finally(() => setConfirming(false));
    // Runs once per arrival; the handled flag guards StrictMode's re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  async function start(key: string, open: () => Promise<Flow | null>) {
    if (starting) return; // prevent duplicate launches
    setStarting(key);
    try {
      setToken("");
      setFlow(await open());
    } catch (e) {
      // e.g. payment_method.currency_mismatch: a KRW method while on a USD plan.
      toast.error(paymentErrorMessage(e));
    } finally {
      setStarting(null);
    }
  }

  /* Korean-issued cards: Toss's hosted billing window (it takes only domestic
     cards). Overseas cards use the app's own form — InternationalCardSheet. */
  const startDomesticCard = () =>
    start("card-domestic", async () => {
      const res = await payApi.cardIntent(RETURN_URL());
      if (res.widget.client_key) {
        // Toss opens its window through the SDK and returns to this page.
        savePendingRegistration({ provider: "toss_card", intentId: res.intent_id, customerKey: res.customer_key });
        rememberReturnTo(navState);
        try {
          await requestTossBillingAuth({
            clientKey: res.widget.client_key,
            customerKey: res.customer_key,
            successUrl: res.widget.success_url,
            failUrl: res.widget.fail_url,
          });
        } catch (e) {
          if (isUserCancel(e)) return null; // the member closed the window
          throw e;
        }
        return null;
      }
      // No client key (card billing not configured, e.g. local dev with the
      // fake provider): only the manual entry remains.
      return {
        title: t("paymentMethods.domesticCardTitle"),
        placeholder: t("paymentMethods.authKeyPlaceholder"),
        confirm: (key) =>
          payApi.cardConfirm(res.intent_id, { authKey: key, customerKey: res.customer_key }).then(() => undefined),
      };
    });

  /* Toss Pay / Naver Pay: the wallet's own window, opened by Toss's SDK
     (flowMode DIRECT), returning here like the card window. */
  const startWallet = (provider: "toss_pay" | "naver_pay") =>
    start(provider, async () => {
      const res =
        provider === "toss_pay" ? await payApi.tosspayIntent(RETURN_URL()) : await payApi.naverpayIntent(RETURN_URL());
      const confirm = provider === "toss_pay" ? payApi.tosspayConfirm : payApi.naverpayConfirm;
      if (res.window.client_key) {
        savePendingRegistration({ provider, intentId: res.intent_id, customerKey: res.customer_key });
        rememberReturnTo(navState);
        try {
          await requestEasyPayBillingAuth({
            clientKey: res.window.client_key,
            customerKey: res.customer_key,
            successUrl: res.window.success_url,
            failUrl: res.window.fail_url,
            easyPay: res.window.easy_pay,
          });
        } catch (e) {
          if (isUserCancel(e)) return null;
          throw e;
        }
        return null;
      }
      // Not configured on this server (local dev with the fake provider):
      // only the manual entry remains.
      return {
        title: t(provider === "toss_pay" ? "paymentMethods.tossPay" : "paymentMethods.naverPay"),
        placeholder: t("paymentMethods.authKeyPlaceholder"),
        confirm: (key) => confirm(res.intent_id, { authKey: key, customerKey: res.customer_key }).then(() => undefined),
      };
    });

  // Stable: the sheet's effects depend on it.
  const closeIntl = useCallback(() => setIntlOpen(false), []);
  const intlRegistered = () => {
    setIntlOpen(false);
    toast.success(t("paymentMethods.registered"));
    void invalidate();
    backToPurchase(navState);
  };

  async function confirmFlow() {
    if (!flow || !token.trim() || confirming) return;
    setConfirming(true);
    try {
      await flow.confirm(token.trim());
      setFlow(null);
      setToken("");
      toast.success(t("paymentMethods.registered"));
      invalidate();
      backToPurchase(navState);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setConfirming(false);
    }
  }

  return {
    starting,
    confirming,
    flow,
    closeFlow: () => !confirming && setFlow(null),
    token,
    setToken,
    confirmFlow,
    startDomesticCard,
    startWallet,
    intlOpen,
    openIntl: () => setIntlOpen(true),
    closeIntl,
    intlRegistered,
  };
}
