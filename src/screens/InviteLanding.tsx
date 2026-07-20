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
import { useAuth } from "../hooks/auth";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import { normalizeLanguage, type AppLanguage } from "../lib/language";

interface InviteCopy {
  title: string;
  loadError: string;
  invalid: string;
  invalidSub: string;
  isSelf: string;
  alreadyFriends: string;
  sendRequest: string;
  accept: string;
  requested: string;
  requestSent: string;
  accepted: string;
  goToFriends: string;
  goHome: string;
  back: string;
}

const COPY: Record<AppLanguage, InviteCopy> = {
  ko: {
    title: "친구 초대",
    loadError: "초대를 불러오지 못했어요.",
    invalid: "유효하지 않은 초대 링크예요",
    invalidSub: "링크가 만료되었거나 취소되었을 수 있어요.",
    isSelf: "본인의 초대 링크예요.",
    alreadyFriends: "이미 친구예요.",
    sendRequest: "친구 신청",
    accept: "수락",
    requested: "요청을 보냈어요",
    requestSent: "친구 신청을 보냈어요",
    accepted: "친구가 되었어요!",
    goToFriends: "친구 관리로 이동",
    goHome: "홈으로",
    back: "뒤로 가기",
  },
  en: {
    title: "Friend Invitation",
    loadError: "Couldn't load the invitation.",
    invalid: "This invitation link isn't valid",
    invalidSub: "The link may have expired or been cancelled.",
    isSelf: "This is your own invitation link.",
    alreadyFriends: "You're already friends.",
    sendRequest: "Send Friend Request",
    accept: "Accept",
    requested: "Request sent",
    requestSent: "Friend request sent",
    accepted: "You're now friends!",
    goToFriends: "Go to Friends",
    goHome: "Go home",
    back: "Go back",
  },
};

export function InviteLanding() {
  const { token } = useParams<{ token: string }>();
  const nav = useNavigate();
  const toast = useToast();
  const { me } = useAuth();
  const copy = COPY[normalizeLanguage(me?.app_language)];
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const q = useQuery({
    queryKey: ["friend-invitation", token],
    queryFn: () => friendApi.resolveInvitation(token as string),
    enabled: !!token,
    retry: false,
  });

  async function run(fn: () => Promise<unknown>, doneMsg: string) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      toast.success(doneMsg);
      setDone(true);
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
        <button className="fm__back" onClick={() => nav("/home")} aria-label={copy.back}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" stroke="#272c30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="fm__title">{copy.title}</h1>
      </header>

      <div className="screen__body fm__body">
        {q.isLoading ? (
          <div className="afs__panel afs__panel--empty">
            <span className="spinner spinner--lg" />
          </div>
        ) : q.error || !inviter ? (
          <div className="afs__panel afs__panel--empty" style={{ marginTop: 24 }}>
            <p className="afs__panel-title">{copy.invalid}</p>
            <p className="afs__panel-sub">{copy.invalidSub}</p>
            <Button variant="secondary" onClick={() => nav("/home")}>{copy.goHome}</Button>
          </div>
        ) : (
          <div className="afs" style={{ marginTop: 12 }}>
            <div className="afs__result">
              <RankAvatar entry={inviter} size={84} />
              <div className="afs__result-name">{inviter.nickname ?? "회원"}</div>

              {q.data?.is_self ? (
                <>
                  <p className="afs__panel-sub">{copy.isSelf}</p>
                  <Button block variant="secondary" onClick={() => nav("/home")}>{copy.goHome}</Button>
                </>
              ) : done ? (
                <Button block onClick={() => nav("/social")}>{copy.goToFriends}</Button>
              ) : inviter.relationship === "friends" ? (
                <>
                  <p className="afs__panel-sub">{copy.alreadyFriends}</p>
                  <Button block onClick={() => nav("/social")}>{copy.goToFriends}</Button>
                </>
              ) : inviter.relationship === "request_received" && inviter.request_id ? (
                <Button block loading={busy} onClick={() => run(() => friendApi.accept(inviter.request_id as string), copy.accepted)}>
                  {copy.accept}
                </Button>
              ) : inviter.relationship === "request_sent" ? (
                <Button block disabled onClick={() => nav("/social")}>{copy.requested}</Button>
              ) : (
                <Button block loading={busy} onClick={() => run(() => friendApi.request(inviter.user_id), copy.requestSent)}>
                  {copy.sendRequest}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
