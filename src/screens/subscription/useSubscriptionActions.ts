import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { subApi } from "../../api/endpoints";
import type { VoucherSuccess } from "../../components/VoucherSuccessModal";
import { useToast } from "../../hooks/toast";
import { useTranslation, type Translate } from "../../i18n";
import { formatYmd } from "../../lib/format";
import { ApiError, errorMessage } from "../../lib/http";
import type { CancellationReason, CouponRedemption } from "../../lib/types";

/**
 * The success modal's detail, straight from the redemption. A grant that is
 * not `activated` is queued behind the running subscription; its effective
 * dates are then a projection. `t` is passed in because this runs outside the
 * component tree.
 */
function buildSuccess(grant: CouponRedemption, t: Translate): VoucherSuccess {
  const plan = grant.plan_name || t("subscription.planFallback");
  const from = formatYmd(grant.effective_start_at, ".");
  const to = formatYmd(grant.effective_end_at, ".");
  return {
    subtitle: t(grant.activated ? "subscription.voucherApplied" : "subscription.voucherScheduled", { plan }),
    plan,
    type: t("subscription.voucherType"),
    validity: from && to ? `${from}~${to}` : to ? `~${to}` : "-",
  };
}

/**
 * What Subscription Management changes: redeeming a voucher (input → success
 * or failure modal), the two-step cancellation (MOR-011 → the reason step
 * MOR-012) and resuming a scheduled cancellation. One request at a time.
 */
export function useSubscriptionActions() {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [voucherOpen, setVoucherOpen] = useState(false);
  const [voucherCode, setVoucherCode] = useState(""); // controlled; survives the fail-modal swap
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [couponFailOpen, setCouponFailOpen] = useState(false);
  const [voucherSuccess, setVoucherSuccess] = useState<VoucherSuccess | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);

  function refresh() {
    qc.invalidateQueries({ queryKey: ["sub-me"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["invoices-inf"] });
  }

  // Redemption is server-authoritative: one POST validates and applies (active
  // now, or queued behind the running subscription). Entitlement is never
  // updated locally — refresh() re-reads it. A code-domain rejection (invalid /
  // already used / revoked / expired) shows the dedicated failure modal. The
  // 10-per-24h attempt cap (429) and temporary failures (network / 5xx) stay
  // inline in the voucher modal — the code itself may well be fine.
  async function redeem(code: string) {
    if (busy) return;
    setBusy(true);
    setVoucherError(null);
    try {
      const grant = await subApi.redeemCoupon(code);
      refresh();
      setVoucherOpen(false);
      setVoucherSuccess(buildSuccess(grant, t)); // → success modal
    } catch (e) {
      if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 429) {
        // Code-domain rejection — replace the input modal with the failure modal
        // (code preserved for edit-and-retry). No entitlement change.
        setVoucherOpen(false);
        setCouponFailOpen(true);
      } else {
        setVoucherError(errorMessage(e)); // keep modal open, allow retry
      }
    } finally {
      setBusy(false);
    }
  }

  async function doCancel(reason?: CancellationReason, detail?: string) {
    setBusy(true);
    try {
      await subApi.cancel(reason, detail);
      toast.success(t("subscription.cancelScheduled"));
      setReasonOpen(false);
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function resume() {
    if (busy) return;
    setBusy(true);
    try {
      await subApi.resume();
      toast.success(t("subscription.resumed"));
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return {
    busy,
    voucher: {
      open: voucherOpen,
      code: voucherCode,
      setCode: setVoucherCode,
      error: voucherError,
      start: () => {
        setVoucherCode(""); // fresh entry
        setVoucherError(null);
        setVoucherOpen(true);
      },
      close: () => {
        if (busy) return;
        setVoucherOpen(false);
        setVoucherError(null);
      },
      redeem,
      failOpen: couponFailOpen,
      // 확인 returns to the input modal with the code preserved for
      // edit-and-retry; no API, no entitlement change.
      closeFail: () => {
        setCouponFailOpen(false);
        setVoucherOpen(true);
      },
      success: voucherSuccess,
      closeSuccess: () => setVoucherSuccess(null),
    },
    cancel: {
      confirmOpen: cancelOpen,
      start: () => setCancelOpen(true),
      keep: () => setCancelOpen(false),
      // MOR-011's 해지 does not cancel yet — it hands over to the optional
      // reason step (MOR-012). Both of that step's buttons finish the
      // cancellation; only the reason sent with it differs.
      toReasonStep: () => {
        setCancelOpen(false);
        setReasonOpen(true);
      },
      reasonOpen,
      skip: () => !busy && void doCancel(),
      submit: (reason: CancellationReason, detail?: string) => void doCancel(reason, detail),
    },
    resume,
  };
}
