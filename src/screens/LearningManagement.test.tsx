import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import type { ManagementPeriod, ManagementStats } from "../lib/types";

/* -------------------------------- mocks --------------------------------- */
const { management } = vi.hoisted(() => ({ management: vi.fn() }));
vi.mock("../api/endpoints", () => ({ learnApi: { management } }));

import { LearningManagement } from "./LearningManagement";
import { I18nProvider } from "../i18n";

function Loc() {
  return <div data-testid="loc">{useLocation().pathname}</div>;
}

function renderPage(language: "ko" | "en" = "ko") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nProvider language={language}>
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/learning-management"]}>
          <Routes>
            <Route path="/learning-management" element={<><LearningManagement /><Loc /></>} />
            <Route path="/recommend" element={<><div>PERSONALIZED</div><Loc /></>} />
            <Route path="/home" element={<><div>HOME</div><Loc /></>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nProvider>,);
}

function stats(period: ManagementPeriod, over: Partial<ManagementStats> = {}): ManagementStats {
  return {
    period,
    timezone: "UTC",
    range: { start_date: "2026-07-20", end_date: "2026-07-26" },
    has_any_eligible_learning_record: true,
    today: { study_seconds: 3600, conversation_sentence_count: 3, topik_question_count: 2, learning_count: 5 },
    buckets: [
      { key: "d1", start_date: "2026-07-20", end_date: "2026-07-20", study_seconds: 1200, conversation_sentence_count: 4, topik_question_count: 1, is_current: false },
      { key: "d2", start_date: "2026-07-23", end_date: "2026-07-23", study_seconds: 3600, conversation_sentence_count: 3, topik_question_count: 2, is_current: true },
    ],
    period_totals: { conversation_sentence_count: 7, topik_question_count: 3, learning_count: 10 },
    ...over,
  };
}

/** One bucket per calendar month, as the 3m/1y periods return. */
const monthBuckets: ManagementStats["buckets"] = [
  { key: "2026-05-01", start_date: "2026-05-01", end_date: "2026-05-31", study_seconds: 600, conversation_sentence_count: 1, topik_question_count: 0, is_current: false },
  { key: "2026-06-01", start_date: "2026-06-01", end_date: "2026-06-30", study_seconds: 900, conversation_sentence_count: 2, topik_question_count: 1, is_current: false },
  { key: "2026-07-01", start_date: "2026-07-01", end_date: "2026-07-31", study_seconds: 3600, conversation_sentence_count: 3, topik_question_count: 2, is_current: true },
];

/** Open the period menu and pick an option by its visible label.
 *  The chart hides itself while `data.period` still differs from the selected
 *  period, so a period-specific axis can only be asserted after a real switch. */
async function selectPeriod(optionLabel: string) {
  const aria = optionLabel.match(/[a-z]/i) ? "Select period" : "기간 선택";
  // The trigger only exists once the first fetch resolves.
  await userEvent.click(await screen.findByRole("button", { name: aria }));
  await userEvent.click(await screen.findByRole("menuitem", { name: optionLabel }));
}

beforeEach(() => {
  vi.clearAllMocks();
  // Answer with the period that was actually requested — the screen discards a
  // response whose period does not match its selection.
  management.mockImplementation((period: ManagementPeriod) => Promise.resolve(stats(period)));
});

