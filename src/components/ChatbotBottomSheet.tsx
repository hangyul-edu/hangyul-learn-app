import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../i18n";
import { aiApi } from "../api/endpoints";
import { ChatSheetView } from "./ChatSheetView";
import { errorMessage } from "../lib/http";
import type { ChatMessage } from "../lib/types";

/**
 * Page-level 물어보기 chatbot, opened from the floating button on the
 * Personalized Learning and Lecture pages. It shares the exact sheet UI
 * (ChatSheetView) with the in-session AskAiSheet, but runs a general (or
 * page-context-anchored) conversation rather than one tied to a study item.
 *
 * Each page renders its own instance, so a Lecture conversation and a
 * Personalized Learning conversation never mix. Reopening within the same
 * mount restores the conversation (state is kept while mounted).
 */
/** Built per render so the greeting follows the active language. */
function greeting(text: string): ChatMessage {
  return { message_id: "__greeting__", role: "assistant", content: text, created_at: "" };
}

export function ChatbotBottomSheet({
  open,
  source,
  context,
  onClose,
}: {
  open: boolean;
  /** Which page opened the sheet — keeps the two conversations distinct. */
  source: "lecture" | "personalized_learning";
  /** Optional structured context (e.g. { kind: "lecture", lecture_id }). */
  context?: Record<string, unknown>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([greeting(t("misc.askAnything"))]);
  const [convId, setConvId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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

  async function start() {
    setError(null);
    try {
      const res = await aiApi.startConversation(context ? { context } : {});
      if (!alive.current) return;
      setConvId(res.conversation.conversation_id);
      if (res.first_assistant_message) {
        setMessages([greeting(t("misc.askAnything")), res.first_assistant_message]);
      }
    } catch (e) {
      if (alive.current) setError(errorMessage(e));
    }
  }

  // Create the conversation the first time the sheet opens (once per mount).
  useEffect(() => {
    if (open && !started.current) {
      started.current = true;
      void start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function send() {
    const text = draft.trim();
    if (!text || sending || !convId) return; // guards empty + duplicate submits
    setSending(true);
    setError(null);
    try {
      const res = await aiApi.sendMessage(convId, text);
      if (!alive.current) return;
      setDraft("");
      setMessages((m) => [...m, res.user_message, res.assistant_message]);
    } catch (e) {
      // Keep the draft so the user can retry without re-typing (no duplicate).
      if (alive.current) setError(errorMessage(e));
    } finally {
      if (alive.current) setSending(false);
    }
  }

  if (!open) return null;

  return (
    <ChatSheetView
      messages={messages}
      loading={false}
      errorText={error}
      onRetry={convId ? undefined : start}
      draft={draft}
      sending={sending}
      canSend={convId != null}
      onDraft={setDraft}
      onSend={() => void send()}
      onClose={onClose}
      dataSource={source}
    />
  );
}
