import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation, type Translate } from "../i18n";
import { useQuery } from "@tanstack/react-query";
import { Button } from "../components/ui/kit";
import { Dialog } from "../components/ui/Modal";
import { ErrorState, SkeletonList } from "../components/ui/states";
import { RankAvatar } from "../components/brand/RankBits";
import { AddFriendSheet, IncomingFriendRequestSheet } from "../components/social/AddFriendSheet";
import { CancelRequestDialog } from "../components/social/CancelRequestDialog";
import { friendApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import { localeFor, timeAgo } from "../lib/format";
import type { Friend, FriendRequest } from "../lib/types";
import { DetailHeader } from "../components/DetailHeader";
import { PlusIcon } from "../components/PlusIcon";
import { SOCIAL_KEYS, useRefreshSocial } from "../api/queries";
import { useBusyKeys } from "../hooks/useBusyKeys";

type Tab = "friends" | "received" | "sent";

/* ------------------------------ localization ---------------------------- */
type FmCopy = ReturnType<typeof useFmCopy>;

/** Friend-management copy, bound to the active language (`friends.*`). */
function useFmCopy() {
  const { t, language } = useTranslation();
  return {
    title: t("friends.title"),
    back: t("common.back"),
    add: t("friends.add"),
    addShort: t("friends.addShort"),
    tabs: {
      friends: t("friends.tabFriends"),
      received: t("friends.tabReceived"),
      sent: t("friends.tabSent"),
    },
    remove: t("friends.remove"),
    reject: t("friends.reject"),
    accept: t("friends.accept"),
    cancel: t("common.cancel"),
    openRequest: t("friends.openRequest"),
    friendsEmptyTitle: t("friends.friendsEmptyTitle"),
    friendsEmptyDesc: [t("friends.friendsEmptyDesc1"), t("friends.friendsEmptyDesc2")],
    receivedEmptyTitle: t("friends.receivedEmptyTitle"),
    receivedEmptyDesc: [t("friends.receivedEmptyDesc1"), t("friends.receivedEmptyDesc2")],
    sentEmptyTitle: t("friends.sentEmptyTitle"),
    sentEmptyDesc: [t("friends.sentEmptyDesc1"), t("friends.sentEmptyDesc2")],
    listError: t("friends.listError"),
    modalTitle: (n: string) => t("friends.modalTitle", { name: n }),
    modalDesc: t("friends.modalDesc"),
    modalCancel: t("common.cancel"),
    modalDelete: t("friends.remove"),
    toastAccepted: (name: string) => t("friends.toastAccepted", { name }),
    toastRejected: t("friends.toastRejected"),
    toastCancelled: t("friends.toastCancelled"),
    toastRemoved: t("friends.toastRemoved"),
    /* Both locales wrap the relative time: "2시간 전 요청" / "Requested 2h
       ago" (LEG-015 1815:25241, LEG-016 1816:24265), computed here from
       `created_at` in the app's language. The server's `relative_time` is
       English prose ("Sent 1 day ago"); preferring it put "Sent 1 day ago 요청"
       on the Korean list, so it is only the fallback when there is no date. */
    requestAge: (iso?: string, preformatted?: string | null) => {
      const age = iso ? timeAgo(iso, t, localeFor(language)) : preformatted ?? "";
      return age ? t("friends.requestAge", { age }) : "";
    },
  };
}

/** Display name with the shared fallback; `t` is passed since this is not a hook. */
const nameOf = (
  u: { nickname?: string | null },
  t: Translate,
) => u.nickname ?? t("home.defaultNickname");

/* -------------------------------- rows ---------------------------------- */
function FriendRow({ friend, copy, onRemove }: { friend: Friend; copy: FmCopy; onRemove: () => void }) {
  const { t } = useTranslation();
  return (
    <li className="fm__row" aria-label={`${nameOf(friend, t)}, ${copy.remove}`}>
      <span className="fm__row-avatar">
        <RankAvatar entry={friend} size={48} />
      </span>
      <span className="fm__row-name">{nameOf(friend, t)}</span>
      <button className="fm__pill" onClick={onRemove}>{copy.remove}</button>
    </li>
  );
}

function RequestRow({
  req,
  copy,
  busy,
  actions,
  onOpen,
}: {
  req: FriendRequest;
  copy: FmCopy;
  busy: boolean;
  actions: { label: string; primary?: boolean; onClick: () => void }[];
  /** When set, the avatar + name open the full request sheet (received tab). */
  onOpen?: () => void;
}) {
  const { t } = useTranslation();
  const age = copy.requestAge(req.created_at, req.relative_time);
  const identity = (
    <>
      <span className="fm__row-avatar">
        <RankAvatar entry={req} size={48} />
      </span>
      <div className="fm__row-main">
        <div className="fm__row-name">{nameOf(req, t)}</div>
        <div className="fm__row-age">{age}</div>
      </div>
    </>
  );
  return (
    <li className="fm__row" aria-label={`${nameOf(req, t)}, ${age}, ${actions.map((a) => a.label).join(", ")}`}>
      {onOpen ? (
        <button className="fm__row-open" onClick={onOpen} aria-label={`${nameOf(req, t)} ${copy.openRequest}`}>
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
  const { t } = useTranslation();
  const toast = useToast();
  const copy = useFmCopy();

  const [params] = useSearchParams();
  const initialTab = params.get("tab");
  const [tab, setTab] = useState<Tab>(
    initialTab === "received" || initialTab === "sent" ? initialTab : "friends",
  );
  const [deleteTarget, setDeleteTarget] = useState<Friend | null>(null);
  const { busy, run } = useBusyKeys();
  // Add Friend opens from the header / empty states / a ?add=1 or ?tab=find deep
  // link. The incoming-request sheet opens
  // from a received-tab row or a ?request=<id> deep link.
  const [addOpen, setAddOpen] = useState(initialTab === "find" || params.get("add") === "1");
  const [incomingId, setIncomingId] = useState<string | null>(params.get("request"));

  // All three lists power the tab counts; they stay small and authoritative.
  const friends = useQuery({ queryKey: SOCIAL_KEYS.friends, queryFn: friendApi.list });
  const received = useQuery({ queryKey: SOCIAL_KEYS.received, queryFn: friendApi.received });
  const sent = useQuery({ queryKey: SOCIAL_KEYS.sent, queryFn: friendApi.sent });

  const refreshAll = useRefreshSocial();

  async function act(
    id: string,
    fn: () => Promise<unknown>,
    done: string,
    style: "success" | "plain" | "notice" = "success",
  ) {
    // One request per row at a time (duplicate taps are dropped).
    await run(id, async () => {
      try {
        await fn();
        // `plain` uses the icon-less charcoal snackbar (same as the invite-copy
        // confirmation) — e.g. the "…님과 친구가 되었어요!" acceptance message;
        // `notice` is the cp_G_03_toast bar at the bottom of the screen.
        if (style === "plain") toast.show(done, "default", { icon: false });
        else if (style === "notice") toast.show(done, "notice");
        else toast.success(done);
        refreshAll();
      } catch (e) {
        // Reconcile in case the state already changed on another device.
        toast.error(errorMessage(e));
        refreshAll();
      }
    });
  }

  const removing = deleteTarget ? busy.has(deleteTarget.user_id) : false;
  async function confirmRemove() {
    if (!deleteTarget) return;
    await act(deleteTarget.user_id, () => friendApi.remove(deleteTarget.user_id), copy.toastRemoved, "notice");
    setDeleteTarget(null);
  }

  // A sent request is cancelled only once the confirmation says so; the
  // charcoal notice (cp_G_03_toast) then says it was.
  const [cancelTarget, setCancelTarget] = useState<FriendRequest | null>(null);
  const cancelling = cancelTarget ? busy.has(cancelTarget.request_id) : false;
  async function confirmCancel() {
    if (!cancelTarget) return;
    const { request_id } = cancelTarget;
    await act(request_id, () => friendApi.cancel(request_id), copy.toastCancelled, "notice");
    setCancelTarget(null);
  }

  const activeQuery = tab === "friends" ? friends : tab === "received" ? received : sent;

  return (
    <div className="screen fm">
      {/* Header */}
      <DetailHeader
        title={copy.title}
        backLabel={copy.back}
        trailing={
          <button className="fm__add" onClick={() => setAddOpen(true)} aria-label={copy.add}>
            <PlusIcon />
            <span>{copy.addShort}</span>
          </button>
        }
      />

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
            <FmEmpty title={copy.friendsEmptyTitle} desc={copy.friendsEmptyDesc} onAdd={() => setAddOpen(true)} addLabel={copy.add} addText={copy.addShort} />
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
                  busy={busy.has(r.request_id)}
                  onOpen={() => setIncomingId(r.request_id)}
                  actions={[
                    { label: copy.reject, onClick: () => act(r.request_id, () => friendApi.reject(r.request_id), copy.toastRejected) },
                    { label: copy.accept, primary: true, onClick: () => act(r.request_id, () => friendApi.accept(r.request_id), copy.toastAccepted(nameOf(r, t)), "notice") },
                  ]}
                />
              ))}
            </ul>
          )
        ) : (sent.data?.requests.length ?? 0) === 0 ? (
          <FmEmpty title={copy.sentEmptyTitle} desc={copy.sentEmptyDesc} onAdd={() => setAddOpen(true)} addLabel={copy.add} addText={copy.addShort} />
        ) : (
          <ul className="fm__list" role="list">
            {sent.data!.requests.map((r) => (
              <RequestRow
                key={r.request_id}
                req={r}
                copy={copy}
                busy={busy.has(r.request_id)}
                actions={[{ label: copy.cancel, onClick: () => setCancelTarget(r) }]}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Friend deletion confirmation — backdrop does not dismiss (no onClose). */}
      <Dialog
        open={!!deleteTarget}
        title={deleteTarget ? copy.modalTitle(nameOf(deleteTarget, t)) : ""}
        text={copy.modalDesc}
      >
        {/* LEG-013 (I1815:24869;841:23566): both slots are cp_C_01_primaryBtn —
            two 136x49 r12 tiles 8 apart, the dismissing one on bgray.400 and the
            committing one on Brand 1, with ONE drop shadow on the row. Not an
            outline button, and not a per-button shadow. */}
        <div className="dialog__actions">
          <Button variant="ghost" block disabled={removing} onClick={() => setDeleteTarget(null)}>
            {copy.modalCancel}
          </Button>
          <Button variant="primary" block loading={removing} onClick={confirmRemove}>
            {copy.modalDelete}
          </Button>
        </div>
      </Dialog>

      <CancelRequestDialog
        name={cancelTarget ? nameOf(cancelTarget, t) : null}
        busy={cancelling}
        onBack={() => setCancelTarget(null)}
        onConfirm={confirmCancel}
      />

      <AddFriendSheet open={addOpen} onClose={() => setAddOpen(false)} />
      <IncomingFriendRequestSheet
        open={!!incomingId}
        requestId={incomingId}
        onClose={() => setIncomingId(null)}
      />
    </div>
  );
}


/**
 * Shared, centered empty state for every Friend Management tab — same heading /
 * body styles and vertical placement as the Friends tab. `onAdd` adds the
 * compact outlined t("friends.addFriendCta") button (Friends + Sent tabs); Received omits it.
 */
function FmEmpty({
  title,
  desc,
  onAdd,
  addLabel,
  addText,
}: {
  title: string;
  desc: string[];
  onAdd?: () => void;
  /** Accessible name — the fuller "Add Friend" / "친구 추가". */
  addLabel?: string;
  /** Visible label. LEG-014 (1653:23119) prints just "Add" here, the same
   *  short form the header button uses. */
  addText?: string;
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
          <span>{addText ?? addLabel}</span>
        </button>
      )}
    </div>
  );
}

