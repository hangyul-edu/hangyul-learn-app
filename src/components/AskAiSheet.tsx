import { useEffect, useRef, useState } from "react";
import { aiApi } from "../api/endpoints";
import { ChatSheetView } from "./ChatSheetView";
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
    <ChatSheetView
      messages={messages}
      loading={loading}
      errorText={initError ? "설명을 불러오지 못했어요." : null}
      onRetry={startThread}
      draft={draft}
      sending={sending}
      canSend={convId != null}
      onDraft={setDraft}
      onSend={() => void send()}
      onClose={onClose}
      dataSource="session"
    />
  );
}
