/**
 * Friend invitation deep-link landing (`/friend/invite/:token`).
 *
 * Resolves an opaque invitation token to the inviter's safe public profile and
 * lets the (authenticated) opener send/accept the appropriate request. It never
 * auto-creates a friendship — the user always confirms. Invalid, revoked, or
 * expired tokens surface a friendly message, not a leak.
 */
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "../components/ui/kit";
import { RankAvatar } from "../components/brand/RankBits";
import { friendApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import { useTranslation } from "../i18n";
import { BackChevronIcon } from "../components/brand/Glyphs";
import { useRefreshSocial } from "../api/queries";

export function InviteLanding() {
  const { token } = useParams<{ token: string }>();
  const nav = useNavigate();
  const toast = useToast();
  const refreshSocial = useRefreshSocial();
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const q = useQuery({
    queryKey: ["friend-invitation", token],
    queryFn: () => friendApi.resolveInvitation(token as string),
    enabled: !!token,
    retry: false,
  });

  async function run(fn: () => Promise<unknown>, doneMsg: string, notice = false) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      // `notice`: the bottom notice (cp_G_03_toast), as after an accept.
      if (notice) toast.show(doneMsg, "notice");
      else toast.success(doneMsg);
      setDone(true);
      // The Social screen's lists and the friend league (same keys it refreshes
      // after its own actions) now include this request / friendship.
      refreshSocial();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const inviter = q.data?.inviter;

  return (
    <div className="screen fm">
      <header className="fm__header">
        <button className="fm__back" onClick={() => nav("/home")} aria-label={t("common.back")}>
          <BackChevronIcon color="#262c31" />
        </button>
        <h1 className="fm__title">{t("invite.title")}</h1>
      </header>

      <div className="screen__body fm__body">
        {q.isLoading ? (
          <div className="afs__panel afs__panel--empty">
            <span className="spinner spinner--lg" />
          </div>
        ) : q.error || !inviter ? (
          <div className="afs__panel afs__panel--empty afs__panel--invite">
            <p className="afs__panel-title">{t("invite.invalid")}</p>
            <p className="afs__panel-sub">{t("invite.invalidSub")}</p>
            <Button variant="secondary" onClick={() => nav("/home")}>{t("invite.goHome")}</Button>
          </div>
        ) : (
          <div className="afs afs--invite">
            <div className="afs__result">
              <RankAvatar entry={inviter} size={84} />
              <div className="afs__result-name">{inviter.nickname ?? t("home.defaultNickname")}</div>

              {q.data?.is_self ? (
                <>
                  <p className="afs__panel-sub">{t("invite.isSelf")}</p>
                  <Button block variant="secondary" onClick={() => nav("/home")}>{t("invite.goHome")}</Button>
                </>
              ) : done ? (
                <Button block onClick={() => nav("/social")}>{t("invite.goToFriends")}</Button>
              ) : inviter.relationship === "friends" ? (
                <>
                  <p className="afs__panel-sub">{t("invite.alreadyFriends")}</p>
                  <Button block onClick={() => nav("/social")}>{t("invite.goToFriends")}</Button>
                </>
              ) : inviter.relationship === "request_received" && inviter.request_id ? (
                <Button
                  block
                  loading={busy}
                  onClick={() =>
                    run(
                      () => friendApi.accept(inviter.request_id as string),
                      t("friends.toastAccepted", { name: inviter.nickname ?? t("home.defaultNickname") }),
                      true,
                    )
                  }
                >
                  {t("invite.accept")}
                </Button>
              ) : inviter.relationship === "request_sent" ? (
                <Button block disabled onClick={() => nav("/social")}>{t("invite.requested")}</Button>
              ) : (
                <Button block loading={busy} onClick={() => run(() => friendApi.request(inviter.user_id), t("invite.requestSent"))}>
                  {t("invite.sendRequest")}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
