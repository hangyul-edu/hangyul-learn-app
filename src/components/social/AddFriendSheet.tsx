/**
 * Add Friend + Incoming Friend Request bottom sheets.
 *
 * Both render inside the shared `Sheet` (dimmed backdrop, slide-up, rounded
 * top, safe-area aware, hardware-back to close). All data comes from the real
 * friend APIs; nothing is hardcoded. API + cache coordination lives here — the
 * avatar/button primitives stay presentational.
 */
import { useState } from "react";
import { useTranslation } from "../../i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sheet } from "../ui/Modal";
import { Button } from "../ui/kit";
import { CountrySelect } from "../ui/CountrySelect";
import { SkeletonList } from "../ui/states";
import { RankAvatar } from "../brand/RankBits";
import { friendApi } from "../../api/endpoints";
import { useRefreshSocial } from "../../api/queries";
import { useBusyKeys } from "../../hooks/useBusyKeys";
import { useToast } from "../../hooks/toast";
import { errorMessage } from "../../lib/http";
import { DEFAULT_PHONE_COUNTRY, applyPhoneInput, hashPhone, isLikelyPhone, phoneExample } from "../../lib/phone";
import { getContactPhoneHashes } from "../../lib/contacts";
import type { RecommendedUser } from "../../lib/types";
import { InfoBox, SearchIcon, SheetHeader, nameOf } from "./sheetParts";
import { CancelRequestDialog } from "./CancelRequestDialog";

export { IncomingFriendRequestSheet } from "./IncomingFriendRequestSheet";

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

/* ----------------------------- Add Friend ------------------------------- */
export function AddFriendSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const copy = useAddCopy();
  const toast = useToast();
  const qc = useQueryClient();
  const refreshSocial = useRefreshSocial();

  // Selected country as an ISO code (flag+chevron picker); E.164
  // normalization/hashing reads the country's rules from it.
  const [country, setCountry] = useState<string>(DEFAULT_PHONE_COUNTRY);
  const [phone, setPhone] = useState("");
  const [searchState, setSearchState] = useState<"idle" | "searching" | "error">("idle");
  const [result, setResult] = useState<RecommendedUser | "none" | null>(null);
  const { busy, run } = useBusyKeys();
  const [sharing, setSharing] = useState(false);
  const { t } = useTranslation();
  // A member without a nickname (the server never sends a non-friend's
  // account name) is shown by the default name, as elsewhere in social.
  const shownName = (u: RecommendedUser) => nameOf(u, t("home.defaultNickname"));
  const [cancelTarget, setCancelTarget] = useState<RecommendedUser | null>(null);
  async function confirmCancel() {
    const target = cancelTarget;
    if (!target?.request_id) return;
    await act(target.user_id, () => friendApi.cancel(target.request_id!), copy.requestCancelled);
    setCancelTarget(null);
  }

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
    const ran = await run(userId, async () => {
      try {
        await fn();
        // The cp_G_03_toast bar at the bottom of the screen, as after every
        // friend action (Social's accept / reject / cancel / remove).
        toast.show(done, "notice");
      } catch (e) {
        toast.error(errorMessage(e));
      }
    });
    if (!ran) return;
    refreshSocial();
    refreshDiscovery();
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
    const label = shownName(u);
    switch (u.relationship) {
      case "none":
        return { text: copy.sendRequest, onClick: () => act(u.user_id, () => friendApi.request(u.user_id), copy.requestSent) };
      case "request_sent":
        // Confirmed first (CancelRequestDialog), never cancelled on the first tap.
        return { text: copy.cancelRequest, onClick: () => u.request_id && setCancelTarget(u) };
      case "request_received":
        return {
          text: copy.accept,
          primary: true,
          onClick: () =>
            u.request_id &&
            act(
              u.user_id,
              () => friendApi.accept(u.request_id!),
              t("friends.toastAccepted", { name: nameOf(u, t("home.defaultNickname")) }),
            ),
        };
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
            placeholder={phoneExample(country)}
            value={phone}
            onChange={(e) => {
              // A pasted "+44 …" moves the picker to that country.
              const next = applyPhoneInput(country, e.target.value);
              setCountry(next.country);
              setPhone(next.input);
              // The result belonged to the number as searched; editing it
              // brings the suggestions back until the next search.
              setResult(null);
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
        {/* LEG-020 (1816:25317): the card holds only the avatar and name; its
            action is the sheet's bottom button, in the invite link's slot
            (the suggestions and invite are hidden while a result shows). */}
        {result && result !== "none" && (
          <>
            <div className="afs__result" aria-label={copy.ctaState(shownName(result), result.relationship)}>
              <RankAvatar entry={result} size={60} />
              <div className="afs__result-name">{shownName(result)}</div>
              {result.relationship === "friends" && <div className="afs__friends-tag">{copy.friendsLabel}</div>}
            </div>
            {result.relationship !== "friends" && (
              <Button
                block
                variant={cta(result).muted ? "secondary" : "primary"}
                loading={busy.has(result.user_id)}
                onClick={cta(result).onClick}
              >
                {cta(result).text}
              </Button>
            )}
          </>
        )}

        {/* Contact recommendations — LEG-020 (1816:25317): a search result
            takes their place rather than stacking above them. */}
        {result === null && (
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
                    <li key={u.user_id} className="afs__rec" aria-label={copy.ctaState(shownName(u), u.relationship)}>
                      <RankAvatar entry={u} size={44} />
                      <span className="afs__rec-name">{shownName(u)}</span>
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
        )}

        {/* Invite link — shown when there is nothing better to suggest */}
        {result === null && !recs.isLoading && recommendations.length === 0 && (
          <Button block loading={sharing} onClick={shareInvite} aria-label={copy.inviteAria}>
            {copy.invite}
          </Button>
        )}
      </div>
      {/* Inside the sheet so it stacks above it and shares its frame. */}
      <CancelRequestDialog
        name={cancelTarget ? nameOf(cancelTarget, t("home.defaultNickname")) : null}
        busy={cancelTarget ? busy.has(cancelTarget.user_id) : false}
        onBack={() => setCancelTarget(null)}
        onConfirm={confirmCancel}
      />
    </Sheet>
  );
}
