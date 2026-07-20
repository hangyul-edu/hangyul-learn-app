/**
 * Add Friend + Incoming Friend Request bottom sheets.
 *
 * Both render inside the shared `Sheet` (dimmed backdrop, slide-up, rounded
 * top, safe-area aware, hardware-back to close). All data comes from the real
 * friend APIs; nothing is hardcoded. API + cache coordination lives here — the
 * avatar/button primitives stay presentational.
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sheet } from "../ui/Modal";
import { Button } from "../ui/kit";
import { SkeletonList } from "../ui/states";
import { RankAvatar } from "../brand/RankBits";
import { friendApi } from "../../api/endpoints";
import { useAuth } from "../../hooks/auth";
import { useToast } from "../../hooks/toast";
import { errorMessage } from "../../lib/http";
import { NATIONALITIES } from "../../lib/format";
import { hashPhone, isLikelyPhone } from "../../lib/phone";
import { getContactPhoneHashes } from "../../lib/contacts";
import { normalizeLanguage, type AppLanguage } from "../../lib/language";
import type { RecommendedUser } from "../../lib/types";

/* ------------------------------ localization ---------------------------- */
interface AddCopy {
  title: string;
  close: string;
  infoAcceptance: string;
  infoVisibility: string;
  searchPlaceholder: string;
  searchAria: string;
  search: string;
  suggested: string;
  suggestedSub: string;
  noRecommendations: string;
  invite: string;
  inviteAria: string;
  sendRequest: string;
  cancelRequest: string;
  accept: string;
  friendsLabel: string;
  notFoundTitle: string;
  notFoundSub: string;
  requestSent: string;
  requestCancelled: string;
  requestAccepted: string;
  linkCopied: string;
  linkCopyFailed: string;
  ctaState: (name: string, rel: RecommendedUser["relationship"]) => string;
}

const ADD_COPY: Record<AppLanguage, AddCopy> = {
  ko: {
    title: "친구 추가",
    close: "친구 추가 닫기",
    infoAcceptance: "친구가 신청을 수락하면 서로 친구가 됩니다.",
    infoVisibility: "친구는 내 리그 현황과 프로필을 볼 수 있습니다.",
    searchPlaceholder: "전화번호로 찾기",
    searchAria: "전화번호로 친구 찾기",
    search: "검색",
    suggested: "추천 친구",
    suggestedSub: "연락처 기반으로 친구를 추천했어요!",
    noRecommendations: "추천할 친구가 없어요",
    invite: "친구 신청 링크 보내기",
    inviteAria: "친구 신청 링크 공유하기",
    sendRequest: "친구 신청",
    cancelRequest: "요청 취소",
    accept: "수락",
    friendsLabel: "친구",
    notFoundTitle: "해당 전화번호로 가입한 사용자를 찾을 수 없어요",
    notFoundSub: "번호를 확인하거나 친구 신청 링크를 보내보세요.",
    requestSent: "친구 신청을 보냈어요",
    requestCancelled: "요청을 취소했어요",
    requestAccepted: "친구가 되었어요!",
    linkCopied: "링크가 복사되었어요. 친구에게 링크를 보내보세요!",
    linkCopyFailed: "링크를 복사하지 못했어요. 다시 시도해 주세요.",
    ctaState: (name, rel) =>
      rel === "friends"
        ? `${name}, 이미 친구`
        : rel === "request_sent"
          ? `${name}, 요청 취소 가능`
          : rel === "request_received"
            ? `${name}, 수락 가능`
            : `${name}, 친구 신청 가능`,
  },
  en: {
    title: "Add Friend",
    close: "Close add friend",
    infoAcceptance: "You will become friends when they accept your request.",
    infoVisibility: "Friends can view your League status and profile.",
    searchPlaceholder: "Search by phone number",
    searchAria: "Find a friend by phone number",
    search: "Search",
    suggested: "Suggested Friends",
    suggestedSub: "Suggested from your contacts",
    noRecommendations: "No friends to suggest",
    invite: "Send Friend Invitation Link",
    inviteAria: "Share friend invitation link",
    sendRequest: "Send Friend Request",
    cancelRequest: "Cancel Request",
    accept: "Accept",
    friendsLabel: "Friends",
    notFoundTitle: "No user is registered with that phone number",
    notFoundSub: "Check the number or send an invitation link.",
    requestSent: "Friend request sent",
    requestCancelled: "Request cancelled",
    requestAccepted: "You're now friends!",
    linkCopied: "Link copied. Send it to your friend!",
    linkCopyFailed: "Couldn't copy the link. Please try again.",
    ctaState: (name, rel) =>
      rel === "friends"
        ? `${name}, already friends`
        : rel === "request_sent"
          ? `${name}, request can be cancelled`
          : rel === "request_received"
            ? `${name}, can accept`
            : `${name}, can send request`,
  },
};

interface IncomingCopy {
  title: string;
  close: string;
  infoRequested: (name: string) => string;
  infoVisibility: string;
  reject: string;
  accept: string;
  loadError: string;
  retry: string;
  accepted: (name: string) => string;
  rejected: string;
}

