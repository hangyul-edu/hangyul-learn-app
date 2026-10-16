import { useEffect, useRef } from "react";
import { useTranslation } from "../i18n";
import { HangyulAiMessage } from "./HangyulAiMessage";
import type { ChatMessage } from "../lib/types";
import { Spinner } from "./ui/Spinner";
import { CloseIcon } from "./brand/Glyphs";
import icChatSend from "../assets/brand/ic-chat-send.svg";

/**
 * Presentational shell for the 물어보기 chatbot bottom sheet — the single shared
 * UI used by the in-session AskAiSheet (study-item context) and the page-level
 * ChatbotBottomSheet (Personalized Learning / Lecture). All conversation state
 * and API calls live in the parent; this renders the sheet + composer, keeps
 * the newest message in view, and locks background scroll while open.
 */
export function ChatSheetView({
  messages,
  loading,
  errorText,
  onRetry,
  draft,
  sending,
  canSend,
  onDraft,
  onSend,
  onClose,
  dataSource,
  limitNotice = null,
}: {
  messages: ChatMessage[];
  loading: boolean;
  errorText?: string | null;
  onRetry?: () => void;
  draft: string;
  sending: boolean;
  canSend: boolean;
  onDraft: (value: string) => void;
  onSend: () => void;
  onClose: () => void;
  /** Identifies the surface that opened the sheet (for analytics / e2e). */
  dataSource?: string;
  /** The day's question limit while the limit-reached notice is up (see
   *  lib/aiQuestionLimit), else null. */
  limitNotice?: number | null;
}) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Keep the latest message in view. (`scrollTo` is guarded — jsdom lacks it.)
  useEffect(() => {
    const el = scrollRef.current;
    el?.scrollTo?.({ top: el.scrollHeight });
  }, [messages, loading]);

  // Lock background scroll while the sheet is open (it mounts only when open).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Rendered inside the current screen (a viewport-height, position: relative
  // box) so the absolute overlay attaches to it — like the League Guide sheet —
  // and the sheet stays fully visible regardless of the page's scroll position.
  return (
    <div className="askai" role="dialog" aria-modal="true" aria-label={t("chat.ask")} data-source={dataSource}>
      <div className="askai__backdrop" onClick={onClose} />
      <div className="askai__sheet">
        <header className="askai__header">
          <h2 className="askai__title">{t("chat.ask")}</h2>
          <button className="askai__close" onClick={onClose} aria-label={t("chat.closeA11y")}>
            <CloseIcon size={28} color="#111" weight={2} />
          </button>
        </header>

        {/* The free plan's questions are used up (744:48051 KO / 784:55468 EN):
            over the top of the sheet, under the title. */}
        {limitNotice != null && (
          <div className="askai__limit" role="alert">
            <p className="askai__limit-line">{t("chat.limitReached", { limit: limitNotice })}</p>
            <p className="askai__limit-line">{t("chat.limitUpsell")}</p>
          </div>
        )}

        <div className="askai__messages" ref={scrollRef}>
          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.message_id} className="askai__msg askai__msg--user">
                {m.content.split("\n").map((line, i) => (
                  <p key={i} className="askai__msg-line">
                    {line}
                  </p>
                ))}
              </div>
            ) : (
              <HangyulAiMessage key={m.message_id}>
                {m.content.split("\n").map((line, i) => (
                  <p key={i} className="askai__msg-line">
                    {line}
                  </p>
                ))}
              </HangyulAiMessage>
            ),
          )}
          {loading && (
            <HangyulAiMessage bubbleClassName="askai__msg--loading" bubbleAriaLabel={t("chat.loading")}>
              <span className="askai__dot" />
              <span className="askai__dot" />
              <span className="askai__dot" />
            </HangyulAiMessage>
          )}
          {errorText && !loading && (
            <HangyulAiMessage>
              <p className="askai__msg-line">{errorText}</p>
              {onRetry && (
                <button className="askai__retry" onClick={onRetry}>
                  {t("common.retry")}
                </button>
              )}
            </HangyulAiMessage>
          )}
        </div>

        <p className="askai__disclaimer">{t("chat.disclaimer")}</p>

        <div className="askai__composer">
          <input
            className="askai__input"
            placeholder={t("chat.inputPlaceholder")}
            value={draft}
            onChange={(e) => onDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                onSend();
              }
            }}
            maxLength={2000}
            aria-label={t("chat.inputA11y")}
          />
          <button
            className="askai__send"
            onClick={onSend}
            disabled={!draft.trim() || sending || !canSend}
            aria-label={t("chat.send")}
          >
            {sending ? (
              <Spinner size={18} stroke={2} />
            ) : (
              /* Group 3873 (744:48278) — the exported 13x12 arrow (14.5x13.5
                 with its stroke), centred in the 30x30 button. */
              <img className="askai__send-ic" src={icChatSend} alt="" aria-hidden="true" width={14.5} height={13.5} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
