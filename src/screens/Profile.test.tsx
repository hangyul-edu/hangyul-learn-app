import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

const { mine, plans, streak, unread } = vi.hoisted(() => ({
  mine: vi.fn(),
  plans: vi.fn(),
  streak: vi.fn(),
  unread: vi.fn(),
}));
vi.mock("../api/endpoints", () => ({
  subApi: { mine, plans },
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

/** GET /subscriptions/me as the server sends it — no premium flag, no name. */
const sub = (status: string, over: Record<string, unknown> = {}) => ({
  subscription_id: "s1",
  plan_id: "p_year",
  status,
  current_period_end: null,
  cancel_at_period_end: false,
  coupon_backed: false,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  streak.mockResolvedValue({ current: 1, best: 2, freeze_tokens: 0, last_study_date: null, total_days: 3 });
  unread.mockResolvedValue({ has_unread: false });
  plans.mockResolvedValue({ plans: [{ plan_id: "p_year", name: "Annual" }] });
});

describe("More — plan card", () => {
  it.each(["trial", "trial_ending"])("shows the free-trial ribbon for a %s subscription", async (status) => {
    // Regression: a trial in its last 72h (`trial_ending`) was drawn as a paid
    // plan, dropping the 무료체험중 ribbon.
    mine.mockResolvedValue(sub(status));
    renderPage();
    expect(await screen.findByText("무료체험중")).toBeInTheDocument();
  });

  it("shows a paid plan, named from the plan list, without the ribbon", async () => {
    // Regression: the card read `is_premium` / `plan_name`, which the server
    // never sends, so a paying member saw the no-subscription CTA.
    mine.mockResolvedValue(sub("active"));
    renderPage();
    expect(await screen.findByText("Annual")).toBeInTheDocument();
    expect(screen.queryByText("무료체험중")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /구독하기/ })).not.toBeInTheDocument();
  });

  it("offers to subscribe when there is no subscription", async () => {
    mine.mockResolvedValue(sub("expired", { subscription_id: null, plan_id: null }));
    renderPage();
    expect(await screen.findByText("구독하기")).toBeInTheDocument();
  });
});
