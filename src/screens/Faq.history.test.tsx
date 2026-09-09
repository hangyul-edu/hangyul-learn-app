/**
 * Back-navigation through the FAQ flow.
 *
 * Backing out must return through the hierarchy once per screen — FAQ → More →
 * Home — with no hidden entries stacked behind the current screen. The search
 * query is a filter on FAQ-001, not a screen, so it adds no entry at all.
 *
 * The tree is wrapped in StrictMode because the app is: StrictMode
 * double-invokes effects, and the effect that mirrors the search box into the
 * URL is the one that touches history, so a duplicate only shows up under it.
 */
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { I18nProvider } from "../i18n";

const faqs = vi.fn();
vi.mock("../api/endpoints", () => ({
  supportApi: { faqs: (...a: unknown[]) => faqs(...a), faq: vi.fn() },
}));
vi.mock("../components/faq/SupportChatButton", () => ({
  SupportChatButton: () => null,
}));

const { Faq } = await import("./Faq");

const KO_EMPTY = "아직 등록된 질문이 없어요";

/** Drives the platform back button. */
function Back() {
  const nav = useNavigate();
  return (
    <button type="button" onClick={() => nav(-1)}>
      BACK
    </button>
  );
}

function mount(entries: string[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <StrictMode>
      <QueryClientProvider client={qc}>
        <I18nProvider language="ko">
          <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
            <Back />
            <Routes>
              <Route path="/home" element={<div>HOME</div>} />
              <Route path="/profile" element={<div>MORE</div>} />
              <Route path="/faq" element={<Faq />} />
            </Routes>
          </MemoryRouter>
        </I18nProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
}

const back = () => userEvent.click(screen.getByRole("button", { name: "BACK" }));
const onFaq001 = () => screen.findByText("🚀");

beforeEach(() => {
  faqs.mockReset();
  faqs.mockResolvedValue({ items: [], next_cursor: null });
});

describe("searching from FAQ-001", () => {
  it("backs out one screen at a time: FAQ → More → Home", async () => {
    mount(["/home", "/profile", "/faq"]);
    await onFaq001();

    await userEvent.type(screen.getByPlaceholderText("무엇이든 물어보세요"), "abcda");
    expect(await screen.findByText(KO_EMPTY)).toBeInTheDocument();

    // Searching added no entry, so the first press leaves the FAQ screen —
    // two presses to Home, not three.
    await back();
    expect(await screen.findByText("MORE")).toBeInTheDocument();
    await back();
    expect(await screen.findByText("HOME")).toBeInTheDocument();
  });

  it("does not stack an entry per keystroke", async () => {
    mount(["/profile", "/faq"]);
    await onFaq001();

    // Typed in pieces, so the debounced value settles more than once.
    const box = screen.getByPlaceholderText("무엇이든 물어보세요");
    await userEvent.type(box, "abc");
    await screen.findByText(KO_EMPTY);
    await userEvent.type(box, "da");
    await waitFor(() => expect(box).toHaveValue("abcda"));
    await screen.findByText(KO_EMPTY);

    // Still exactly one entry for the whole search session.
    await back();
    expect(await screen.findByText("MORE")).toBeInTheDocument();
  });

  it("does not stack an entry when the query is cleared", async () => {
    mount(["/profile", "/faq"]);
    await onFaq001();

    const box = screen.getByPlaceholderText("무엇이든 물어보세요");
    await userEvent.type(box, "abcda");
    await screen.findByText(KO_EMPTY);
    await userEvent.clear(box);
    // Clearing returns to FAQ-001 in place, without a new entry.
    expect(await onFaq001()).toBeInTheDocument();

    await back();
    expect(await screen.findByText("MORE")).toBeInTheDocument();
  });
});

describe("opening /faq?q=… directly", () => {
  it("shows the shared empty view for a query with no matches", async () => {
    const { container } = mount(["/profile", "/faq?q=abcda"]);
    expect(await screen.findByText(KO_EMPTY)).toBeInTheDocument();
    // The same FAQ-(empty) element, not a search-specific block.
    expect(container.querySelector(".faq__empty")).not.toBeNull();
    expect(container.querySelector(".state")).toBeNull();
  });

  it("leaves no hidden entry behind the search screen", async () => {
    mount(["/profile", "/faq?q=abcda"]);
    await screen.findByText(KO_EMPTY);

    // A direct URL is one entry: a single press leaves the FAQ flow entirely.
    await back();
    expect(await screen.findByText("MORE")).toBeInTheDocument();
  });

  it("still backs out once per screen when it is the whole stack", async () => {
    mount(["/home", "/profile", "/faq?q=abcda"]);
    await screen.findByText(KO_EMPTY);
    await back();
    expect(await screen.findByText("MORE")).toBeInTheDocument();
    await back();
    expect(await screen.findByText("HOME")).toBeInTheDocument();
  });
});
