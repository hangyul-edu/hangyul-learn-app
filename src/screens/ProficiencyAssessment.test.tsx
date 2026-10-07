import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../hooks/toast";
import { I18nProvider } from "../i18n";
import type { AssessmentSessionView, AssessmentTask } from "../lib/types";

vi.mock("../api/endpoints", () => ({
  proficiencyApi: {
    get: vi.fn(),
    present: vi.fn(),
    partnerAudio: vi.fn(),
    support: vi.fn(),
    turn: vi.fn(),
    finish: vi.fn(),
    answer: vi.fn(),
    complete: vi.fn(),
  },
  quizApi: { audio: vi.fn() },
}));

import { proficiencyApi } from "../api/endpoints";
import { ProficiencyAssessment } from "./ProficiencyAssessment";

const api = proficiencyApi as unknown as Record<string, ReturnType<typeof vi.fn>>;
const L = (ko: string, en = ko) => ({ ko, en });

function task(over: Partial<AssessmentTask> = {}): AssessmentTask {
  return {
    task_id: "pta_1",
    position: 0,
    kind: "interview",
    scene: L("언어 교환 모임"),
    goal: L("자기소개를 하세요"),
    background: null,
    has_listening_material: false,
    turn_count: 1,
    answered_turns: 0,
    partner_text: {},
    replays: {},
    replay_allowance: 2,
    my_turns: [],
    status: "awaiting_response",
    capabilities: [],
    result: null,
    ...over,
  };
}

function session(over: Partial<AssessmentSessionView> = {}): AssessmentSessionView {
  return {
    session_id: "pas_1",
    track: "conversation",
    mode: "conv_capability_check",
    status: "active",
    target_level: 1,
    deadline_at: null,
    voice_required: false,
    tasks: [task()],
    result: null,
    ...over,
  };
}

function renderAt(view: AssessmentSessionView) {
  api.get.mockResolvedValue(view);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nProvider language="ko">
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <MemoryRouter initialEntries={[`/proficiency/assess/${view.session_id}`]}>
            <Routes>
              <Route path="/proficiency/assess/:sessionId" element={<ProficiencyAssessment />} />
              <Route path="/level-up" element={<div>LEVEL_UP</div>} />
              <Route path="/proficiency/:track" element={<div>PROFICIENCY</div>} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.present.mockImplementation(async () => task());
});