describe("LearningManagement", () => {
  it("renders the summary, chart, and period totals from server data", async () => {
    renderPage();
    expect(await screen.findByText("꾸준히 쌓이는 기록, 대단해요!")).toBeInTheDocument();
    const summary = document.querySelector(".lmgmt__summary") as HTMLElement;
    expect(within(summary).getByText("01:00")).toBeInTheDocument(); // 3600s → HH:MM
    expect(within(summary).getByText("5")).toBeInTheDocument(); // server learning_count
    // Chart bars + current-bucket value (today selected by default). HMA-002
    // labels its bar "1h33m" — unspaced.
    expect(screen.getByText("월")).toBeInTheDocument();
    expect(screen.getByText("목")).toBeInTheDocument();
    expect(screen.getByText("1h0m")).toBeInTheDocument(); // current bucket duration
  });

  /* The API used to send Korean bucket labels that ignored the app language;
     that field is gone and each client formats its own, so the
     axis is formatted client-side. These lock the wording to HMA-002: the
     Korean frame (1:3636) reads 월…일, the English one (784:50416) Mon…Sun. */
  describe("x-axis labels follow the app language", () => {
    it("uses the English weekday wording from HMA-002 EN", async () => {
      renderPage("en");
      expect(await screen.findByText("Mon")).toBeInTheDocument();
      expect(screen.getByText("Thu")).toBeInTheDocument();
    });

    it("renders no Korean on an English screen", async () => {
      // The axis is formatted entirely client-side now, so nothing can leak a
      // Korean weekday into the English app.
      renderPage("en");
      await screen.findByText("Mon");
      expect(screen.queryByText("월")).not.toBeInTheDocument();
      expect(screen.queryByText("목")).not.toBeInTheDocument();
    });

    it("still renders Korean unchanged for Korean users", async () => {
      renderPage("ko");
      expect(await screen.findByText("월")).toBeInTheDocument();
      expect(screen.getByText("목")).toBeInTheDocument();
      expect(screen.queryByText("Mon")).not.toBeInTheDocument();
    });

    it("localizes month buckets for the 3m/1y periods", async () => {
      management.mockImplementation((p: ManagementPeriod) =>
        Promise.resolve(p === "3m" ? stats(p, { buckets: monthBuckets }) : stats(p)),
      );
      renderPage("en");
      await selectPeriod("Last 3 months");
      expect(await screen.findByText("May")).toBeInTheDocument();
      expect(screen.getByText("Jun")).toBeInTheDocument();
      expect(screen.getByText("Jul")).toBeInTheDocument();
    });

    it("keeps the Korean month wording the API used to send", async () => {
      management.mockImplementation((p: ManagementPeriod) =>
        Promise.resolve(p === "3m" ? stats(p, { buckets: monthBuckets }) : stats(p)),
      );
      renderPage("ko");
      await selectPeriod("최근 3개월");
      // Byte-identical to the server's old f"{m}월" — Korean users see no change.
      expect(await screen.findByText("5월")).toBeInTheDocument();
      expect(screen.getByText("6월")).toBeInTheDocument();
      expect(screen.getByText("7월")).toBeInTheDocument();
    });

    it("numbers the weekly buckets in Korean", async () => {
      renderPage("ko");
      await selectPeriod("이번 달");
      expect(await screen.findByText("1주")).toBeInTheDocument();
      expect(screen.getByText("2주")).toBeInTheDocument();
    });

    it("numbers the weekly buckets in English", async () => {
      renderPage("en");
      await selectPeriod("This month");
      expect(await screen.findByText("Week 1")).toBeInTheDocument();
      expect(screen.getByText("Week 2")).toBeInTheDocument();
    });

    it("shows the raw date when a bucket date is unusable", async () => {
      management.mockResolvedValue(
        stats("7d", {
          buckets: [
            {
              key: "d1", start_date: "not-a-date", end_date: "not-a-date",
              study_seconds: 1200, conversation_sentence_count: 4, topik_question_count: 1,
              is_current: true,
            },
          ],
        }),
      );
      renderPage("en");
      // The API no longer sends a label to fall back to, so the axis shows the
      // raw value rather than an empty tick or "Invalid Date".
      expect(await screen.findByText("not-a-date")).toBeInTheDocument();
    });
  });

  it("highlights today by default and shows its duration above it", async () => {
    const { container } = renderPage();
    await screen.findByText("목");
    expect(container.querySelectorAll(".lmgmt__bar--current")).toHaveLength(1);
    expect(container.querySelectorAll(".lmgmt__bar--selected")).toHaveLength(1); // today selected
    expect(container.querySelectorAll(".lmgmt__bar")).toHaveLength(2);
  });

  it("moves the highlight and displayed time to a bar the user selects", async () => {
    renderPage();
    await screen.findByText("목");
    // Default: today's bucket (목, 3600s) shows "1h0m".
    expect(screen.getByText("1h0m")).toBeInTheDocument();
    // Select the historical Monday bar (월, 1200s) → its time appears, today's is gone.
    await userEvent.click(screen.getByRole("button", { name: /월/ }));
    expect(await screen.findByText("20m")).toBeInTheDocument();
    expect(screen.queryByText("1h0m")).not.toBeInTheDocument();
  });

  it("bottom totals reflect the selected bar only, not the period aggregate", async () => {
    renderPage();
    await screen.findByText("목");
    const totals = document.querySelector(".lmgmt__totals") as HTMLElement;
    // Default selection = current bucket (목): 3 sentences / 2 questions — NOT
    // the period aggregate (7 / 3). Figma 1916:25920 renders the count with its
    // 개 unit.
    expect(within(totals).getByText("3개")).toBeInTheDocument();
    expect(within(totals).getByText("2개")).toBeInTheDocument();
    expect(within(totals).queryByText("7개")).not.toBeInTheDocument();
    // Select the Monday bar → its own counts (4 / 1).
    await userEvent.click(screen.getByRole("button", { name: /월/ }));
    expect(within(totals).getByText("4개")).toBeInTheDocument();
    expect(within(totals).getByText("1개")).toBeInTheDocument();
    expect(within(totals).queryByText("3개")).not.toBeInTheDocument();
  });

  it("shows a loading skeleton (not the empty state) before data arrives", () => {
    management.mockReturnValue(new Promise(() => {}));
    const { container } = renderPage();
    expect(container.querySelector(".lmgmt__loading")).toBeInTheDocument();
    expect(screen.queryByText("학습 기록이 아직 없어요")).not.toBeInTheDocument();
    expect(screen.queryByText(/기다리고 있어요/)).not.toBeInTheDocument();
  });

  it("shows the first-time empty state only when the server reports no lifetime record", async () => {
    management.mockResolvedValue(stats("7d", { has_any_eligible_learning_record: false }));
    renderPage();
    expect(await screen.findByText("첫 학습을 기다리고 있어요!")).toBeInTheDocument();
    expect(screen.getByText("학습 기록이 아직 없어요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /학습 시작하기/ })).toBeInTheDocument();
    // Summary card still visible; chart/period totals replaced.
    expect(document.querySelector(".lmgmt__summary")).toBeInTheDocument();
    expect(document.querySelector(".lmgmt__chart")).not.toBeInTheDocument();
  });

  it("does NOT show the first-time CTA for a historical user with an empty period", async () => {
    management.mockResolvedValue(
      stats("7d", {
        has_any_eligible_learning_record: true,
        today: { study_seconds: 0, conversation_sentence_count: 0, topik_question_count: 0, learning_count: 0 },
        buckets: [{ key: "d", start_date: "2026-07-23", end_date: "2026-07-23", study_seconds: 0, conversation_sentence_count: 0, topik_question_count: 0, is_current: true }],
        period_totals: { conversation_sentence_count: 0, topik_question_count: 0, learning_count: 0 },
      }),
    );
    renderPage();
    await screen.findByText("목");
    expect(screen.queryByRole("button", { name: /학습 시작하기/ })).not.toBeInTheDocument();
    expect(document.querySelector(".lmgmt__chart")).toBeInTheDocument();
  });

  it("renders all four period options and requests the new period on selection", async () => {
    renderPage();
    await screen.findByText("목");
    await userEvent.click(screen.getByRole("button", { name: "기간 선택" }));
    for (const label of ["최근 7일", "이번 달", "최근 3개월", "최근 1년"]) {
      expect(screen.getByRole("menuitem", { name: label })).toBeInTheDocument();
    }
    management.mockResolvedValue(stats("1m", { buckets: [{ key: "w1", start_date: "2026-07-01", end_date: "2026-07-05", study_seconds: 600, conversation_sentence_count: 1, topik_question_count: 0, is_current: true }] }));
    await userEvent.click(screen.getByRole("menuitem", { name: "이번 달" }));
    await waitFor(() => expect(management).toHaveBeenCalledWith("1m", expect.anything()));
    expect(await screen.findByText("1주")).toBeInTheDocument();
  });

  it("shows an error with retry (not the empty state) when the request fails", async () => {
    management.mockRejectedValue(new Error("offline"));
    renderPage();
    expect(await screen.findByText("문제가 생겼어요")).toBeInTheDocument();
    expect(screen.queryByText("학습 기록이 아직 없어요")).not.toBeInTheDocument();
  });

  it("navigates to Personalized Learning from the empty-state CTA", async () => {
    management.mockResolvedValue(stats("7d", { has_any_eligible_learning_record: false }));
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /학습 시작하기/ }));
    await waitFor(() => expect(screen.getByTestId("loc")).toHaveTextContent("/recommend"));
  });

  it("back button navigates to Home", async () => {
    renderPage();
    await screen.findByText("목");
    await userEvent.click(screen.getByRole("button", { name: "뒤로 가기" }));
    await waitFor(() => expect(screen.getByTestId("loc")).toHaveTextContent("/home"));
  });
});
