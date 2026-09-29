import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../api/endpoints", () => ({
  quizApi: { audio: vi.fn(async () => ({ url: "https://cdn.example/clip.mp3", duration_ms: 3000 })) },
}));

import { quizApi } from "../api/endpoints";
import { I18nProvider } from "../i18n";
import { QuestionView } from "./QuestionView";
import type { Quiz } from "../lib/types";

const listening = {
  quiz_id: "q_listen",
  prompt: "무엇을 들었어요?",
  material: { kind: "audio", html: null, image_url: null, audio: { duration_ms: 3000 } },
  answer: { format: "single_choice", choices: [{ key: "a", text: "사과" }], blanks: [] },
} as unknown as Quiz;

describe("QuestionView listening material", () => {
  it("fetches the signed clip URL on demand, since the payload carries none", async () => {
    // The question payload's audio is { duration_ms } only (QuizAudioMeta).
    render(
      <I18nProvider language="ko">
        <QuestionView quiz={listening} value={{}} onChange={() => {}} />
      </I18nProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "듣기 재생" }));

    expect(quizApi.audio).toHaveBeenCalledWith("q_listen");
    const audio = document.querySelector("audio");
    expect(audio).toHaveAttribute("src", "https://cdn.example/clip.mp3");
  });
});
