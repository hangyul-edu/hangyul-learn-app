import { useTranslation } from "../../i18n";
import { FailModal } from "../../components/FailModal";
import { LogoutModal } from "../../components/LogoutModal";
import { SuccessModal } from "../../components/SuccessModal";
import { WithdrawModal } from "../../components/WithdrawModal";
import { WithdrawPasswordModal } from "../../components/WithdrawPasswordModal";
import { WithdrawReauthModal } from "../../components/WithdrawReauthModal";
import { startSocialReauth } from "../../hooks/socialLogin";
import type { useLogoutFlow } from "./useLogoutFlow";
import type { useWithdrawFlow } from "./useWithdrawFlow";

/** Every modal of the logout and withdrawal flows, driven by their hooks. */
export function AccountFlowModals({
  logout,
  withdraw,
}: {
  logout: ReturnType<typeof useLogoutFlow>;
  withdraw: ReturnType<typeof useWithdrawFlow>;
}) {
  const { t } = useTranslation();
  const temporaryError = (
    <>
      {t("accountFlow.temporaryError")}
      <br />
      {t("accountFlow.tryAgainLater")}
    </>
  );
  return (
    <>
      <LogoutModal open={logout.confirmOpen} loading={logout.loading} onCancel={logout.cancel} onConfirm={logout.confirm} />

      <SuccessModal
        open={logout.doneOpen}
        title={t("accountFlow.logoutDoneTitle")}
        description={t("accountFlow.logoutDoneDesc")}
        confirmLabel={t("common.confirm")} // MOR-009 EN (3085:29162) says Confirm
        onClose={logout.finish}
      />

      <WithdrawModal
        open={withdraw.warnOpen}
        loading={withdraw.methodsLoading}
        onCancel={withdraw.cancelWarn}
        onConfirm={withdraw.toConfirmStep}
      />

      <WithdrawReauthModal
        open={withdraw.reauthOpen}
        loading={withdraw.withdrawing}
        providers={withdraw.reauthProviders}
        error={withdraw.reauthError}
        onCancel={withdraw.cancelReauth}
        onSelect={(provider) => void startSocialReauth(provider)}
      />

      <WithdrawPasswordModal
        open={withdraw.pwOpen}
        loading={withdraw.withdrawing}
        error={withdraw.pwError}
        onCancel={withdraw.cancelPassword}
        onSubmit={withdraw.withdraw}
      />

      <FailModal
        open={withdraw.failOpen}
        title={t("accountFlow.withdrawFailTitle")}
        description={temporaryError}
        onClose={withdraw.closeFail}
      />

      {/* Logout failed (temporary). 확인 just closes → user stays signed in on More. */}
      <FailModal
        open={logout.failOpen}
        title={t("accountFlow.logoutFailTitle")}
        description={temporaryError}
        onClose={logout.closeFail}
      />

      <SuccessModal
        open={withdraw.doneOpen}
        title={t("accountFlow.withdrawDoneTitle")}
        description={
          <>
            {t("accountFlow.withdrawDoneLine1")}
            <br />
            {t("accountFlow.withdrawDoneLine2")}
          </>
        }
        confirmLabel={t("common.confirm")} // MOR-007 EN (3085:29141) says Confirm
        onClose={withdraw.finish}
      />
    </>
  );
}
