import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../i18n";
import { Screen } from "../components/layout/Screen";
import { Button } from "../components/ui/kit";
import { ErrorState, LoadingState } from "../components/ui/states";
import { aiApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

export function AiChat() {
  const { t } = useTranslation();
  const toast = useToast();
  const [convId, setConvId] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [startFailed, setStartFailed] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function start() {
    setStarting(true);
    setStartFailed(false);
    try {
      const { conversation } = await aiApi.startConversation({});
      setConvId(conversation.conversation_id);
      setMessages([{ role: "assistant", content: t("aiChat.greeting") }]);
    } catch {
      setStartFailed(true);
    } finally {
      setStarting(false);
    }
  }

  useEffect(() => {
    void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function send() {
    const content = text.trim();
    if (!content || !convId || sending) return;
    setText("");
    setMessages((m) => [...m, { role: "user", content }]);
    setSending(true);
    try {
      const { assistant_message } = await aiApi.sendMessage(convId, content);
      setMessages((m) => [...m, { role: "assistant", content: assistant_message.content }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: t("aiChat.error") }]);
      toast.error(errorMessage(e));
    } finally {
      setSending(false);
    }
  }

  if (starting) return <Screen title={t("aiChat.title")} back><LoadingState text={t("aiChat.preparing")} /></Screen>;
  if (startFailed)
    return (
      <Screen title={t("aiChat.title")} back>
        <ErrorState message={t("aiChat.startError")} onRetry={() => void start()} />
      </Screen>
    );

  return (
    <div className="screen">
      <Screen title={t("aiChat.titleEmoji")} back topBar>
        <div className="stack" style={{ gap: 10, paddingBottom: 80 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              <div
                style={{
                  maxWidth: "82%",
                  padding: "11px 14px",
                  borderRadius: 18,
                  fontSize: 14.5,
                  lineHeight: 1.5,
                  background: m.role === "user" ? "var(--brand-gradient)" : "var(--surface)",
                  color: m.role === "user" ? "#fff" : "var(--ink)",
                  border: m.role === "user" ? "none" : "1px solid var(--border)",
                  borderBottomRightRadius: m.role === "user" ? 5 : 18,
                  borderBottomLeftRadius: m.role === "user" ? 18 : 5,
                  whiteSpace: "pre-wrap",
                }}
              >
                {m.content}
              </div>
            </div>
          ))}
          {sending && (
            <div style={{ display: "flex" }}>
              <div style={{ padding: "12px 16px", borderRadius: 18, background: "var(--surface)", border: "1px solid var(--border)" }}>
                <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </Screen>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "10px 14px calc(12px + var(--safe-bottom))", background: "var(--surface)", borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
        <input
          className="input"
          placeholder={t("aiChat.inputPlaceholder")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          // Enter while a Korean IME is composing only commits the syllable.
          onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && send()}
        />
        <Button style={{ flex: "0 0 56px", padding: 0 }} loading={sending} disabled={!text.trim()} onClick={send}>
          ➤
        </Button>
      </div>
    </div>
  );
}
