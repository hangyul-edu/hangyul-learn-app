import { openCustomerSupportChat } from "../../lib/customerSupport";
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
  const { me } = useAuth();
  const toast = useToast();

  function handleClick() {
    const ok = openCustomerSupportChat(
      me ? { id: me.user_id, name: me.name, nickname: me.nickname } : null,
    );
    if (!ok) {
      toast.error("상담 채팅을 열 수 없어요. 잠시 후 다시 시도해 주세요.");
    }
  }

  return (
    <button type="button" className="faq__support" onClick={handleClick} aria-label="채팅 상담하기">
      <span className="faq__support-icon" aria-hidden="true">💬</span>
      <span>채팅 상담하기</span>
    </button>
  );
}
