import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryRouter, useParams } from "react-router-dom";

/* -------------------------------- mocks --------------------------------- */
let mockMe: { app_language: string } | null = { app_language: "ko" };
vi.mock("../hooks/auth", () => ({ useAuth: () => ({ me: mockMe }) }));
vi.mock("../api/endpoints", () => ({
  supportApi: { notices: vi.fn(), notice: vi.fn(), markNoticeRead: vi.fn() },
}));

const EMPTY_KO = "아직 등록된 공지사항이 없어요";
const EMPTY_EN = "There are no notices yet.";

import { supportApi } from "../api/endpoints";
import { NoticeList } from "./NoticeList";

const api = supportApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

// Controllable IntersectionObserver so pagination can be driven deterministically.
let ioCallback: IntersectionObserverCallback | null = null;
class MockIO {
  constructor(cb: IntersectionObserverCallback) {
    ioCallback = cb;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
function triggerLoadMore() {
  act(() => {
    ioCallback?.([{ isIntersecting: true }] as unknown as IntersectionObserverEntry[], {} as IntersectionObserver);
  });
}

function NoticeIdProbe() {
  const { noticeId } = useParams();
  return <div>DETAIL:{noticeId}</div>;
}

function renderScreen() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: "/profile", element: <div>MORE_SCREEN</div> },
      { path: "/more/notices", element: <NoticeList /> },
      { path: "/more/notices/:noticeId", element: <NoticeIdProbe /> },
    ],
    { initialEntries: ["/profile", "/more/notices"], initialIndex: 1 },
  );
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

const NOTICE_A = { notice_id: "n_a", title: "가장 최신 공지", body: "본문 A", published_at: "2026-06-29T00:00:00+09:00", is_new: true };
const NOTICE_B = { notice_id: "n_b", title: "이전 공지", body: "본문 B", published_at: "2026-06-20T00:00:00+09:00", is_new: false };

beforeEach(() => {
  vi.clearAllMocks();
  mockMe = { app_language: "ko" };
  ioCallback = null;
  globalThis.IntersectionObserver = MockIO as unknown as typeof IntersectionObserver;
  api.notices.mockResolvedValue({ items: [NOTICE_A, NOTICE_B], next_cursor: null });
});
afterEach(() => {
  ioCallback = null;
});

