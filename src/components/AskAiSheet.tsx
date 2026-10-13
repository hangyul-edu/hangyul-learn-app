import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../i18n";
import { aiApi, studyApi } from "../api/endpoints";
import { ChatSheetView } from "./ChatSheetView";
import { errorMessage } from "../lib/http";
import { isApiCode } from "../lib/studySession";
import { randomUuid } from "../lib/uuid";
import type { ChatMessage, TutorAnswer } from "../lib/types";

export interface AskContext {
  /** Which study artefact the conversation is anchored to. `sentence`/`quiz`
   *  = free questions about the current item; `*_attempt` = explain the wrong
   *  answer (auto-explained). */
  contextKind: "sentence" | "quiz" | "quiz_attempt" | "speech_attempt" | "study_activity";
  /** The matching *_id for contextKind (the activity id for `study_activity`). */
  contextId: string;
  /** `study_activity` only: the adaptive session the activity belongs to. */
  sessionId?: string;
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
 *
 * An adaptive-session activity (`study_activity`) talks to the grounded tutor
 * instead: each question is one tutor turn on the exact item shown. The server
 * decides the mode — hints only while the item is open, explanations after —
 * so the sheet just relays; an incorrect answer opens with a hint request.
 */
export function AskAiSheet({ open, context, onClose }: { open: boolean; context: AskContext; onClose: () => void }) {
  if (context.contextKind === "study_activity") return <TutorSheet open={open} context={context} onClose={onClose} />;
  return <ChatbotAskSheet open={open} context={context} onClose={onClose} />;
}

function ChatbotAskSheet({ open, context, onClose }: { open: boolean; context: AskContext; onClose: () => void }) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [convId, setConvId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
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

  const ID_FIELD: Record<Exclude<AskContext["contextKind"], "study_activity">, string> = {
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
        [ID_FIELD[context.contextKind as keyof typeof ID_FIELD]]: context.contextId,
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
    setSendError(null);
    try {
      const res = await aiApi.sendMessage(convId, text);
      if (!alive.current) return;
      setDraft("");
      setMessages((m) => [...m, res.user_message, res.assistant_message]);
    } catch (e) {
      // Keep the draft so the learner can send it again without re-typing.
      if (alive.current) setSendError(errorMessage(e));
    } finally {
      if (alive.current) setSending(false);
    }
  }

  if (!open) return null;

  return (
    <ChatSheetView
      messages={messages}
      loading={loading}
      errorText={initError ? t("misc.explanationError") : sendError}
      // Retry restarts a thread that failed to open; a failed send is retried
      // by sending the kept draft again.
      onRetry={initError ? startThread : undefined}
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

/** One chat line built locally (the tutor has no conversation resource). */
function line(role: ChatMessage["role"], content: string): ChatMessage {
  return { message_id: randomUuid(), role, content, created_at: new Date().toISOString() };
}

function tutorReply(res: TutorAnswer): string {
  const parts = [res.answer];
  if (res.cited_sentence) parts.push(`“${res.cited_sentence}”`);
  if (res.examples.length) parts.push(res.examples.map((e) => `· ${e}`).join("\n"));
  return parts.join("\n\n");
}

function TutorSheet({ open, context, onClose }: { open: boolean; context: AskContext; onClose: () => void }) {
  const { t, language } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [turnsLeft, setTurnsLeft] = useState<number | null>(null);
  const started = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  async function ask(question: string): Promise<boolean> {
    try {
      const res = await studyApi.askTutor(context.sessionId!, context.contextId, {
        question,
        client_request_id: randomUuid(),
        language: language === "ko" ? "ko" : "en",
      });
      if (!alive.current) return false;
      setMessages((m) => [...m, line("user", question), line("assistant", tutorReply(res))]);
      setTurnsLeft(res.turns_left);
      setError(null);
      return true;
    } catch (e) {
      if (!alive.current) return false;
      setError(
        isApiCode(e, "tutor.turn_limit")
          ? t("session.tutorLimit")
          : isApiCode(e, "tutor.content_withdrawn")
            ? t("session.tutorWithdrawn")
            : t("misc.explanationError"),
      );
      if (isApiCode(e, "tutor.turn_limit")) setTurnsLeft(0);
      return false;
    }
  }

  // An incorrect answer opens with a hint request, as the chatbot opened with
  // an explanation; otherwise the learner asks first.
  async function autoAsk() {
    setLoading(true);
    await ask(t("session.tutorAutoQuestion"));
    if (alive.current) setLoading(false);
  }

  useEffect(() => {
    if (open && !started.current) {
      started.current = true;
      if (context.autoExplain) void autoAsk();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function send() {
    const text = draft.trim();
    if (!text || sending || turnsLeft === 0) return;
    setSending(true);
    // Keep the draft on failure so the learner can retry without re-typing.
    if (await ask(text)) setDraft("");
    if (alive.current) setSending(false);
  }

  if (!open) return null;

  return (
    <ChatSheetView
      messages={messages}
      loading={loading}
      errorText={error}
      onRetry={messages.length === 0 && context.autoExplain ? () => void autoAsk() : undefined}
      draft={draft}
      sending={sending}
      canSend={turnsLeft !== 0}
      onDraft={setDraft}
      onSend={() => void send()}
      onClose={onClose}
      dataSource="session"
    />
  );
}
