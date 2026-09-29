import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

const { mine, streak, unread } = vi.hoisted(() => ({ mine: vi.fn(), streak: vi.fn(), unread: vi.fn() }));
vi.mock("../api/endpoints", () => ({
  subApi: { mine },
  dashboardApi: { streak },
  authApi: { deleteAccount: vi.fn() },
}));
vi.mock("../lib/http", async (orig) => ({
  ...(await orig<typeof import("../lib/http")>()),
  http: { get: unread },
}));
vi.mock("../hooks/auth", () => ({
  useAuth: () => ({
    me: { nickname: "귤이", profile_image_type: "DEFAULT", avatar_key: null, profile_image_url: null },
    revokeSession: vi.fn(),
    hardSignOut: vi.fn(),
  }),
}));

import { Profile } from "./Profile";
import { I18nProvider } from "../i18n";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nProvider language="ko">
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <Profile />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  streak.mockResolvedValue({ current: 1, best: 2, freeze_tokens: 0, last_study_date: null, total_days: 3 });
  unread.mockResolvedValue({ has_unread: false });
});

describe("More — plan card", () => {
  it.each(["trial", "trial_ending"])("shows the free-trial ribbon for a %s subscription", async (status) => {
    // Regression: a trial in its last 72h (`trial_ending`) was drawn as a paid
    // plan, dropping the 무료체험중 ribbon.
    mine.mockResolvedValue({ status, plan_name: "Annual", is_premium: true, current_period_end: null });
    renderPage();
    expect(await screen.findByText("무료체험중")).toBeInTheDocument();
  });

  it("shows a paid plan without the ribbon", async () => {
    mine.mockResolvedValue({ status: "active", plan_name: "Annual", is_premium: true, current_period_end: null });
    renderPage();
    expect(await screen.findByText("Annual")).toBeInTheDocument();
    expect(screen.queryByText("무료체험중")).not.toBeInTheDocument();
  });
});
