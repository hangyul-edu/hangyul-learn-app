import { useQuery } from "@tanstack/react-query";
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
export function SupportChatButton() {
  const { t } = useTranslation();
  const { me } = useAuth();
  const toast = useToast();

  // Server-signed identity for verified ChannelTalk identification. Prefetched
  // once the user is logged in so the hash is ready by the time they tap; the
  // hash is stable for the session, so it never needs refetching. A pending or
  // failed fetch simply falls back to unverified identification.
  const identity = useQuery({
    queryKey: ["channel-talk-identity"],
    queryFn: supportApi.channelTalkIdentity,
    enabled: Boolean(me),
    staleTime: Infinity,
    retry: false,
  });

  function handleClick() {
    const ok = openCustomerSupportChat(
      me
        ? {
            id: me.user_id,
            name: me.name,
            nickname: me.nickname,
            memberHash: identity.data?.member_hash ?? null,
          }
        : null,
    );
    if (!ok) {
      toast.error(t("faq.chatSupportError"));
    }
  }

  return (
    <button type="button" className="faq__support" onClick={handleClick} aria-label={t("faq.chatSupport")}>
      <span className="faq__support-icon" aria-hidden="true">💬</span>
      <span>{t("faq.chatSupport")}</span>
    </button>
  );
}
