import { useEffect, useRef, useState } from "react";
import { Screen } from "../components/layout/Screen";
import { Button } from "../components/ui/kit";
import { LoadingState } from "../components/ui/states";
import { aiApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

function extractReply(res: { reply?: string; message?: unknown }): string {
  if (res.reply) return res.reply;
  const m = res.message as Record<string, unknown> | undefined;
  if (m && typeof m.content === "string") return m.content;
  if (m && typeof m.text === "string") return m.text as string;
  return "…";
}

export function AiChat() {
  const toast = useToast();
  const [convId, setConvId] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const c = await aiApi.createConversation();
        setConvId(c.conversation_id);
        setMessages([{ role: "assistant", content: "안녕하세요! 한국어 학습을 도와드릴게요. 무엇이든 물어보세요 😊" }]);
      } catch (e) {
        toast.error(errorMessage(e));
      } finally {
        setStarting(false);
      }
    })();
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
      const res = await aiApi.send(convId, content);
      setMessages((m) => [...m, { role: "assistant", content: extractReply(res) }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: "죄송해요, 답변을 가져오지 못했어요. 잠시 후 다시 시도해 주세요." }]);
      toast.error(errorMessage(e));
    } finally {
      setSending(false);
    }
  }

  if (starting) return <Screen title="AI 튜터" back><LoadingState text="대화를 준비하고 있어요…" /></Screen>;

  return (
    <div className="screen">
      <Screen title="AI 튜터 🤖" back topBar>
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
          placeholder="메시지를 입력하세요"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <Button style={{ flex: "0 0 56px", padding: 0 }} loading={sending} disabled={!text.trim()} onClick={send}>
          ➤
        </Button>
      </div>
    </div>
  );
}
