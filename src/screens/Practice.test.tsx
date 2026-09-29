import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const { start, lecture, audio, recordActivity } = vi.hoisted(() => ({
  start: vi.fn(),
  lecture: vi.fn(),
  audio: vi.fn(),
  recordActivity: vi.fn(),
}));
vi.mock("../api/endpoints", () => ({
  practiceApi: { start },
  learnApi: { lecture, recordActivity },
  quizApi: { audio, attempt: vi.fn(), bookmark: vi.fn(), unbookmark: vi.fn() },
}));
vi.mock("../hooks/toast", () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn(), show: vi.fn() }) }));

import { Practice } from "./Practice";
import { I18nProvider } from "../i18n";

/** A listening question as the server sends it: the clip has no URL. */
const LISTENING = {
  quiz_id: "q1",
  prompt: "들은 내용과 같은 것을 고르십시오.",
  level: 3,
  topik_section: "listening",
  material: { kind: "audio", html: null, image_url: null, audio: { duration_ms: 12000 } },
  answer: { format: "single_choice", choices: [{ key: "1", text: "하나" }], blanks: [] },
};

beforeEach(() => {
  vi.clearAllMocks();
  lecture.mockResolvedValue({ lecture_id: "L1", title: "강의" });
  recordActivity.mockResolvedValue({});
  start.mockResolvedValue({ practice_set_id: "ps1", items: [LISTENING], count: 1 });
  audio.mockResolvedValue({ url: "https://cdn.example/clip.mp3" });
});

describe("Practice — listening clip", () => {
  it("fetches the signed clip URL on play", async () => {
    // Regression: the player read material.audio.url, which the server never
    // sends, so listening practice had no audio at all.
    render(
      <I18nProvider language="ko">
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <MemoryRouter initialEntries={["/lectures/L1/practice"]}>
            <Routes>
              <Route path="/lectures/:lectureId/practice" element={<Practice />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </I18nProvider>,
    );
    await userEvent.click(await screen.findByRole("button", { name: "시작할게요!" }));
    await userEvent.click(await screen.findByRole("button", { name: "듣기 재생" }));
    await waitFor(() => expect(audio).toHaveBeenCalledWith("q1"));
    await waitFor(() => expect(document.querySelector("audio")?.getAttribute("src")).toBe("https://cdn.example/clip.mp3"));
  });
});
