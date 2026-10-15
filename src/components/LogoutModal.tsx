import { useTranslation } from "../i18n";
import { TwoButtonAlert } from "./ui/TwoButtonAlert";

/**
 * Logout confirmation modal. Opening it calls no API; only the orange 로그아웃
 * button triggers the parent's `onConfirm`, which revokes the server session
 * (`revokeSession`, POST /auth/logout with the refresh token) and then calls
 * `hardSignOut` → clears tokens + current-user + every user-scoped query cache;
 * the route guard resets navigation to the logged-out root. 취소 / Escape close
 * without logging out; the backdrop is not a dismiss target. Both buttons are
 * disabled while the request is in flight. Focus is trapped and restored to the
 * opener (the 로그아웃 menu item) on cancel.
 */
export function LogoutModal({
  open,
  loading,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <TwoButtonAlert
      open={open}
      role="dialog"
      raised
      focus="confirm"
      loading={loading}
      title={t("misc.logoutTitle")}
      body={t("misc.logoutBody")}
      cancelLabel={t("common.cancel")}
      confirmLabel={t("misc.logout")}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
