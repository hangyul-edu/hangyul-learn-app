import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryRouter } from "react-router-dom";

let mockMe: { app_language: string } | null = { app_language: "ko" };
vi.mock("../hooks/auth", () => ({ useAuth: () => ({ me: mockMe }) }));
vi.mock("../api/endpoints", () => ({
  supportApi: { notices: vi.fn(), notice: vi.fn(), markNoticeRead: vi.fn() },
}));

import { supportApi } from "../api/endpoints";
import { ApiError } from "../lib/http";
import { NoticeDetail } from "./NoticeDetail";
import { I18nProvider } from "../i18n";

const api = supportApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

function renderDetail(
  id = "n_a",
  // The screen retries transient errors twice; keep that behavior but make it
  // instant so tests stay fast and deterministic.
  qc = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } }),
) {
  const router = createMemoryRouter(
    [
      { path: "/more/notices", element: <div>LIST_SCREEN</div> },
      { path: "/more/notices/:noticeId", element: <NoticeDetail /> },
    ],
    // Enter via the list first so in-app back history exists.
    { initialEntries: ["/more/notices", `/more/notices/${id}`], initialIndex: 1 },
  );
  return {
    qc,
    ...render(
      <I18nProvider language="ko">
        <QueryClientProvider client={qc}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </I18nProvider>,),
  };
}

const DETAIL = {
  notice_id: "n_a",
  title: "서비스 정식 오픈 안내",
  body: "안녕하세요, 한귤입니다.\n\n**지금 바로 시작해보세요.**\n\n- 회화 학습\n- TOPIK 대비",
  published_at: "2026-06-29T00:00:00+09:00",
  is_new: true,
  content_format: "markdown" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockMe = { app_language: "ko" };
  api.markNoticeRead.mockResolvedValue(undefined);
});

describe("NoticeDetail screen", () => {
  it("shows a skeleton (with a reachable back button) while loading", () => {
    api.notice.mockReturnValue(new Promise(() => {}));
    const { container } = renderDetail();
    expect(screen.getByRole("button", { name: "뒤로 가기" })).toBeInTheDocument();
    expect(container.querySelector(".ntc__body-skeleton")).toBeInTheDocument();
  });

  it("renders the title, detail date (yyyy.MM.dd), and formatted rich-text body", async () => {
    api.notice.mockResolvedValue(DETAIL);
    const { container } = renderDetail();
    expect(await screen.findByText("서비스 정식 오픈 안내")).toBeInTheDocument();
    expect(screen.getByText("2026.06.29")).toBeInTheDocument();
    // Markdown structure preserved: paragraphs, bold, bullet list.
    await waitFor(() => expect(container.querySelectorAll(".ntc__body p.md__p").length).toBeGreaterThanOrEqual(1));
    expect(container.querySelector(".ntc__body strong")).toHaveTextContent("지금 바로 시작해보세요.");
    expect(container.querySelectorAll(".ntc__body ul.md__list li")).toHaveLength(2);
  });

  it("fetches the detail by the exact id and language", async () => {
    api.notice.mockResolvedValue(DETAIL);
    renderDetail("n_a");
    await screen.findByText("서비스 정식 오픈 안내");
    expect(api.notice).toHaveBeenCalledWith("n_a", "ko");
  });

  it("shows a localized not-found state with a back-to-list action on 404", async () => {
    api.notice.mockRejectedValue(new ApiError(404, "not_found", "gone"));
    renderDetail();
    expect(await screen.findByText("공지사항을 찾을 수 없어요")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "공지사항 목록으로" }));
    expect(await screen.findByText("LIST_SCREEN")).toBeInTheDocument();
  });

  it("shows an error + retry on a general failure and retries in place", async () => {
    api.notice.mockRejectedValue(new Error("boom")); // fails through the retries
    renderDetail();
    const retry = await screen.findByRole("button", { name: "다시 시도" });
    api.notice.mockResolvedValueOnce(DETAIL); // next fetch (the retry tap) succeeds
    await userEvent.click(retry);
    expect(await screen.findByText("서비스 정식 오픈 안내")).toBeInTheDocument();
  });

  it("back button returns to the notice list", async () => {
    api.notice.mockResolvedValue(DETAIL);
    renderDetail();
    await screen.findByText("서비스 정식 오픈 안내");
    await userEvent.click(screen.getByRole("button", { name: "뒤로 가기" }));
    expect(await screen.findByText("LIST_SCREEN")).toBeInTheDocument();
  });

  it("records the read once when a notice detail successfully opens", async () => {
    api.notice.mockResolvedValue(DETAIL);
    renderDetail("n_a");
    await screen.findByText("서비스 정식 오픈 안내");
    await waitFor(() => expect(api.markNoticeRead).toHaveBeenCalledWith("n_a"));
    expect(api.markNoticeRead).toHaveBeenCalledTimes(1);
  });

  it("does not record a read when the detail fails to load (404)", async () => {
    api.notice.mockRejectedValue(new ApiError(404, "not_found", "gone"));
    renderDetail("n_a");
    await screen.findByText("공지사항을 찾을 수 없어요");
    await new Promise((r) => setTimeout(r, 0));
    expect(api.markNoticeRead).not.toHaveBeenCalled();
  });

  it("clears is_new in the cached notice list immediately after marking read", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
    // Seed a list cache where n_a is still new.
    qc.setQueryData(["notices", "ko"], {
      pageParams: [undefined],
      pages: [
        {
          items: [
            { notice_id: "n_a", title: "새 공지", published_at: DETAIL.published_at, is_new: true },
            { notice_id: "n_b", title: "다른 공지", published_at: DETAIL.published_at, is_new: true },
          ],
          next_cursor: null,
        },
      ],
    });
    api.notice.mockResolvedValue(DETAIL);
    renderDetail("n_a", qc);
    await screen.findByText("서비스 정식 오픈 안내");
    await waitFor(() => expect(api.markNoticeRead).toHaveBeenCalledWith("n_a"));

    await waitFor(() => {
      const cached = qc.getQueryData(["notices", "ko"]) as {
        pages: { items: { notice_id: string; is_new: boolean }[] }[];
      };
      const items = cached.pages[0].items;
      expect(items.find((n) => n.notice_id === "n_a")?.is_new).toBe(false);
      // A different notice keeps its new-state.
      expect(items.find((n) => n.notice_id === "n_b")?.is_new).toBe(true);
    });
  });
});