const INCOMING_COPY: Record<AppLanguage, IncomingCopy> = {
  ko: {
    title: "친구 요청",
    close: "친구 요청 닫기",
    infoRequested: (name) => `${name}님이 친구를 신청했어요`,
    infoVisibility: "수락하면 서로의 리그 현황과 프로필을 볼 수 있습니다",
    reject: "거절",
    accept: "수락",
    loadError: "요청을 불러오지 못했어요.",
    retry: "다시 시도",
    accepted: (name) => `${name}님과 친구가 되었어요!`,
    rejected: "요청을 거절했어요",
  },
  en: {
    title: "Friend Request",
    close: "Close friend request",
    infoRequested: (name) => `${name} sent you a friend request`,
    infoVisibility: "Accept to view each other's League status and profiles",
    reject: "Reject",
    accept: "Accept",
    loadError: "Couldn't load the request.",
    retry: "Try again",
    accepted: (name) => `You're now friends with ${name}!`,
    rejected: "Request rejected",
  },
};

const nameOf = (u: { nickname?: string | null }, fallback: string) => u.nickname ?? fallback;

const CloseIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" stroke="#272c30" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);
const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
    <path d="M20 20l-3.2-3.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/** Invalidate every Friend-Management + Friend-League surface after a mutation. */
function useSocialRefresh() {
  const qc = useQueryClient();
  return () =>
    [["friends"], ["friend-requests-received"], ["friend-requests-sent"], ["league-rankings"]].forEach(
      (key) => qc.invalidateQueries({ queryKey: key }),
    );
}

function SheetHeader({ title, closeLabel, onClose }: { title: string; closeLabel: string; onClose: () => void }) {
  return (
    <div className="afs__header">
      <h2 className="afs__title">{title}</h2>
      <button className="afs__close" aria-label={closeLabel} onClick={onClose}>
        <CloseIcon />
      </button>
    </div>
  );
}

