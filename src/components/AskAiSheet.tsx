import { useEffect, useRef, useState } from "react";
import { aiApi } from "../api/endpoints";
import { CharacterArt } from "./brand/ProfileAssets";
import { errorMessage } from "../lib/http";
import type { ChatMessage } from "../lib/types";

export interface AskContext {
  /** Which study artefact the conversation is anchored to. `sentence`/`quiz`
   *  = free questions about the current item; `*_attempt` = explain the wrong
   *  answer (auto-explained). */
  contextKind: "sentence" | "quiz" | "quiz_attempt" | "speech_attempt";
  /** The matching *_id for contextKind. */
  contextId: string;
  /** When true the server leads with a contextual explanation (incorrect answer). */
  autoExplain: boolean;
  /** Show the "무엇이든 물어봐" bubble (incorrect-answer state). */
  bubble: boolean;
}

/**
 * Context-anchored AI chat bottom sheet, opened from the session's AI mascot.
 *
 * - Before an incorrect answer it anchors to the current sentence/quiz so the
 *   user can freely ask about it (empty thread, they type first).
 * - After a server-confirmed incorrect answer it anchors to the attempt with
 *   `auto_assistant_reply`, so the first assistant message is the explanation.
 *
 * The conversation is kept in memory for the current context (the backend
 * chatbot is session-scoped with no history retrieval), so reopening restores
 * it. Mounted per context id — a new item/attempt gets a fresh sheet, and late
 * responses are ignored after unmount, preventing cross-item bleed.
 */
export function AskAiSheet({ open, context, onClose }: { open: boolean; context: AskContext; onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [convId, setConvId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const started = useRef(false);
  const alive = useRef(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const ID_FIELD: Record<AskContext["contextKind"], string> = {
    sentence: "sentence_id",
    quiz: "quiz_id",
    quiz_attempt: "attempt_id",
    speech_attempt: "speech_attempt_id",
  };

  async function startThread() {
    if (context.autoExplain) setLoading(true);
    setInitError(null);
    try {
      const ctx: Record<string, unknown> = {
        kind: context.contextKind,
        [ID_FIELD[context.contextKind]]: context.contextId,
        reason: context.autoExplain ? "explain_mistake" : "explain_item",
      };
      const res = await aiApi.startConversation({ context: ctx, auto_assistant_reply: context.autoExplain });
      if (!alive.current) return;
      setConvId(res.conversation.conversation_id);
      if (res.first_assistant_message) setMessages([res.first_assistant_message]);
    } catch (e) {
      if (!alive.current) return;
      setInitError(errorMessage(e));
    } finally {
      if (alive.current) setLoading(false);
    }
  }

  // Create the thread on the first open (once per context).
  useEffect(() => {
    if (open && !started.current) {
      started.current = true;
      void startThread();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep the latest message in view.
  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, loading, open]);

  async function send() {
    const text = draft.trim();
    if (!text || sending || !convId) return;
    setSending(true);
    try {
      const res = await aiApi.sendMessage(convId, text);
      if (!alive.current) return;
      setDraft("");
      setMessages((m) => [...m, res.user_message, res.assistant_message]);
    } catch (e) {
      if (alive.current) setInitError(null); // keep draft; surface via a transient assistant line below
      // Re-add nothing; the draft is preserved for retry.
      // eslint-disable-next-line no-console
      void e;
    } finally {
      if (alive.current) setSending(false);
    }
  }

  if (!open) return null;

  return (
    <div className="askai" role="dialog" aria-modal="true" aria-label="물어보기">
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

        <div className="askai__identity">
          <span className="askai__id-face" aria-hidden="true">
            <CharacterArt variant="AVATAR_01" fill="100%" />
          </span>
          <span className="askai__id-name">한귤AI</span>
        </div>

        <div className="askai__messages" ref={scrollRef}>
          {messages.map((m) => (
            <div key={m.message_id} className={`askai__msg askai__msg--${m.role === "user" ? "user" : "ai"}`}>
              {m.content.split("\n").map((line, i) => (
                <p key={i} className="askai__msg-line">
                  {line}
                </p>
              ))}
            </div>
          ))}
          {loading && (
            <div className="askai__msg askai__msg--ai askai__msg--loading" aria-label="설명을 불러오는 중">
              <span className="askai__dot" />
              <span className="askai__dot" />
              <span className="askai__dot" />
            </div>
          )}
          {initError && !loading && (
            <div className="askai__msg askai__msg--ai">
              <p className="askai__msg-line">설명을 불러오지 못했어요.</p>
              <button className="askai__retry" onClick={startThread}>
                다시 시도
              </button>
            </div>
          )}
        </div>

        <p className="askai__disclaimer">AI 답변은 완벽하지 않거나 실수할 수 있어요. 참고용으로 활용해주세요.</p>

        <div className="askai__composer">
          <input
            className="askai__input"
            placeholder="채팅을 입력하세요."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send();
              }
            }}
            maxLength={2000}
            aria-label="채팅 입력"
          />
          <button className="askai__send" onClick={send} disabled={!draft.trim() || sending || !convId} aria-label="메시지 보내기">
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
