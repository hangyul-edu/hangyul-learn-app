import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../components/ui/kit";
import { Dialog } from "../components/ui/Modal";
import { ErrorState, SkeletonList } from "../components/ui/states";
import { RankAvatar } from "../components/brand/RankBits";
import { AddFriendSheet, IncomingFriendRequestSheet } from "../components/social/AddFriendSheet";
import { friendApi } from "../api/endpoints";
import { useAuth } from "../hooks/auth";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import { timeAgo } from "../lib/format";
import { normalizeLanguage, type AppLanguage } from "../lib/language";
import type { Friend, FriendRequest } from "../lib/types";

type Tab = "friends" | "received" | "sent";

const QK = {
  friends: ["friends"],
  received: ["friend-requests-received"],
  sent: ["friend-requests-sent"],
} as const;

/* ------------------------------ localization ---------------------------- */
interface FmCopy {
  title: string;
  back: string;
  add: string;
  tabs: { friends: string; received: string; sent: string };
  remove: string;
  reject: string;
  accept: string;
  cancel: string;
  openRequest: string;
  friendsEmptyTitle: string;
  friendsEmptyDesc: string[];
  receivedEmptyTitle: string;
  receivedEmptyDesc: string[];
  sentEmptyTitle: string;
  sentEmptyDesc: string[];
  listError: string;
  modalTitle: (n: string) => string;
  modalDesc: string;
  modalCancel: string;
  modalDelete: string;
  toastAccepted: (name: string) => string;
  toastRejected: string;
  toastCancelled: string;
  toastRemoved: string;
  requestAge: (iso?: string) => string;
}
const FM_COPY: Record<AppLanguage, FmCopy> = {
  ko: {
    title: "친구 관리",
    back: "뒤로 가기",
    add: "친구 추가",
    tabs: { friends: "친구", received: "받은 요청", sent: "보낸 요청" },
    remove: "삭제",
    reject: "거절",
    accept: "수락",
    cancel: "취소",
    openRequest: "요청 열기",
    friendsEmptyTitle: "아직 친구가 없어요",
    friendsEmptyDesc: ["친구를 추가하고", "함께 공부해 보세요!"],
    receivedEmptyTitle: "받은 친구 요청이 없어요",
    receivedEmptyDesc: ["친구가 요청을 보내면", "이곳에 표시돼요"],
    sentEmptyTitle: "보낸 친구 요청이 없어요",
    sentEmptyDesc: ["함께 공부하고 싶은 친구에게", "요청을 보내보세요"],
    listError: "목록을 불러오지 못했어요.",
    modalTitle: (n: string) => `${n}님을 친구에서 삭제할까요?`,
    modalDesc: "상대방에게 알림은 가지 않습니다.",
    modalCancel: "취소",
    modalDelete: "삭제",
    toastAccepted: (name) => `${name}님과 친구가 되었어요!`,
    toastRejected: "요청을 거절했어요",
    toastCancelled: "요청을 취소했어요",
    toastRemoved: "친구를 삭제했어요",
    requestAge: (iso?: string) => `${timeAgo(iso)} 요청`,
  },
  en: {
    title: "Manage Friends",
    back: "Go back",
    add: "Add Friend",
    tabs: { friends: "Friends", received: "Received", sent: "Sent" },
    remove: "Remove",
    reject: "Reject",
    accept: "Accept",
    cancel: "Cancel",
    openRequest: "open request",
    friendsEmptyTitle: "You don't have any friends yet",
    friendsEmptyDesc: ["Add friends and", "study together!"],
    receivedEmptyTitle: "No friend requests received",
    receivedEmptyDesc: ["When a friend sends you a request,", "it will appear here"],
    sentEmptyTitle: "No friend requests sent",
    sentEmptyDesc: ["Send a request to a friend", "you'd like to study with"],
    listError: "Couldn't load the list.",
    modalTitle: (n: string) => `Remove ${n} from your friends?`,
    modalDesc: "They will not be notified.",
    modalCancel: "Cancel",
    modalDelete: "Remove",
    toastAccepted: (name) => `You're now friends with ${name}!`,
    toastRejected: "Request rejected",
    toastCancelled: "Request cancelled",
    toastRemoved: "Friend removed",
    requestAge: (iso?: string) => (iso ? engAge(iso) : ""),
  },
};

function engAge(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
const nameOf = (u: { nickname?: string | null }) => u.nickname ?? "회원";

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 5v14M5 12h14" stroke="#8a8f96" strokeWidth="2.3" strokeLinecap="round" />
  </svg>
);

