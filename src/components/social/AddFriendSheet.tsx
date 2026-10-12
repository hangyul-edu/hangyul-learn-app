/**
 * Add Friend + Incoming Friend Request bottom sheets.
 *
 * Both render inside the shared `Sheet` (dimmed backdrop, slide-up, rounded
 * top, safe-area aware, hardware-back to close). All data comes from the real
 * friend APIs; nothing is hardcoded. API + cache coordination lives here — the
 * avatar/button primitives stay presentational.
 */
import { useMemo, useState } from "react";
import { useTranslation } from "../../i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sheet } from "../ui/Modal";
import { Button } from "../ui/kit";
import { CountrySelect } from "../ui/CountrySelect";
import { SkeletonList } from "../ui/states";
import { RankAvatar } from "../brand/RankBits";
import { friendApi } from "../../api/endpoints";
import { useToast } from "../../hooks/toast";
import { errorMessage } from "../../lib/http";
import { DEFAULT_PHONE_COUNTRY, applyPhoneInput, hashPhone, isLikelyPhone } from "../../lib/phone";
import { getContactPhoneHashes } from "../../lib/contacts";
import type { RecommendedUser } from "../../lib/types";

/* ------------------------------ localization ---------------------------- */
/** Add-friend sheet copy, bound to the active language (`addFriend.*`). */
function useAddCopy() {
  const { t } = useTranslation();
  return {
    title: t("addFriend.title"),
    close: t("addFriend.close"),
    infoAcceptance: t("addFriend.infoAcceptance"),
    infoVisibility: t("addFriend.infoVisibility"),
    searchLabel: t("addFriend.searchLabel"),
    searchPlaceholder: t("addFriend.searchPlaceholder"),
    searchAria: t("addFriend.searchAria"),
    search: t("addFriend.search"),
    suggested: t("addFriend.suggested"),
    suggestedSub: t("addFriend.suggestedSub"),
    noRecommendations: t("addFriend.noRecommendations"),
    invite: t("addFriend.invite"),
    inviteAria: t("addFriend.inviteAria"),
    sendRequest: t("addFriend.sendRequest"),
    cancelRequest: t("addFriend.cancelRequest"),
    accept: t("addFriend.accept"),
    friendsLabel: t("addFriend.friendsLabel"),
    notFoundTitle: t("addFriend.notFoundTitle"),
    notFoundSub: t("addFriend.notFoundSub"),
    requestSent: t("addFriend.requestSent"),
    requestCancelled: t("addFriend.requestCancelled"),
    requestAccepted: t("addFriend.requestAccepted"),
    linkCopied: t("addFriend.linkCopied"),
    linkCopyFailed: t("addFriend.linkCopyFailed"),
    ctaState: (name: string, rel: string) =>
      t(
        rel === "friends"
          ? "addFriend.ctaFriends"
          : rel === "request_sent"
            ? "addFriend.ctaRequestSent"
            : rel === "request_received"
              ? "addFriend.ctaRequestReceived"
              : "addFriend.ctaCanRequest",
        { name },
      ),
  };
}

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

const nameOf = (u: { nickname?: string | null }, fallback: string) => u.nickname ?? fallback;

const CloseIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" stroke="#262c31" strokeWidth="2.2" strokeLinecap="round" />
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
  const copy = useAddCopy();
  const toast = useToast();
  const qc = useQueryClient();
  const refreshSocial = useSocialRefresh();

  // Selected country as an ISO code (flag+chevron picker); E.164
  // normalization/hashing reads the country's rules from it.
  const [country, setCountry] = useState<string>(DEFAULT_PHONE_COUNTRY);
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
      const res = await friendApi.searchPhone(await hashPhone(country, phone));
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

        {/* Phone search — cp_D_01_inputFields (2382:25193): a Caption 2 label
            4px above the row, then the country selector and the input. */}
        <p className="afs__field-label">{copy.searchLabel}</p>
        <div className="afs__search">
          <CountrySelect value={country} onChange={setCountry} className="afs__dial" />
          <div className={`afs__phone-field ${phone ? "is-filled" : ""}`}>
          <input
            className="afs__phone"
            inputMode="tel"
            type="tel"
            aria-label={copy.searchAria}
            placeholder={copy.searchPlaceholder}
            value={phone}
            onChange={(e) => {
              // A pasted "+44 …" moves the picker to that country.
              const next = applyPhoneInput(country, e.target.value);
              setCountry(next.country);
              setPhone(next.input);
            }}
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
          <div className="afs__section-head">
            <h3 className="afs__section-title">{copy.suggested}</h3>
            <p className="afs__section-sub">{copy.suggestedSub}</p>
          </div>
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
  const copy = useIncomingCopy();
  const { t } = useTranslation();
  const toast = useToast();
  const refreshSocial = useSocialRefresh();
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
