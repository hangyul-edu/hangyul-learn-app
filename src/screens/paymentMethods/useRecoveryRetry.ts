import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { billingApi } from "../../api/endpoints";
import { useAuth } from "../../hooks/auth";
import { useToast } from "../../hooks/toast";
import { useTranslation } from "../../i18n";
import { ApiError, errorMessage, isNotFound } from "../../lib/http";
import { formatRetryAt, retryBlockedKey, retryRefusal } from "../../lib/paymentRecovery";

export const METHODS_QK = ["payment-methods"] as const;
const RECOVERY_QK = ["payment-recovery"] as const;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type ResultModal = { kind: "success" } | { kind: "failure"; failureClass?: string | null } | null;

/** A retry the server refused (retry limits, a method it cannot charge); `message` is the explanation. */
class RetryRefusedError extends Error {}

/**
 * Recovering a failed automatic payment: the notice (shown whenever a payment
 * needs fixing), the pay-now retry and its authoritative result.
 */
export function useRecoveryRetry() {
  const { t, language } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const { bootstrapMe } = useAuth();
  const recoveryQ = useQuery({ queryKey: RECOVERY_QK, queryFn: billingApi.recovery });
  const [resultModal, setResultModal] = useState<ResultModal>(null);

  const invalidateMethods = () => qc.invalidateQueries({ queryKey: METHODS_QK });
  const invalidateRecovery = () => qc.invalidateQueries({ queryKey: RECOVERY_QK });

  const recovery = recoveryQ.data;
  // The notice stays up whenever a payment needs fixing; only the button
  // depends on whether a retry would be accepted now (the retry limits).
  const showNotice = !recoveryQ.isLoading && !!recovery?.recovery_required && !!recovery.outstanding_invoice_id;
  const canRetryNow = !!recovery?.can_retry_immediately;

  function blockedText(reason?: string | null, retryAfter?: string | null): string {
    return t(retryBlockedKey(reason), { time: formatRetryAt(retryAfter, language, t) || "—" });
  }
  const retryBlockedText =
    showNotice && !canRetryNow ? blockedText(recovery?.retry_blocked_reason, recovery?.retry_available_at) : "";

  // Determine the authoritative terminal result: the invoice being paid is the
  // ONLY success signal; a still-outstanding recovery is a failure; anything
  // else (e.g. provider timeout → payment_pending) is treated as pending.
  async function verifyRetry(invoiceId: string): Promise<ResultModal | "pending"> {
    for (let i = 0; i < 3; i++) {
      const { invoice } = await billingApi.invoice(invoiceId);
      if (invoice.status === "paid") return { kind: "success" };
      if (i < 2) await sleep(300);
    }
    const rec = await billingApi.recovery();
    if (!rec.recovery_required) return { kind: "success" };
    if (rec.outstanding_invoice_id) return { kind: "failure", failureClass: rec.failure_class };
    return "pending";
  }

  const retry = useMutation({
    mutationFn: async (invoiceId: string): Promise<ResultModal | "pending"> => {
      try {
        await billingApi.retryInvoice(invoiceId);
      } catch (e) {
        // The previous charge is still being sent to the provider: its
        // outcome is not known yet, so this is neither a success nor a failure.
        if (e instanceof ApiError && e.code === "billing.charge_in_progress") return "pending";
        // Refused by the retry limits (too soon, too many today, attempts
        // spent) or because this method cannot be charged: explain why,
        // and re-read the recovery state that drives the button.
        const refusal = retryRefusal(e);
        if (refusal) {
          invalidateRecovery();
          throw new RetryRefusedError(blockedText(refusal.reason, refusal.retryAfter));
        }
        // Already paid (idempotency guard) → verify and treat as recovered.
        if (e instanceof ApiError && e.status === 409) return verifyRetry(invoiceId);
        // Outstanding invoice vanished (resolved elsewhere) → refresh & clear.
        if (isNotFound(e)) {
          invalidateRecovery();
          throw new Error("resolved");
        }
        throw e;
      }
      return verifyRetry(invoiceId);
    },
    onSuccess: (result) => {
      if (result === "pending") {
        toast.show(t("paymentMethods.checkingResult"));
        invalidateRecovery();
        return;
      }
      if (result?.kind === "success") {
        setResultModal({ kind: "success" });
        // The paid invoice restores premium: the subscription card, the
        // dashboard's paywall flag and the payment history all changed.
        for (const key of [["sub-me"], ["dashboard"], ["invoices"], ["invoices-inf"]]) {
          qc.invalidateQueries({ queryKey: key });
        }
      } else if (result?.kind === "failure") {
        setResultModal({ kind: "failure", failureClass: result.failureClass });
      }
      invalidateMethods();
      invalidateRecovery();
    },
    onError: (e) => {
      const msg =
        e instanceof RetryRefusedError
          ? e.message
          : e instanceof Error && e.message === "resolved"
            ? t("paymentMethods.alreadyProcessed")
            : errorMessage(e);
      toast.error(msg);
    },
  });

  async function confirmSuccess() {
    setResultModal(null);
    // Reconcile the recovery notice and the wallet, and re-read the profile's
    // membership. (Premium-gated screens were already refreshed on success.)
    invalidateMethods();
    invalidateRecovery();
    try {
      await bootstrapMe();
    } catch {
      /* entitlement refresh is best-effort; server remains the source of truth */
    }
  }

  function closeFailure() {
    setResultModal(null);
    invalidateRecovery(); // pull any updated failure reason
  }

  return {
    recovery,
    showNotice,
    canRetryNow,
    retryBlockedText,
    retry,
    resultModal,
    confirmSuccess,
    closeFailure,
  };
}
