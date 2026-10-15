import { useTranslation } from "../i18n";
import { DetailHeader } from "../components/DetailHeader";
import { useMySubscription } from "../api/queries";
import { InvoiceList } from "./subscription/InvoiceList";
import { PlanSection } from "./subscription/PlanSection";
import { SubscriptionModals } from "./subscription/SubscriptionModals";
import { useSubscriptionActions } from "./subscription/useSubscriptionActions";

/** 구독 관리 (MOR-010~014): the plan, voucher registration, cancellation and
 * the payment history. */
export function Subscription() {
  const { t } = useTranslation();
  const mine = useMySubscription();
  const a = useSubscriptionActions();

  return (
    <div className="screen subm">
      <div className="subm__scroll">
        <DetailHeader title={t("subscription.title")} />
        <div className="subm__top">
          <PlanSection query={mine} busy={a.busy} onCancel={a.cancel.start} onResume={a.resume} />

          {/* Course-access / voucher code */}
          <div className="subm__voucher">
            <span className="subm__voucher-label">{t("subscription.voucherLabel")}</span>
            <button className="subm__voucher-btn" onClick={a.voucher.start}>
              {t("subscription.register")}
            </button>
          </div>
        </div>

        <InvoiceList />
      </div>

      <SubscriptionModals actions={a} />
    </div>
  );
}