describe("NoticeList screen", () => {
  it("shows a skeleton while the first page is loading (no empty message)", () => {
    api.notices.mockReturnValue(new Promise(() => {}));
    const { container } = renderScreen();
    expect(container.querySelector(".ntc__skeleton")).toBeInTheDocument();
    expect(screen.queryByText(EMPTY_KO)).not.toBeInTheDocument();
  });

  it("renders notices in the server-provided (newest-first) order", async () => {
    const { container } = renderScreen();
    await screen.findByText("가장 최신 공지");
    const titles = Array.from(container.querySelectorAll(".ntc__row-title")).map((e) => e.textContent);
    expect(titles).toEqual(["가장 최신 공지", "이전 공지"]);
  });

  it("marks only is_new rows with the N badge and tinted background", async () => {
    const { container } = renderScreen();
    await screen.findByText("가장 최신 공지");
    const rows = container.querySelectorAll(".ntc__row");
    expect(rows[0].className).toContain("ntc__row--new");
    expect(within(rows[0] as HTMLElement).getByLabelText("새 공지")).toHaveTextContent("N");
    // Normal notice: no badge, no tint.
    expect(rows[1].className).not.toContain("ntc__row--new");
    expect(within(rows[1] as HTMLElement).queryByLabelText("새 공지")).toBeNull();
  });

  it("formats the list date as yy.MM.dd", async () => {
    renderScreen();
    await screen.findByText("가장 최신 공지");
    expect(screen.getByText("26.06.29")).toBeInTheDocument();
  });

  it("navigates to the detail page with the tapped notice id", async () => {
    renderScreen();
    await userEvent.click(await screen.findByText("가장 최신 공지"));
    expect(await screen.findByText("DETAIL:n_a")).toBeInTheDocument();
  });

  it("back button (labeled 뒤로 가기) returns to the More page", async () => {
    renderScreen();
    await screen.findByText("가장 최신 공지");
    await userEvent.click(screen.getByRole("button", { name: "뒤로 가기" }));
    expect(await screen.findByText("MORE_SCREEN")).toBeInTheDocument();
  });

  it("shows the quiet empty state on a successful empty (ko) response", async () => {
    api.notices.mockResolvedValue({ items: [], next_cursor: null });
    const { container } = renderScreen();
    const msg = await screen.findByText(EMPTY_KO);
    expect(msg).toBeInTheDocument();
    // Header still present and localized.
    expect(screen.getByRole("heading", { name: "공지사항" })).toBeInTheDocument();
    // Minimal: no icon/card/skeleton/error/footer/badge, and it's not an alert.
    expect(screen.queryByRole("alert")).toBeNull();
    expect(container.querySelector(".ntc__skeleton")).toBeNull();
    expect(container.querySelector(".ntc__footer")).toBeNull();
    expect(screen.queryByLabelText("새 공지")).toBeNull();
    expect(screen.queryByRole("button", { name: "다시 시도" })).toBeNull();
    // Read history is untouched — the list never marks anything read.
    expect(api.markNoticeRead).not.toHaveBeenCalled();
  });

  it("shows the empty state with English copy when the app language is en", async () => {
    mockMe = { app_language: "en" };
    api.notices.mockResolvedValue({ items: [], next_cursor: null });
    renderScreen();
    expect(await screen.findByText(EMPTY_EN)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Notices" })).toBeInTheDocument();
  });

  it("renders rows (never the empty state) for a non-empty response", async () => {
    renderScreen();
    await screen.findByText("가장 최신 공지");
    expect(screen.queryByText(EMPTY_KO)).not.toBeInTheDocument();
  });

  it("shows an error + retry on initial failure (never the empty state)", async () => {
    api.notices.mockRejectedValueOnce(new Error("boom"));
    renderScreen();
    const retry = await screen.findByRole("button", { name: "다시 시도" });
    expect(screen.queryByText(EMPTY_KO)).not.toBeInTheDocument(); // error != empty
    api.notices.mockResolvedValueOnce({ items: [NOTICE_A], next_cursor: null });
    await userEvent.click(retry);
    expect(await screen.findByText("가장 최신 공지")).toBeInTheDocument();
  });

  it("shows a footer loader for the next page without removing existing rows", async () => {
    api.notices
      .mockResolvedValueOnce({ items: [NOTICE_A], next_cursor: "c1" })
      .mockReturnValueOnce(new Promise(() => {})); // page 2 pending
    const { container } = renderScreen();
    await screen.findByText("가장 최신 공지");
    triggerLoadMore();
    await waitFor(() => expect(container.querySelector(".ntc__footer-loader")).toBeInTheDocument());
    expect(screen.getByText("가장 최신 공지")).toBeInTheDocument(); // rows kept
  });

  it("shows a footer retry on pagination failure while keeping loaded rows", async () => {
    api.notices
      .mockResolvedValueOnce({ items: [NOTICE_A], next_cursor: "c1" })
      .mockRejectedValueOnce(new Error("page 2 boom"));
    renderScreen();
    await screen.findByText("가장 최신 공지");
    triggerLoadMore();
    const footerRetry = await waitFor(() => {
      const btn = document.querySelector(".ntc__footer-retry");
      if (!btn) throw new Error("no footer retry yet");
      return btn as HTMLButtonElement;
    });
    expect(footerRetry).toBeInTheDocument();
    expect(screen.getByText("가장 최신 공지")).toBeInTheDocument(); // rows preserved
  });

  it("requests the notices in the current app language (cache key + param)", async () => {
    mockMe = { app_language: "en" };
    renderScreen();
    // English chrome, and the request carries lang=en.
    expect(await screen.findByRole("heading", { name: "Notices" })).toBeInTheDocument();
    expect(api.notices).toHaveBeenCalledWith(expect.objectContaining({ lang: "en" }));
  });
});
