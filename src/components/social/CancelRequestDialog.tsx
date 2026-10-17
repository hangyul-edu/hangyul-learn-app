import { Button } from "../ui/kit";
import { Dialog } from "../ui/Modal";
import { useTranslation } from "../../i18n";

/**
 * "Cancel your request to {name}?" — cp_G_01_modals as LEG frames 1827:24590
 * (KO) / 1827:24601 (EN) draw it: the question, a Gray 5 line saying the
 * request will be removed, and the two cp_C_01_primaryBtn tiles (돌아가기 on
 * bgray.400, 요청 취소 on Brand 1). A sent request is cancelled only from
 * here, never on the first tap. The backdrop does not dismiss it, like the
 * friend-removal dialog.
 */
export function CancelRequestDialog({
  name,
  busy,
  onBack,
  onConfirm,
}: {
  /** The person the request went to; null closes the dialog. */
  name: string | null;
  busy: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog
      open={name !== null}
      title={name !== null ? t("friends.cancelModalTitle", { name }) : ""}
      text={t("friends.cancelModalDesc")}
    >
      <div className="dialog__actions">
        <Button variant="ghost" block disabled={busy} onClick={onBack}>
          {t("friends.cancelModalBack")}
        </Button>
        <Button variant="primary" block loading={busy} onClick={onConfirm}>
          {t("friends.cancelModalConfirm")}
        </Button>
      </div>
    </Dialog>
  );
}
