import { afterEach, expect, it, vi } from "vitest";
import { aiApi } from "./endpoints";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ status: 201, ok: true, text: async () => JSON.stringify(body) })),
  );
}

// Response shapes from src/modules/ai_chat/presentation/schemas.py
// (StartConversationResponse, SendMessageResponse).
it("reads the new conversation id from the nested conversation object", async () => {
  stubFetch({ conversation: { conversation_id: "conv_1", title: "t" }, first_assistant_message: null });
  await expect(aiApi.createConversation()).resolves.toEqual({ conversation_id: "conv_1" });
});

it("reads the tutor's reply from assistant_message", async () => {
  const assistant = { message_id: "m2", role: "assistant", content: "안녕하세요!", created_at: "" };
  stubFetch({ user_message: { message_id: "m1", role: "user", content: "hi", created_at: "" }, assistant_message: assistant });
  await expect(aiApi.send("conv_1", "hi")).resolves.toMatchObject({ reply: "안녕하세요!" });
});
