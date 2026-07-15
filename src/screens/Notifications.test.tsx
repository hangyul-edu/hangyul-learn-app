import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { ToastProvider } from "../hooks/toast";
import type { NotificationItem } from "../lib/types";

vi.mock("../api/endpoints", () => ({
  notifApi: {
    list: vi.fn(),
    markRead: vi.fn(),
    readAll: vi.fn(),
  },
}));

import { notifApi } from "../api/endpoints";
import { Notifications } from "./Notifications";

const api = notifApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

/* ------------------------------- factories ------------------------------ */
const iso = (d: Date) => d.toISOString();
const now = () => new Date();
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

let seq = 0;
function notif(over: Partial<NotificationItem> = {}): NotificationItem {
  seq += 1;
  return {
    notification_id: over.notification_id ?? `ntf_${seq}`,
    category: "learning_reminder",
    group: "learning",
    title: "제목",
    body: "본문",
    read: false,
    created_at: iso(now()),
    deep_link: null,
    ...over,
  };
}

/** Server returns a `sections` envelope; group items into one section for tests. */
function page(items: NotificationItem[], next: string | null = null) {
  return { sections: [{ key: "today", label: "Today", items }], unread_count: items.filter((i) => !i.read).length, next_cursor: next };
}

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="route">{loc.pathname}</div>;
}

function renderScreen() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/notifications"]}>
        <ToastProvider>
          <Routes>
            <Route path="/notifications" element={<Notifications />} />
            <Route path="*" element={<LocationProbe />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.list.mockResolvedValue(page([notif()]));
  api.markRead.mockResolvedValue(undefined);
});

/* -------------------------------- tests --------------------------------- */
describe("Notifications screen", () => {
  it("renders the header and 전체 filters, with 전체 selected by default", async () => {
    renderScreen();
    expect(await screen.findByRole("heading", { name: "알림" })).toBeInTheDocument();
    for (const label of ["전체 알림 보기", "학습 알림 보기", "공지 알림 보기", "소셜 알림 보기"]) {
      expect(screen.getByRole("tab", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole("tab", { name: "전체 알림 보기" })).toHaveAttribute("aria-selected", "true");
  });

  it("selecting a filter fetches that category (server-side group)", async () => {
    renderScreen();
    await screen.findByText("제목");
    await userEvent.click(screen.getByRole("tab", { name: "학습 알림 보기" }));
    await waitFor(() =>
      expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ group: "learning" })),
    );
    // 전체 sends no group filter.
    await userEvent.click(screen.getByRole("tab", { name: "전체 알림 보기" }));
    await waitFor(() =>
      expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ group: undefined })),
    );
  });

  it("groups notifications by local date (오늘 / 어제)", async () => {
    api.list.mockResolvedValue(
      page([
        notif({ notification_id: "t1", title: "오늘 것", created_at: iso(now()) }),
        notif({ notification_id: "y1", title: "어제 것", created_at: iso(daysAgo(1)) }),
      ]),
    );
    renderScreen();
    expect(await screen.findByRole("heading", { name: "오늘" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "어제" })).toBeInTheDocument();
    const today = screen.getByRole("region", { name: "오늘" });
    expect(within(today).getByText("오늘 것")).toBeInTheDocument();
  });

  it("styles unread vs read cards and renders category badges", async () => {
    api.list.mockResolvedValue(
      page([
        notif({ notification_id: "u", title: "미읽음", read: false, group: "learning" }),
        notif({ notification_id: "r", title: "읽음", read: true, group: "social" }),
      ]),
    );
    renderScreen();
    const unread = (await screen.findByText("미읽음")).closest("button")!;
    const read = screen.getByText("읽음").closest("button")!;
    expect(unread.className).toContain("is-unread");
    expect(read.className).toContain("is-read");
    expect(within(unread).getByText("학습")).toBeInTheDocument();
    expect(within(read).getByText("소셜")).toBeInTheDocument();
  });

  it("tapping a notification marks it read and navigates to its deep link", async () => {
    api.list.mockResolvedValue(page([notif({ notification_id: "n1", title: "출석", deep_link: "/points" })]));
    renderScreen();
    await userEvent.click(await screen.findByText("출석"));
    expect(api.markRead).toHaveBeenCalledWith("n1");
    await waitFor(() => expect(screen.getByTestId("route")).toHaveTextContent("/points"));
  });

  it("informational notifications (no deep link) mark read without navigating", async () => {
    api.list.mockResolvedValue(page([notif({ notification_id: "n2", title: "정보", deep_link: null })]));
    renderScreen();
    const card = (await screen.findByText("정보")).closest("button")!;
    await userEvent.click(card);
    expect(api.markRead).toHaveBeenCalledWith("n2");
    expect(screen.queryByTestId("route")).not.toBeInTheDocument(); // stayed on the screen
    await waitFor(() => expect(card.className).toContain("is-read")); // optimistic read applied
  });

  it("shows the all-notifications empty state", async () => {
    api.list.mockResolvedValue(page([]));
    renderScreen();
    expect(await screen.findByText("아직 알림이 없어요")).toBeInTheDocument();
  });

  it("shows the filtered empty state", async () => {
    api.list.mockImplementation((p: { group?: string }) =>
      Promise.resolve(p.group === "social" ? page([]) : page([notif()])),
    );
    renderScreen();
    await screen.findByText("제목");
    await userEvent.click(screen.getByRole("tab", { name: "소셜 알림 보기" }));
    expect(await screen.findByText("해당 알림이 없어요")).toBeInTheDocument();
  });

  it("does not flash the empty state before the first fetch resolves", async () => {
    let resolve!: (v: unknown) => void;
    api.list.mockReturnValue(new Promise((r) => { resolve = r; }));
    renderScreen();
    expect(screen.queryByText("아직 알림이 없어요")).not.toBeInTheDocument();
    resolve(page([]));
    expect(await screen.findByText("아직 알림이 없어요")).toBeInTheDocument();
  });

  it("stale filter responses never replace the current filter's results", async () => {
    let resolveLearning!: (v: unknown) => void;
    api.list.mockImplementation((p: { group?: string }) => {
      if (p.group === "learning") return new Promise((r) => { resolveLearning = r; });
      if (p.group === "announcement") return Promise.resolve(page([notif({ title: "공지 항목" })]));
      return Promise.resolve(page([notif({ title: "전체 항목" })]));
    });
    renderScreen();
    await screen.findByText("전체 항목");
    await userEvent.click(screen.getByRole("tab", { name: "학습 알림 보기" })); // slow, pending
    await userEvent.click(screen.getByRole("tab", { name: "공지 알림 보기" })); // fast, wins
    await screen.findByText("공지 항목");
    // The late learning response must be ignored (seq guard).
    resolveLearning(page([notif({ title: "학습 항목" })]));
    await waitFor(() => expect(screen.queryByText("학습 항목")).not.toBeInTheDocument());
    expect(screen.getByText("공지 항목")).toBeInTheDocument();
  });

  it("read-state failure restores the unread style", async () => {
    api.list.mockResolvedValue(page([notif({ notification_id: "n3", title: "실패건", read: false, deep_link: null })]));
    api.markRead.mockRejectedValue(new Error("boom"));
    renderScreen();
    const card = (await screen.findByText("실패건")).closest("button")!;
    await userEvent.click(card);
    await waitFor(() => expect(api.markRead).toHaveBeenCalledWith("n3"));
    // After the definitive failure the card is restored to unread, not stuck read.
    await waitFor(() => expect(card.className).toContain("is-unread"));
  });
});
