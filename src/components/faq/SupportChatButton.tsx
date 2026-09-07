import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "../../i18n";
import { openCustomerSupportChat } from "../../lib/customerSupport";
import { supportApi } from "../../api/endpoints";
import { useAuth } from "../../hooks/auth";
import { useToast } from "../../hooks/toast";

/**
 * Floating orange "채팅 상담하기" button pinned to the bottom-right of every
 * FAQ screen. Opens ChannelTalk through the shared wrapper — never the Hangyul
 * AI chatbot and never an internal placeholder page.
 *
 * Positioned `absolute` inside the FAQ scaffold (`.faq`, which is
 * `position: relative` and fills the app frame), so it floats above the
 * scrolling content and stays inside the 480px app viewport.
 */
/**
 * Query options for the server-signed identity, keyed by user.
 *
 * The key carries the user id so a second account signing in on the same tab
 * cannot inherit the first account's member hash out of the cache — that hash
 * signs a *different* member id, and ChannelTalk rejects the mismatch.
 *
 * The hash is stable for the account's lifetime, hence `staleTime: Infinity`;
 * one retry keeps a single transient failure from stranding the session as
 * unverified without making a tap wait on a long backoff chain.
 */
function identityQuery(userId: string | undefined) {
  return {
    queryKey: ["channel-talk-identity", userId] as const,
    queryFn: supportApi.channelTalkIdentity,
    staleTime: Infinity,
    retry: 1,
  };
}

export function SupportChatButton() {
  const { t } = useTranslation();
  const { me } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [resolving, setResolving] = useState(false);

  // Prefetched as soon as the user is logged in, so the hash is normally
  // already in the cache by the time they tap.
  const options = identityQuery(me?.user_id);
  const identity = useQuery({ ...options, enabled: Boolean(me) });

  async function handleClick() {
    if (resolving) return;

    // The prefetch may not have landed yet (tapped immediately after login) or
    // may have failed outright. Resolve it on demand rather than opening an
    // unverified session that stays unverified until the app is reloaded;
    // `fetchQuery` joins the in-flight request when there is one.
    let memberHash = identity.data?.member_hash ?? null;
    if (me && !memberHash) {
      setResolving(true);
      try {
        const fresh = await queryClient.fetchQuery(options);
        memberHash = fresh.member_hash ?? null;
      } catch {
        // Support must stay reachable even when identity signing is down:
        // fall back to unverified identification.
        memberHash = null;
      } finally {
        setResolving(false);
      }
    }

    const ok = openCustomerSupportChat(
      me ? { id: me.user_id, name: me.name, nickname: me.nickname, memberHash } : null,
    );
    if (!ok) {
      toast.error(t("faq.chatSupportError"));
    }
  }

  return (
    <button
      type="button"
      className="faq__support"
      onClick={handleClick}
      aria-busy={resolving || undefined}
      aria-label={t("faq.chatSupport")}
    >
      <span className="faq__support-icon" aria-hidden="true">💬</span>
      <span>{t("faq.chatSupport")}</span>
    </button>
  );
}
