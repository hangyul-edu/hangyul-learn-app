import { useEffect, useRef } from "react";
import { HangyulAiMessage } from "./HangyulAiMessage";
import type { ChatMessage } from "../lib/types";

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
}) {
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

  return (
    <div className="askai" role="dialog" aria-modal="true" aria-label="물어보기" data-source={dataSource}>
      <div className="askai__backdrop" onClick={onClose} />
      <div className="askai__sheet">
        <header className="askai__header">
          <h2 className="askai__title">물어보기</h2>
          <button className="askai__close" onClick={onClose} aria-label="물어보기 창 닫기">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="#111" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </header>

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
            <HangyulAiMessage bubbleClassName="askai__msg--loading" bubbleAriaLabel="답변을 불러오는 중">
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
                  다시 시도
                </button>
              )}
            </HangyulAiMessage>
          )}
        </div>

        <p className="askai__disclaimer">AI 답변은 완벽하지 않거나 실수할 수 있어요. 참고용으로 활용해주세요.</p>

        <div className="askai__composer">
          <input
            className="askai__input"
            placeholder="채팅을 입력하세요."
            value={draft}
            onChange={(e) => onDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                onSend();
              }
            }}
            maxLength={2000}
            aria-label="채팅 입력"
          />
          <button
            className="askai__send"
            onClick={onSend}
            disabled={!draft.trim() || sending || !canSend}
            aria-label="메시지 보내기"
          >
            {sending ? (
              <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 20V5M6 11l6-6 6 6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
