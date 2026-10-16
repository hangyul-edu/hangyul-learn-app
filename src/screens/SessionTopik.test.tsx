import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryRouter } from "react-router-dom";

vi.mock("../components/SessionChrome", () => ({
  SessionChrome: ({ children, panel }: { children: React.ReactNode; panel?: React.ReactNode }) => (
    <div>
      {panel}
      {children}
    </div>
  ),
}));
vi.mock("../components/SessionCompleteModal", () => ({ SessionCompleteModal: () => null }));
const { toastShow, auth } = vi.hoisted(() => ({ toastShow: vi.fn(), auth: { premium: true } }));
vi.mock("../hooks/toast", () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn(), show: toastShow }) }));
vi.mock("../hooks/auth", () => ({
  useAuth: () => ({ me: { app_language: "ko", membership: { tier: "free", is_premium: auth.premium, expires_at: null } } }),
}));

const { questions, topikTypes, summary, attempt, audio, recordSession } = vi.hoisted(() => ({
  questions: vi.fn(),
  topikTypes: vi.fn(),
  summary: vi.fn(),
  attempt: vi.fn(),
  audio: vi.fn(),
  recordSession: vi.fn(),
}));
vi.mock("../api/endpoints", () => ({
  recApi: { questions, topikQuestionTypes: topikTypes },
  quizApi: { attempt, audio, bookmark: vi.fn(), unbookmark: vi.fn() },
  dashboardApi: { summary },
  learnApi: { recordSession },
}));

import { SessionTopik } from "./SessionTopik";
import { I18nProvider } from "../i18n";

const KEY = "hangyul.session.topik.v1";

const WRITING = {
  quiz_id: "q_essay",
  question_type: "writing_opinion_essay",
  prompt: "자신의 생각을 600~700자로 쓰십시오.",
  level: 5,
  material: { kind: "text", html: null, image_url: null, audio: null },
  answer: { format: "free_response", choices: [], blanks: [], min_length: 600, max_length: 700 },
};

function renderScreen() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: "/", element: <SessionTopik /> }], {
    initialEntries: [{ pathname: "/", state: { section: "writing" } }],
  });
  return render(
    <I18nProvider language="ko">
      <QueryClientProvider client={qc}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </I18nProvider>,);
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  auth.premium = true;
  summary.mockResolvedValue({
    tracks: [{ category: "topik", level: 5, goal: { target: 3, current: 0, achieved: false } }],
  });
  topikTypes.mockResolvedValue({ section: "writing", items: [] });
  questions.mockResolvedValue({ items: [WRITING] });
});
afterEach(() => vi.restoreAllMocks());

describe("SessionTopik — draft persistence + refresh restore", () => {
  it("restores the session and the writing draft on refresh without regenerating", async () => {
    const first = renderScreen();
    const area = await screen.findByRole("textbox");
    await userEvent.type(area, "내 생각은");
    expect(questions).toHaveBeenCalledTimes(1);

    // Wait until the debounced snapshot has captured the typed draft.
    await waitFor(() => {
      const raw = sessionStorage.getItem(KEY);
      expect(raw && JSON.parse(raw).drafts.q_essay?.text).toBe("내 생각은");
    });

    // Simulate a page refresh: tear down and mount a fresh tree.
    first.unmount();
    questions.mockClear();
    renderScreen();

    // The same item + draft are restored; no new questions are requested.
    const restored = await screen.findByRole("textbox");
    expect(restored).toHaveValue("내 생각은");
    expect(questions).not.toHaveBeenCalled();
  });

  it("requests a fresh set when there is no saved session", async () => {
    renderScreen();
    await screen.findByRole("textbox");
    expect(questions).toHaveBeenCalledTimes(1);
  });
});

describe("SessionTopik — the question-type picker is premium-only (TAL-016)", () => {
  it("shows a premium member the picker", async () => {
    renderScreen();
    await screen.findByRole("textbox");
    expect(screen.getByRole("button", { name: /문제 유형을 선택해보세요/ })).toHaveAttribute("aria-haspopup", "listbox");
    expect(screen.queryByText("★ 프리미엄 전용")).not.toBeInTheDocument();
  });

  it("locks it for a regular member, and a tap only explains why", async () => {
    auth.premium = false;
    renderScreen();
    await screen.findByRole("textbox");
    expect(screen.getByText("★ 프리미엄 전용")).toBeInTheDocument();
    const field = screen.getByRole("button", { name: /문제 유형을 선택해보세요/ });
    expect(field).not.toHaveAttribute("aria-haspopup");
    expect(field).toHaveTextContent("🔒 더 집중해서 풀어보고 싶은 문제 유형을 선택해보세요");
    await userEvent.click(field);
    expect(toastShow).toHaveBeenCalledWith("프리미엄 회원만 이용할 수 있는 기능이에요.");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(questions).toHaveBeenCalledTimes(1);
    expect(questions.mock.calls[0][0]).not.toHaveProperty("topik_question_type");
  });

  it("never scopes a restored set to a type for a regular member", async () => {
    auth.premium = false;
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ section: "writing", items: [WRITING], idx: 0, drafts: {}, correct: [], attempted: [], typeCode: "writing_51_52" }),
    );
    renderScreen();
    await screen.findByRole("textbox");
    await waitFor(() => {
      const raw = sessionStorage.getItem(KEY);
      expect(raw && JSON.parse(raw).typeCode).toBeNull();
    });
  });
});