function InfoBox({ lines }: { lines: string[] }) {
  return (
    <ul className="afs__info">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}

/* ----------------------------- Add Friend ------------------------------- */
export function AddFriendSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me } = useAuth();
  const lang = normalizeLanguage(me?.app_language);
  const copy = ADD_COPY[lang];
  const toast = useToast();
  const qc = useQueryClient();
  const refreshSocial = useSocialRefresh();

  const [dial, setDial] = useState("+82");
  const [phone, setPhone] = useState("");
  const [searchState, setSearchState] = useState<"idle" | "searching" | "error">("idle");
  const [result, setResult] = useState<RecommendedUser | "none" | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [sharing, setSharing] = useState(false);

  const recs = useQuery({
    queryKey: ["friend-recommendations"],
    queryFn: async () => friendApi.recommendations(await getContactPhoneHashes()),
    enabled: open,
    staleTime: Infinity,
  });

  // Prefetch the (idempotent) invitation token as soon as the sheet opens and
  // keep it cached, so tapping "친구 신청 링크 보내기" copies instantly instead of
  // waiting on a round-trip. Reused across taps until the sheet is discarded.
  const invite = useQuery({
    queryKey: ["friend-invitation-token"],
    queryFn: friendApi.createInvitation,
    enabled: open,
    staleTime: Infinity,
  });

  function refreshDiscovery() {
    qc.invalidateQueries({ queryKey: ["friend-recommendations"] });
    if (result && result !== "none") void runSearch();
  }

  async function act(userId: string, fn: () => Promise<unknown>, done: string) {
    if (busy.has(userId)) return;
    setBusy((prev) => new Set(prev).add(userId));
    try {
      await fn();
      toast.success(done);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
      refreshSocial();
      refreshDiscovery();
    }
  }

  async function runSearch() {
    if (!isLikelyPhone(phone) || searchState === "searching") return;
    setSearchState("searching");
    setResult(null);
    try {
      const res = await friendApi.searchPhone(await hashPhone(dial, phone));
      setResult(res.user ?? "none");
      setSearchState("idle");
    } catch (e) {
      setSearchState("error");
      toast.error(errorMessage(e));
    }
  }

  async function shareInvite() {
    if (sharing) return;
    setSharing(true);
    try {
      // Prefer the prefetched token; only fall back to a fetch if it isn't ready.
      const token = invite.data?.token ?? (await friendApi.createInvitation()).token;
      const url = `${window.location.origin}/friend/invite/${token}`;
      await navigator.clipboard.writeText(url);
      // Icon-less dark confirmation snackbar (repeat taps restart, never stack).
      toast.show(copy.linkCopied, "default", { icon: false });
    } catch (e) {
      // Log the real error; show the user a generic retry message.
      console.error("Failed to copy the friend invitation link", e);
      toast.error(copy.linkCopyFailed);
    } finally {
      setSharing(false);
    }
  }

  const cta = (u: RecommendedUser) => {
    const label = nameOf(u, "");
    switch (u.relationship) {
      case "none":
        return { text: copy.sendRequest, onClick: () => act(u.user_id, () => friendApi.request(u.user_id), copy.requestSent) };
      case "request_sent":
        return { text: copy.cancelRequest, onClick: () => u.request_id && act(u.user_id, () => friendApi.cancel(u.request_id!), copy.requestCancelled) };
      case "request_received":
        return { text: copy.accept, primary: true, onClick: () => u.request_id && act(u.user_id, () => friendApi.accept(u.request_id!), copy.requestAccepted) };
      case "friends":
        return { text: copy.friendsLabel, muted: true, onClick: undefined };
    }
    return { text: label, onClick: undefined };
  };

  const recommendations = recs.data?.recommendations ?? [];

  return (
    <Sheet open={open} onClose={onClose} bare contained label={copy.title}>
      <div className="afs">
        <SheetHeader title={copy.title} closeLabel={copy.close} onClose={onClose} />
        <InfoBox lines={[copy.infoAcceptance, copy.infoVisibility]} />

        {/* Phone search */}
        <div className={`afs__search ${phone ? "is-filled" : ""}`}>
          <select
            className="afs__dial"
            aria-label="Country code"
            value={dial}
            onChange={(e) => setDial(e.target.value)}
          >
            {NATIONALITIES.map((n) => (
              <option key={n.code} value={n.dial}>
                {n.flag} {n.dial}
              </option>
            ))}
          </select>
          <input
            className="afs__phone"
            inputMode="tel"
            type="tel"
            aria-label={copy.searchAria}
            placeholder={copy.searchPlaceholder}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
          />
          <button
            className="afs__search-btn"
            aria-label={copy.search}
            disabled={!isLikelyPhone(phone) || searchState === "searching"}
            onClick={runSearch}
          >
            <SearchIcon />
          </button>
        </div>

        {/* Phone search result / not-found */}
        {result === "none" && (
          <div className="afs__panel afs__panel--empty">
            <p className="afs__panel-title">{copy.notFoundTitle}</p>
            <p className="afs__panel-sub">{copy.notFoundSub}</p>
          </div>
        )}
        {result && result !== "none" && (
          <div className="afs__result" aria-label={copy.ctaState(nameOf(result, ""), result.relationship)}>
            <RankAvatar entry={result} size={72} />
            <div className="afs__result-name">{nameOf(result, "")}</div>
            {result.relationship === "friends" ? (
              <div className="afs__friends-tag">{copy.friendsLabel}</div>
            ) : (
              <Button
                block
                variant={cta(result).muted ? "secondary" : "primary"}
                loading={busy.has(result.user_id)}
                onClick={cta(result).onClick}
              >
                {cta(result).text}
              </Button>
            )}
          </div>
        )}

        {/* Contact recommendations */}
        <div className="afs__section">
          <h3 className="afs__section-title">{copy.suggested}</h3>
          <p className="afs__section-sub">{copy.suggestedSub}</p>
          {recs.isLoading && !recs.data ? (
            <div className="afs__recs">
              <SkeletonList rows={2} height={60} />
            </div>
          ) : recommendations.length === 0 ? (
            <div className="afs__panel afs__panel--empty">
              <p className="afs__panel-title">{copy.noRecommendations}</p>
            </div>
          ) : (
            <ul className="afs__recs" role="list">
              {recommendations.map((u) => {
                const action = cta(u);
                return (
                  <li key={u.user_id} className="afs__rec" aria-label={copy.ctaState(nameOf(u, ""), u.relationship)}>
                    <RankAvatar entry={u} size={44} />
                    <span className="afs__rec-name">{nameOf(u, "")}</span>
                    {u.relationship === "friends" ? (
                      <span className="afs__friends-tag afs__friends-tag--pill">{copy.friendsLabel}</span>
                    ) : (
                      <button
                        className={`afs__rec-cta ${action.primary ? "afs__rec-cta--primary" : ""}`}
                        disabled={busy.has(u.user_id)}
                        onClick={action.onClick}
                      >
                        {action.text}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Invite link — shown when there is nothing better to suggest */}
        {!recs.isLoading && recommendations.length === 0 && (
          <Button block loading={sharing} onClick={shareInvite} aria-label={copy.inviteAria}>
            {copy.invite}
          </Button>
        )}
      </div>
    </Sheet>
  );
}

/* ----------------------- Incoming Friend Request ------------------------ */
export function IncomingFriendRequestSheet({
  requestId,
  open,
  onClose,
}: {
  requestId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { me } = useAuth();
  const copy = INCOMING_COPY[normalizeLanguage(me?.app_language)];
  const toast = useToast();
  const refreshSocial = useSocialRefresh();
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ["friend-request", requestId],
    queryFn: () => friendApi.getRequest(requestId as string),
    enabled: open && !!requestId,
  });
  const request = q.data;
  const requesterName = useMemo(() => (request ? nameOf(request, "회원") : ""), [request]);

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
      <div className="afs">
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
              <RankAvatar entry={request} size={72} />
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
