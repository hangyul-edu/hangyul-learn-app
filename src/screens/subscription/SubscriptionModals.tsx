import { ConfirmDialog } from "../../components/ui/Modal";
import { CancelReasonModal } from "../../components/CancelReasonModal";
import { FailModal } from "../../components/FailModal";
import { VoucherModal } from "../../components/VoucherModal";
import { VoucherSuccessModal } from "../../components/VoucherSuccessModal";
import { useTranslation } from "../../i18n";
import type { useSubscriptionActions } from "./useSubscriptionActions";

/** The voucher and cancellation modals, driven by useSubscriptionActions. */
export function SubscriptionModals({ actions: a }: { actions: ReturnType<typeof useSubscriptionActions> }) {
  const { t } = useTranslation();
  return (
    <>
    {/* Voucher / course-code registration (subApi.redeemCoupon) */}
    <VoucherModal
      open={a.voucher.open}
      loading={a.busy}
      error={a.voucher.error}
      code={a.voucher.code}
      onCodeChange={a.voucher.setCode}
      onClose={a.voucher.close}
      onSubmit={a.voucher.redeem}
    />

    {/* Code-domain failure. 확인 returns to the input modal with the code
        preserved for edit-and-retry; no API, no entitlement change. */}
    <FailModal
      open={a.voucher.failOpen}
      title={t("subscription.voucherFailTitle")}
      description={
        <>
          {t("subscription.invalidCode")}
          <br />
          {t("subscription.invalidCodeSub")}
        </>
      }
      onClose={a.voucher.closeFail}
    />

    <VoucherSuccessModal open={!!a.voucher.success} data={a.voucher.success} onClose={a.voucher.closeSuccess} />

    {/* MOR-011 (624:10155) — no badge; the first body line is Brand 1 and the
        rest Gray 5, and the dismiss button reads 취소 / Keep Plan. */}
    <ConfirmDialog
      open={a.cancel.confirmOpen}
      title={t("subscription.cancelConfirmTitle")}
      warn={t("subscription.cancelConfirmText")}
      text={t("subscription.cancelConfirmText2")}
      cancelLabel={t("subscription.cancelConfirmKeep")}
      confirmLabel={t("subscription.cancelConfirmGo")}
      loading={a.busy}
      onCancel={a.cancel.keep}
      onConfirm={a.cancel.toReasonStep}
    />

    <CancelReasonModal
      open={a.cancel.reasonOpen}
      loading={a.busy}
      onSkip={a.cancel.skip}
      onSubmit={a.cancel.submit}
    />
    </>
  );
}