/* -------------------------------- rows ---------------------------------- */
function FriendRow({ friend, copy, onRemove }: { friend: Friend; copy: FmCopy; onRemove: () => void }) {
  return (
    <li className="fm__row" aria-label={`${nameOf(friend)}, ${copy.remove}`}>
      <span className="fm__row-avatar">
        <RankAvatar entry={friend} size={46} />
      </span>
      <span className="fm__row-name">{nameOf(friend)}</span>
      <button className="fm__pill" onClick={onRemove}>{copy.remove}</button>
    </li>
  );
}

function RequestRow({
  req,
  copy,
  lang,
  busy,
  actions,
  onOpen,
}: {
  req: FriendRequest;
  copy: FmCopy;
  lang: AppLanguage;
  busy: boolean;
  actions: { label: string; primary?: boolean; onClick: () => void }[];
  /** When set, the avatar + name open the full request sheet (received tab). */
  onOpen?: () => void;
}) {
  const age = lang === "ko" ? copy.requestAge(req.created_at) : req.relative_time ?? copy.requestAge(req.created_at);
  const identity = (
    <>
      <span className="fm__row-avatar">
        <RankAvatar entry={req} size={46} />
      </span>
      <div className="fm__row-main">
        <div className="fm__row-name">{nameOf(req)}</div>
        <div className="fm__row-age">{age}</div>
      </div>
    </>
  );
  return (
    <li className="fm__row" aria-label={`${nameOf(req)}, ${age}, ${actions.map((a) => a.label).join(", ")}`}>
      {onOpen ? (
        <button className="fm__row-open" onClick={onOpen} aria-label={`${nameOf(req)} ${copy.openRequest}`}>
          {identity}
        </button>
      ) : (
        identity
      )}
      <div className="fm__row-actions">
        {actions.map((a) => (
          <button
            key={a.label}
            className={`fm__pill ${a.primary ? "fm__pill--primary" : ""}`}
            disabled={busy}
            onClick={a.onClick}
          >
            {a.label}
          </button>
        ))}
      </div>
    </li>
  );
}

