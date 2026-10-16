/**
 * 나의 플랜: the "무료체험중" ribbon shows only while the free trial is actually
 * running (`in_trial` from /subscriptions/me). A trial whose access was ended
 * early keeps its lifecycle status `trial`, but is no longer a free trial.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { sub } = vi.hoisted(() => ({ sub: { data: null as Record<string, unknown> | null } }));
vi.mock("../../api/queries", () => ({
  useMySubscription: () => ({ data: sub.data, isLoading: false, isError: false, refetch: vi.fn() }),
}));

import { I18nProvider } from "../../i18n";
import { PlanCard } from "./PlanCard";

function renderCard() {
  return render(
    <I18nProvider language="ko">
      <MemoryRouter>
        <PlanCard />
      </MemoryRouter>
    </I18nProvider>,
  );
}

const base = { plan_name: "월간 플랜", current_period_end: null, coupon_backed: false };

beforeEach(() => {
  sub.data = null;
});

describe("PlanCard trial ribbon", () => {
  it("shows the free-trial ribbon while the trial is running", () => {
    sub.data = { ...base, status: "trial", in_trial: true };
    renderCard();
    expect(screen.getByText("무료체험중")).toBeInTheDocument();
  });

  it("drops it once the trial's access has ended, though the status still reads trial", () => {
    sub.data = { ...base, status: "trial", in_trial: false };
    renderCard();
    expect(screen.queryByText("무료체험중")).not.toBeInTheDocument();
  });

  it("falls back to the status when the payload has no in_trial flag", () => {
    sub.data = { ...base, status: "trial_ending" };
    renderCard();
    expect(screen.getByText("무료체험중")).toBeInTheDocument();
  });

  it("a paid subscription has no ribbon", () => {
    sub.data = { ...base, status: "active", in_trial: false };
    renderCard();
    expect(screen.queryByText("무료체험중")).not.toBeInTheDocument();
    expect(screen.getByText("월간 플랜")).toBeInTheDocument();
  });
});
