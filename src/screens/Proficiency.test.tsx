import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../hooks/toast";
import { I18nProvider } from "../i18n";
import type { ConversationProficiency, ProficiencySummary, TopikProficiency } from "../lib/types";

vi.mock("../api/endpoints", () => ({
  proficiencyApi: { me: vi.fn(), start: vi.fn() },
}));

import { proficiencyApi } from "../api/endpoints";
import { ProficiencyScreen } from "./Proficiency";

const api = proficiencyApi as unknown as Record<string, ReturnType<typeof vi.fn>>;
const L = (ko: string, en = ko) => ({ ko, en });

const cap = (id: string, status: "confirmed" | "in_progress" | "needs_reconfirmation" = "confirmed") => ({
  capability_id: id,
  label: L(`역량 ${id}`),
  success_criteria: L("성공 기준"),
  status,
  independent_successes: status === "confirmed" ? 3 : 1,
  required_successes: 3,
  situations: 2,
  required_situations: 2,
  study_days: 2,
  required_study_days: 2,
  delayed_confirmed: status === "confirmed",
  delayed_check_available_at: "2026-10-03T09:00:00Z",
  delayed_check_due: false,
  valid_failures: 0,
  latest_valid_outcome: "success",
  missing: [],
});

function conversation(over: Partial<ConversationProficiency> = {}): ConversationProficiency {
  return {
    track: "conversation",
    status: "unassessed",
    confirmed_level: null,
    provisional_level: null,
    target_level: 1,
    at_maximum: false,
    study_level: 3,
    validation_status: "unvalidated",
    assessment_available: true,
    active_session_id: null,
    last_decision: null,
    next_level: {
      level: 1,
      can_do: L("기본 정보를 말할 수 있다"),
      representative_tasks: [],
      capabilities: [cap("a", "in_progress")],
      coverage: { confirmed: 0, total: 1, pct: 0, label: L("필수 역량 확인") },
      checklist: { pct: 0, label: L("승급 요건 충족"), items: [] },
      gates: [
        { gate: "required_capabilities_confirmed", label: L("필수 역량 확인"), passed: false, detail: {} },
        { gate: "integrative_assessment", label: L("종합 평가 통과"), passed: false, detail: {} },
      ],
      ready: false,
      integrative: null,
      unseen_tasks_left: 10,
    },
    next_activity: { kind: "placement", reason: L("배치 평가를 받아 보세요") },
    ...over,
  };
}

const topik: TopikProficiency = {
  track: "topik",
  status: "insufficient_evidence",
  confirmed_grade: null,
  provisional_grade: null,
  target_grade: 4,
  at_maximum: false,
  basis_label: L("앱 모의평가 기준"),
  study_level: 3,
  readiness: {
    I: { status: "unassessed", grade: null, basis: "app_mock_unvalidated", reasons: [], weak_sections: [], latest_section_scores: {} },
    II: {
      status: "insufficient_evidence",
      grade: null,
      basis: "listening_reading_only",
      reasons: ["writing_not_assessed"],
      weak_sections: ["reading"],
      latest_section_scores: { listening: 70, reading: 30, writing: null },
    },
  },
  grade_descriptors: {},
  mock_availability: {
    I: { spec_version: "topik-pbt-I-v1", sections: {}, full_form: false, diagnostic_form: false },
    II: { spec_version: "topik-pbt-II-v1", sections: {}, full_form: false, diagnostic_form: true },
  },
  last_decision: null,
  active_session_id: null,
  mocks_taken: 1,
};

function summary(conv: ConversationProficiency, decisionsApply = true): ProficiencySummary {
  return { rollout_mode: decisionsApply ? "enabled" : "shadow", decisions_apply: decisionsApply, tracks: [conv, topik] };
}

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nProvider language="ko">
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path="/proficiency/:track" element={<ProficiencyScreen />} />
              <Route path="/proficiency/assess/:sessionId" element={<div>ASSESSMENT</div>} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("My proficiency", () => {
  it("starts unassessed (not level 1) and places at a chosen level", async () => {
    api.me.mockResolvedValue(summary(conversation()));
    api.start.mockResolvedValue({ session_id: "pas_1", track: "conversation" });
    renderAt("/proficiency/conversation");
    expect(await screen.findByText("아직 평가 전")).toBeInTheDocument();
    expect(screen.getByText(/문제를 많이 푸는 것만으로는 레벨이 오르지 않아요/)).toBeInTheDocument();
    // The study level is shown as a difficulty setting, not as proficiency.
    expect(screen.getByText(/학습 난이도 Lv.3/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "5" }));
    await userEvent.click(screen.getByRole("button", { name: "배치 평가 받기" }));
    expect(api.start.mock.calls[0][0]).toEqual(
      expect.objectContaining({ track: "conversation", mode: "conv_placement", target_level: 5 }),
    );
    expect(await screen.findByText("ASSESSMENT")).toBeInTheDocument();
  });

  it("shows full capability coverage without calling it ready while a gate is open", async () => {
    const conv = conversation({
      status: "confirmed",
      confirmed_level: 4,
      target_level: 5,
      next_activity: { kind: "integrative", reason: L("종합 평가를 받아 보세요") },
    });
    conv.next_level = {
      ...conv.next_level!,
      level: 5,
      capabilities: [cap("a"), cap("b")],
      coverage: { confirmed: 2, total: 2, pct: 100, label: L("필수 역량 확인") },
      checklist: { pct: 75, label: L("승급 요건 충족"), items: [] },
    };
    api.me.mockResolvedValue(summary(conv));
    renderAt("/proficiency/conversation");
    expect(await screen.findByText("필수 역량 확인 2/2")).toBeInTheDocument();
    expect(screen.getByText("승급 요건 충족 75%")).toBeInTheDocument();
    expect(screen.queryByText("모든 승급 요건을 충족했어요")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "종합 평가 받기" })).toBeInTheDocument();
  });

  it("says plainly when every requirement is met but the trial run does not apply it", async () => {
    const conv = conversation({ status: "insufficient_evidence", next_activity: { kind: "ready", reason: L("충족") } });
    conv.next_level = { ...conv.next_level!, ready: true, checklist: { pct: 100, label: L("x"), items: [] } };
    api.me.mockResolvedValue(summary(conv, false));
    renderAt("/proficiency/conversation");
    expect(await screen.findByText(/시범 운영 중이라 아직 레벨에 반영되지 않아요/)).toBeInTheDocument();
  });

  it("shows TOPIK readiness as app-mock based and gives no grade without writing", async () => {
    api.me.mockResolvedValue(summary(conversation()));
    renderAt("/proficiency/topik");
    expect(await screen.findByText(/공식 TOPIK 성적이 아니에요/)).toBeInTheDocument();
    expect(screen.getByText("쓰기가 평가되지 않아 급수를 정하지 않았어요")).toBeInTheDocument();
    expect(screen.getByText(/보완하면 좋은 영역/)).toBeInTheDocument();
    expect(screen.getByText(/진단용 짧은 평가만 가능해요/)).toBeInTheDocument();
    const section = screen.getByText("TOPIK II (3–6급)").closest("section")!;
    expect(within(section).getByText("70/100")).toBeInTheDocument();
  });
});
