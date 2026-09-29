import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

const { mine, invoices } = vi.hoisted(() => ({ mine: vi.fn(), invoices: vi.fn() }));
vi.mock("../api/endpoints", () => ({
  subApi: { mine, plans: vi.fn() },
  billingApi: { invoices },
}));
vi.mock("../hooks/toast", () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn(), show: vi.fn() }) }));

import { Subscription } from "./Subscription";
import { I18nProvider } from "../i18n";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nProvider language="ko">
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/subscription"]}>
          <Subscription />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

const sub = (status: string, over: Record<string, unknown> = {}) => ({
  status,
  plan_name: "Annual",
  current_period_end: "2026-10-10T00:00:00Z",
  cancel_at_period_end: false,
  is_premium: true,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  invoices.mockResolvedValue({ invoices: [], next_cursor: null });
});

describe("Subscription — cancel action", () => {
  it.each(["trial", "trial_ending", "active"])("offers 해지하기 for a %s subscription", async (status) => {
    // Regression: `trial_ending` (a trial in its last 72h) hid the button, so a
    // member could not cancel right before the first charge.
    mine.mockResolvedValue(sub(status));
    renderPage();
    expect(await screen.findByRole("button", { name: "해지하기" })).toBeInTheDocument();
  });

  it("hides 해지하기 once a cancellation is already scheduled", async () => {
    mine.mockResolvedValue(sub("active", { cancel_at_period_end: true }));
    renderPage();
    expect(await screen.findByText("Annual")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "해지하기" })).not.toBeInTheDocument();
  });
});
