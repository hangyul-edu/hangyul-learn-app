import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/* -------------------------------- mocks --------------------------------- */
const { checkIn } = vi.hoisted(() => ({ checkIn: vi.fn() }));
vi.mock("../api/endpoints", () => ({ gameApi: { checkIn } }));

let authState: {
  status: string;
  me: { app_language: string; onboarding_completed?: boolean } | null;
} = {
  status: "signed-in",
  me: { app_language: "ko", onboarding_completed: true },
};
vi.mock("../hooks/auth", () => ({ useAuth: () => authState }));

import { AttendanceGate } from "./AttendanceGate";
import { I18nProvider } from "../i18n";

const FRESH = {
  checked_in_today: false,
  consecutive_days: 3,
  last_checkin_date: "2026-07-22",
  points_awarded: 5,
  streak_bonus_awarded: false,
};
const ALREADY = { ...FRESH, checked_in_today: true, points_awarded: 0 };

function renderGate() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nProvider language="ko">
      <QueryClientProvider client={qc}>
        <AttendanceGate />
      </QueryClientProvider>
    </I18nProvider>,);
}

const dialog = () => screen.queryByRole("dialog");

beforeEach(() => {
  vi.clearAllMocks();
  authState = { status: "signed-in", me: { app_language: "ko", onboarding_completed: true } };
  checkIn.mockResolvedValue(FRESH);
});
afterEach(() => {
  document.body.style.overflow = "";
});

describe("AttendanceGate", () => {
  it("shows the completion modal for a fresh, points-awarding check-in", async () => {
    renderGate();
    await waitFor(() => expect(checkIn).toHaveBeenCalledTimes(1));
    const d = await screen.findByRole("dialog");
    expect(d).toHaveTextContent("오늘 출석 완료!");
    expect(d).toHaveTextContent("+5P");
    expect(d).toHaveTextContent("연속 3일 달성");
  });

  it("does NOT show the modal for a duplicate same-day check (already checked)", async () => {
    checkIn.mockResolvedValue(ALREADY);
    renderGate();
    await waitFor(() => expect(checkIn).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 0));
    expect(dialog()).toBeNull();
  });

  it("does NOT show the modal when no points were awarded", async () => {
    checkIn.mockResolvedValue({ ...FRESH, points_awarded: 0 });
    renderGate();
    await waitFor(() => expect(checkIn).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 0));
    expect(dialog()).toBeNull();
  });

  it("does NOT show the modal when the request fails", async () => {
    checkIn.mockRejectedValue(new Error("offline"));
    renderGate();
    await waitFor(() => expect(checkIn).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 0));
    expect(dialog()).toBeNull();
  });

  it("does NOT show the modal for a malformed response", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    checkIn.mockResolvedValue({ points_awarded: 5 }); // missing required fields
    renderGate();
    await waitFor(() => expect(checkIn).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 0));
    expect(dialog()).toBeNull();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("does NOT check in or show the modal when signed out", async () => {
    authState = { status: "signed-out", me: null };
    renderGate();
    await new Promise((r) => setTimeout(r, 0));
    expect(checkIn).not.toHaveBeenCalled();
    expect(dialog()).toBeNull();
  });

  it("does NOT check in while the user is still going through onboarding", async () => {
    authState = { status: "signed-in", me: { app_language: "ko", onboarding_completed: false } };
    renderGate();
    await new Promise((r) => setTimeout(r, 0));
    expect(checkIn).not.toHaveBeenCalled();
    expect(dialog()).toBeNull();
  });

  it("checks in once onboarding is complete", async () => {
    authState = { status: "signed-in", me: { app_language: "ko", onboarding_completed: true } };
    renderGate();
    await waitFor(() => expect(checkIn).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("checks in only once and does not re-show after a re-render", async () => {
    const { rerender } = renderGate();
    await screen.findByRole("dialog");
    // Must keep the same wrapper shape, or React remounts the gate and the
    // check-in fires a second time for reasons unrelated to the gate's guard.
    rerender(
      <I18nProvider language="ko">
        <QueryClientProvider client={new QueryClient()}>
          <AttendanceGate />
        </QueryClientProvider>
      </I18nProvider>,
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(checkIn).toHaveBeenCalledTimes(1);
  });

  it("does not re-show the modal after it is dismissed (same session)", async () => {
    renderGate();
    const d = await screen.findByRole("dialog");
    await userEvent.click(within(d).getByRole("button", { name: "출석 완료 확인" }));
    await waitFor(() => expect(dialog()).toBeNull());
    // Still only one check-in; no re-show.
    expect(checkIn).toHaveBeenCalledTimes(1);
  });
});
