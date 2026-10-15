import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "../../i18n";
import { Sheet } from "../ui/Modal";
import { Button } from "../ui/kit";
import { SkeletonList } from "../ui/states";
import { RankAvatar } from "../brand/RankBits";
import { friendApi } from "../../api/endpoints";
import { useRefreshSocial } from "../../api/queries";
import { useToast } from "../../hooks/toast";
import { errorMessage } from "../../lib/http";
import { InfoBox, SheetHeader, nameOf } from "./sheetParts";

/** Incoming friend-request sheet copy (`incomingRequest.*`). */
function useIncomingCopy() {
  const { t } = useTranslation();
  return {
    title: t("incomingRequest.title"),
    close: t("incomingRequest.close"),
    infoRequested: (name: string) => t("incomingRequest.infoRequested", { name }),
    infoVisibility: t("incomingRequest.infoVisibility"),
    reject: t("incomingRequest.reject"),
    accept: t("incomingRequest.accept"),
    loadError: t("incomingRequest.loadError"),
    retry: t("common.retry"),
    accepted: (name: string) => t("incomingRequest.accepted", { name }),
    rejected: t("incomingRequest.rejected"),
  };
}

/** A friend request someone sent: who, and 거절 / 수락. */
export function IncomingFriendRequestSheet({
  requestId,
  open,
  onClose,
}: {
  requestId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const copy = useIncomingCopy();
  const { t } = useTranslation();
  const toast = useToast();
  const refreshSocial = useRefreshSocial();
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ["friend-request", requestId],
    queryFn: () => friendApi.getRequest(requestId as string),
    enabled: open && !!requestId,
  });
  const request = q.data;
  const requesterName = useMemo(
    () => (request ? nameOf(request, t("home.defaultNickname")) : ""),
    [request, t],
  );

  async function respond(fn: () => Promise<unknown>, done: string, plain = false) {
    if (busy || !requestId) return;
    setBusy(true);
    try {
      await fn();
      if (plain) toast.show(done, "default", { icon: false });
      else toast.success(done);
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
      refreshSocial();
    }
  }

  return (
    <Sheet open={open} onClose={onClose} bare contained label={copy.title}>
      <div className="afs afs--incoming">
        <SheetHeader title={copy.title} closeLabel={copy.close} onClose={onClose} />

        {q.isLoading && !request ? (
          <div className="afs__recs">
            <SkeletonList rows={2} height={60} />
          </div>
        ) : q.error || !request ? (
          <div className="afs__panel afs__panel--empty">
            <p className="afs__panel-title">{copy.loadError}</p>
            <Button variant="secondary" size="sm" onClick={() => q.refetch()}>
              {copy.retry}
            </Button>
          </div>
        ) : (
          <>
            <InfoBox lines={[copy.infoRequested(requesterName), copy.infoVisibility]} />
            <div className="afs__result">
              {/* 893:32778 — 60px in LEG-020. */}
              <RankAvatar entry={request} size={60} />
              <div className="afs__result-name">{requesterName}</div>
            </div>
            <div className="afs__actions">
              <Button
                variant="secondary"
                block
                disabled={busy}
                onClick={() => respond(() => friendApi.reject(requestId as string), copy.rejected)}
              >
                {copy.reject}
              </Button>
              <Button
                block
                loading={busy}
                onClick={() => respond(() => friendApi.accept(requestId as string), copy.accepted(requesterName), true)}
              >
                {copy.accept}
              </Button>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