/* -------------------------------- screen -------------------------------- */
export function Social() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { me } = useAuth();
  const copy = FM_COPY[normalizeLanguage(me?.app_language)];
  const lang = normalizeLanguage(me?.app_language);

  const [params] = useSearchParams();
  const initialTab = params.get("tab");
  const [tab, setTab] = useState<Tab>(
    initialTab === "received" || initialTab === "sent" ? initialTab : "friends",
  );
  const [deleteTarget, setDeleteTarget] = useState<Friend | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  // Add Friend opens from the header / empty states / a ?add=1 or ?tab=find deep
  // link (from the Friend League empty state). The incoming-request sheet opens
  // from a received-tab row or a ?request=<id> deep link.
  const [addOpen, setAddOpen] = useState(initialTab === "find" || params.get("add") === "1");
  const [incomingId, setIncomingId] = useState<string | null>(params.get("request"));

  // All three lists power the tab counts; they stay small and authoritative.
  const friends = useQuery({ queryKey: QK.friends, queryFn: friendApi.list });
  const received = useQuery({ queryKey: QK.received, queryFn: friendApi.received });
  const sent = useQuery({ queryKey: QK.sent, queryFn: friendApi.sent });

  function refreshAll() {
    [QK.friends, QK.received, QK.sent, ["league-rankings"]].forEach((key) =>
      qc.invalidateQueries({ queryKey: key }),
    );
  }

  async function act(id: string, fn: () => Promise<unknown>, done: string, plain = false) {
    if (busy.has(id)) return; // block duplicate taps
    setBusy((prev) => new Set(prev).add(id));
    try {
      await fn();
      // `plain` uses the icon-less charcoal snackbar (same as the invite-copy
      // confirmation) — e.g. the "…님과 친구가 되었어요!" acceptance message.
      if (plain) toast.show(done, "default", { icon: false });
      else toast.success(done);
      refreshAll();
    } catch (e) {
      // Reconcile in case the state already changed on another device.
      toast.error(errorMessage(e));
      refreshAll();
    } finally {
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  const removing = deleteTarget ? busy.has(deleteTarget.user_id) : false;
  async function confirmRemove() {
    if (!deleteTarget) return;
    await act(deleteTarget.user_id, () => friendApi.remove(deleteTarget.user_id), copy.toastRemoved);
    setDeleteTarget(null);
  }

  const activeQuery = tab === "friends" ? friends : tab === "received" ? received : sent;

  return (
    <div className="screen fm">
      {/* Header */}
      <header className="fm__header">
        <button className="fm__back" onClick={() => nav(-1)} aria-label={copy.back}>
          <BackChevron />
        </button>
        <h1 className="fm__title">{copy.title}</h1>
        <button className="fm__add" onClick={() => setAddOpen(true)} aria-label={copy.add}>
          <PlusIcon />
          <span>{copy.add}</span>
        </button>
      </header>

      {/* Tabs */}
      <div className="fm__tabs" role="tablist" aria-label={copy.title}>
        {(["friends", "received", "sent"] as const).map((t) => {
          const count = (t === "friends" ? friends : t === "received" ? received : sent).data?.count ?? 0;
          return (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={`fm__tab ${tab === t ? "is-active" : ""}`}
              onClick={() => setTab(t)}
            >
              {copy.tabs[t]} {count}
            </button>
          );
        })}
      </div>

      <div className="screen__body fm__body">
        {activeQuery.isLoading && !activeQuery.data ? (
          <div className="fm__pad">
            <SkeletonList rows={5} height={62} />
          </div>
        ) : activeQuery.error && !activeQuery.data ? (
          <ErrorState message={copy.listError} onRetry={() => activeQuery.refetch()} />
        ) : tab === "friends" ? (
          (friends.data?.friends.length ?? 0) === 0 ? (
            <FmEmpty title={copy.friendsEmptyTitle} desc={copy.friendsEmptyDesc} onAdd={() => setAddOpen(true)} addLabel={copy.add} />
          ) : (
            <ul className="fm__list" role="list">
              {friends.data!.friends.map((f) => (
                <FriendRow key={f.user_id} friend={f} copy={copy} onRemove={() => setDeleteTarget(f)} />
              ))}
            </ul>
          )
        ) : tab === "received" ? (
          (received.data?.requests.length ?? 0) === 0 ? (
            <FmEmpty title={copy.receivedEmptyTitle} desc={copy.receivedEmptyDesc} />
          ) : (
            <ul className="fm__list" role="list">
              {received.data!.requests.map((r) => (
                <RequestRow
                  key={r.request_id}
                  req={r}
                  copy={copy}
                  lang={lang}
                  busy={busy.has(r.request_id)}
                  onOpen={() => setIncomingId(r.request_id)}
                  actions={[
                    { label: copy.reject, onClick: () => act(r.request_id, () => friendApi.reject(r.request_id), copy.toastRejected) },
                    { label: copy.accept, primary: true, onClick: () => act(r.request_id, () => friendApi.accept(r.request_id), copy.toastAccepted(nameOf(r)), true) },
                  ]}
                />
              ))}
            </ul>
          )
        ) : (sent.data?.requests.length ?? 0) === 0 ? (
          <FmEmpty title={copy.sentEmptyTitle} desc={copy.sentEmptyDesc} onAdd={() => setAddOpen(true)} addLabel={copy.add} />
        ) : (
          <ul className="fm__list" role="list">
            {sent.data!.requests.map((r) => (
              <RequestRow
                key={r.request_id}
                req={r}
                copy={copy}
                lang={lang}
                busy={busy.has(r.request_id)}
                actions={[{ label: copy.cancel, onClick: () => act(r.request_id, () => friendApi.cancel(r.request_id), copy.toastCancelled) }]}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Friend deletion confirmation — backdrop does not dismiss (no onClose). */}
      <Dialog
        open={!!deleteTarget}
        title={deleteTarget ? copy.modalTitle(nameOf(deleteTarget)) : ""}
        text={copy.modalDesc}
      >
        <div className="fm__modal-actions">
          <Button variant="secondary" block disabled={removing} onClick={() => setDeleteTarget(null)}>
            {copy.modalCancel}
          </Button>
          <Button block loading={removing} onClick={confirmRemove}>
            {copy.modalDelete}
          </Button>
        </div>
      </Dialog>

      <AddFriendSheet open={addOpen} onClose={() => setAddOpen(false)} />
      <IncomingFriendRequestSheet
        open={!!incomingId}
        requestId={incomingId}
        onClose={() => setIncomingId(null)}
      />
    </div>
  );
}

const BackChevron = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M15 5l-7 7 7 7" stroke="#272c30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * Shared, centered empty state for every Friend Management tab — same heading /
 * body styles and vertical placement as the Friends tab. `onAdd` adds the
 * compact outlined "+ 친구 추가" button (Friends + Sent tabs); Received omits it.
 */
function FmEmpty({
  title,
  desc,
  onAdd,
  addLabel,
}: {
  title: string;
  desc: string[];
  onAdd?: () => void;
  addLabel?: string;
}) {
  return (
    <div className="fm__empty">
      <h2 className="fm__empty-title">{title}</h2>
      <p className="fm__empty-desc">
        {desc.map((line, i) => (
          <span key={line}>
            {i > 0 && <br />}
            {line}
          </span>
        ))}
      </p>
      {onAdd && (
        <button className="fm__empty-add" onClick={onAdd} aria-label={addLabel}>
          <PlusIcon />
          <span>{addLabel}</span>
        </button>
      )}
    </div>
  );
}