describe("Conversation assessment", () => {
  it("records seeing the partner's words as support, after a warning", async () => {
    api.support.mockResolvedValue(task({ partner_text: { "0": "자기소개 좀 해 주세요." } }));
    renderAt(session());
    expect(await screen.findByText("언어 교환 모임")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "글자로 보기" }));
    expect(screen.getByText(/독립 근거로 세지 않아요/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "확인" }));
    expect(api.support).toHaveBeenCalledWith("pas_1", "pta_1", 0, "text");
    expect(await screen.findByText("자기소개 좀 해 주세요.")).toBeInTheDocument();
  });

  it("answers by text where allowed, then shows the scored result", async () => {
    api.turn.mockResolvedValue(task({ answered_turns: 1, my_turns: [{ index: 0, transcript: "저는 마리아예요." }] }));
    api.finish.mockResolvedValue(
      task({
        answered_turns: 1,
        status: "scored",
        result: {
          dimension_scores: { task_fulfillment: 3, listening_interaction: 3, language: 2, coherence_fluency: 3, pronunciation: null },
          weighted_score: 2.8,
          feedback: L("소개가 자연스러워요."),
          counts_as_evidence: true,
          not_counted_reason: null,
        },
      }),
    );
    renderAt(session());
    await screen.findByText("언어 교환 모임");
    await userEvent.click(screen.getByRole("button", { name: "글로 답하기" }));
    await userEvent.type(screen.getByPlaceholderText("답을 입력하세요"), "저는 마리아예요.");
    await userEvent.click(screen.getByRole("button", { name: "보내기" }));
    expect(api.turn).toHaveBeenCalledWith("pas_1", "pta_1", 0, { text: "저는 마리아예요." });
    await userEvent.click(await screen.findByRole("button", { name: "제출하고 채점받기" }));
    expect(await screen.findByText("소개가 자연스러워요.")).toBeInTheDocument();
    expect(screen.getByText("실력 근거로 기록됐어요")).toBeInTheDocument();
    // A typed answer has no pronunciation: shown as not applicable, never 0.
    expect(screen.getByText("해당 없음")).toBeInTheDocument();
  });

  it("offers no typed answers when the assessment needs speech", async () => {
    renderAt(session({ mode: "conv_integrative", voice_required: true }));
    await screen.findByText("언어 교환 모임");
    expect(screen.queryByRole("button", { name: "글로 답하기" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "녹음하기" })).toBeInTheDocument();
  });

  it("opens the celebration only for an applied, confirmed promotion", async () => {
    const scored = task({ status: "scored", answered_turns: 1, result: null });
    api.complete.mockResolvedValue(
      session({
        status: "completed",
        tasks: [scored],
        decision: {
          decision_id: "d1", kind: "promotion", applied: true, rollout_mode: "enabled", from_level: null, to_level: 1,
          target_level: 1, policy_version: "conv-promo-v1", reward_points: 100, decided_at: "2026-10-04T09:00:00Z",
          gates: [{ gate: "required_capabilities_confirmed", passed: true, detail: { confirmed: 4, total: 4 } }],
          explanation: L("회화 레벨 1 확인"),
        },
      }),
    );
    renderAt(session({ tasks: [scored] }));
    await userEvent.click(await screen.findByRole("button", { name: "평가 마치기" }));
    expect(await screen.findByText("LEVEL_UP")).toBeInTheDocument();
  });

  it("stays on the summary when the decision is a shadow-mode promotion", async () => {
    const scored = task({ status: "scored", answered_turns: 1, result: null });
    api.complete.mockResolvedValue(
      session({
        status: "completed",
        tasks: [scored],
        decision: {
          decision_id: "d1", kind: "promotion", applied: false, rollout_mode: "shadow", from_level: null, to_level: 1,
          target_level: 1, policy_version: "conv-promo-v1", reward_points: 0, decided_at: "2026-10-04T09:00:00Z",
          gates: [], explanation: L("회화 레벨 1 확인(시범)"),
        },
      }),
    );
    renderAt(session({ tasks: [scored] }));
    await userEvent.click(await screen.findByRole("button", { name: "평가 마치기" }));
    expect(await screen.findByText("평가를 마쳤어요")).toBeInTheDocument();
    expect(screen.queryByText("LEVEL_UP")).not.toBeInTheDocument();
  });
});

describe("TOPIK mock", () => {
  const mock = (): AssessmentSessionView => ({
    session_id: "pas_m",
    track: "topik",
    mode: "topik_mock",
    status: "active",
    exam_level: "II",
    deadline_at: new Date(Date.now() + 60 * 60_000).toISOString(),
    sections: [{ section: "listening", items: 50, minutes: 60, max_score: 100 }],
    form_complete: false,
    items: [
      {
        position: 0, section: "reading", points: 2, quiz_id: "q1",
        payload: { answer_format: "single_choice", prompt: "알맞은 것을 고르세요", choices: ["가", "나", "다", "라"], choice_keys: ["1", "2", "3", "4"], topik_section: "reading" },
        answered: false, answer: null, writing_item: null, correct: null, points_earned: null, writing_feedback: null,
      },
    ],
    result: null,
  });

  it("saves a choice, warns that a short form is diagnostic, and submits", async () => {
    api.answer.mockResolvedValue({ position: 0, answered: true });
    api.complete.mockResolvedValue({
      ...mock(),
      status: "completed",
      result: { section_scores: { listening: 80, reading: 60, writing: null }, total: null, form_complete: false },
    });
    renderAt(mock());
    expect(await screen.findByText(/진단용 짧은 평가예요/)).toBeInTheDocument();
    await userEvent.click(screen.getByText("나"));
    expect(api.answer).toHaveBeenCalledWith("pas_m", 0, "2");
    await userEvent.click(screen.getByRole("button", { name: "제출하기" }));
    await userEvent.click(screen.getByRole("button", { name: "확인" }));
    expect(await screen.findByText("평가를 마쳤어요")).toBeInTheDocument();
    expect(screen.getByText("80/100")).toBeInTheDocument();
    expect(screen.getByText(/공식 TOPIK 성적이 아니에요/)).toBeInTheDocument();
  });
});
