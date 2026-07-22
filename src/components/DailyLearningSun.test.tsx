import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/* -------------------------------- mocks --------------------------------- */
const { summary } = vi.hoisted(() => ({ summary: vi.fn() }));
vi.mock("../api/endpoints", () => ({ dashboardApi: { summary } }));

import { DailyLearningSun, SUN_COPY } from "./DailyLearningSun";

function renderSun(seed?: { studied_today: boolean }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (seed) qc.setQueryData(["dashboard"], seed);
  return {
    qc,
    ...render(
      <QueryClientProvider client={qc}>
        <DailyLearningSun size={40} />
      </QueryClientProvider>,
    ),
  };
}

describe("DailyLearningSun", () => {
  it("shows the lit state when studied_today is true", async () => {
    summary.mockResolvedValue({ studied_today: true });
    renderSun();
    expect(await screen.findByLabelText(SUN_COPY.lit)).toBeInTheDocument();
  });

  it("shows the unlit state when studied_today is false", async () => {
    summary.mockResolvedValue({ studied_today: false });
    renderSun();
    expect(await screen.findByLabelText(SUN_COPY.unlit)).toBeInTheDocument();
  });

  it("renders a loading state (not a confident OFF) before data arrives", () => {
    // Never resolves → stays pending.
    summary.mockReturnValue(new Promise(() => {}));
    renderSun();
    expect(screen.getByLabelText(SUN_COPY.loading)).toBeInTheDocument();
    expect(screen.queryByLabelText(SUN_COPY.unlit)).not.toBeInTheDocument();
  });

  it("re-renders all mounted suns when the shared cache flips", async () => {
    summary.mockResolvedValue({ studied_today: false });
    const { qc } = renderSun();
    expect(await screen.findByLabelText(SUN_COPY.unlit)).toBeInTheDocument();
    // A qualifying activity patches the shared query → the sun lights up.
    qc.setQueryData(["dashboard"], { studied_today: true });
    await waitFor(() => expect(screen.getByLabelText(SUN_COPY.lit)).toBeInTheDocument());
  });
});
