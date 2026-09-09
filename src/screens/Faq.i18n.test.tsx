/**
 * The member-facing FAQ list and detail must show the content authored for the
 * app's current language, and follow a language switch.
 *
 * The API is stubbed at the endpoint layer so the assertions are about what the
 * screens request and render, not about transport. What matters is that `lang`
 * carries the app language on every call — including the search call, since the
 * server searches only the selected language's text.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "../i18n";
import type { AppLanguage } from "../lib/language";
import type { Faq as FaqItem } from "../lib/types";

const CATALOG: Record<string, Record<string, FaqItem>> = {
  ko: {
    faq_1: {
      faq_id: "faq_1",
      category: "getting_started",
      question: "연속 학습이 끊겼어요.",
      answer: "프리즈 토큰을 사용하면 하루 결석을 보호할 수 있습니다.",
      locale: "ko",
    },
  },
  en: {
    faq_1: {
      faq_id: "faq_1",
      category: "getting_started",
      question: "My streak broke.",
      answer: "A freeze token protects a single missed day.",
      locale: "en",
    },
  },
};

const faqs = vi.fn();
const faq = vi.fn();
vi.mock("../api/endpoints", () => ({
  supportApi: {
    faqs: (...args: unknown[]) => faqs(...args),
    faq: (...args: unknown[]) => faq(...args),
    channelTalkIdentity: vi.fn().mockResolvedValue({ member_id: "m", member_hash: null }),
  },
}));

// The floating support button needs the auth tree and is irrelevant here.
vi.mock("../components/faq/SupportChatButton", () => ({
  SupportChatButton: () => null,
}));

const { Faq } = await import("./Faq");
const { FaqDetail } = await import("./FaqDetail");

beforeEach(() => {
  faqs.mockReset();
  faq.mockReset();
  faqs.mockImplementation((params: { lang?: string; q?: string }) => {
    const lang = params.lang ?? "en";
    const all = Object.values(CATALOG[lang] ?? {});
    const q = (params.q ?? "").trim().toLowerCase();
    // Mirrors the server: the keyword only matches the served language's text.
    const items = q
      ? all.filter(
          (f) =>
            f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q),
        )
      : all;
    return Promise.resolve({ items, next_cursor: null });
  });
  faq.mockImplementation((id: string, lang?: string) =>
    Promise.resolve(CATALOG[lang ?? "en"][id]),
  );
});

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function listTree(language: AppLanguage, url: string) {
  return (
    <QueryClientProvider client={client()}>
      <I18nProvider language={language}>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route path="/faq" element={<Faq />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>
  );
}

function detailTree(language: AppLanguage) {
  return (
    <QueryClientProvider client={client()}>
      <I18nProvider language={language}>
        <MemoryRouter initialEntries={["/faq/faq_1"]}>
          <Routes>
            <Route path="/faq/:faqId" element={<FaqDetail />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>
  );
}

describe("FAQ list localization", () => {
  it("requests and renders Korean in Korean mode", async () => {
    render(listTree("ko", "/faq?category=getting_started"));
    expect(await screen.findByText("연속 학습이 끊겼어요.")).toBeInTheDocument();
    expect(faqs).toHaveBeenCalledWith(expect.objectContaining({ lang: "ko" }));
  });

  it("requests and renders English in English mode", async () => {
    render(listTree("en", "/faq?category=getting_started"));
    expect(await screen.findByText("My streak broke.")).toBeInTheDocument();
    expect(faqs).toHaveBeenCalledWith(expect.objectContaining({ lang: "en" }));
    expect(screen.queryByText("연속 학습이 끊겼어요.")).not.toBeInTheDocument();
  });

  it("refetches in the new language when the language switches", async () => {
    const { rerender } = render(listTree("ko", "/faq?category=getting_started"));
    expect(await screen.findByText("연속 학습이 끊겼어요.")).toBeInTheDocument();

    rerender(listTree("en", "/faq?category=getting_started"));
    expect(await screen.findByText("My streak broke.")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText("연속 학습이 끊겼어요.")).not.toBeInTheDocument(),
    );
  });

  it("searches the selected language's text", async () => {
    render(listTree("en", "/faq?q=freeze"));
    expect(await screen.findByText("My streak broke.")).toBeInTheDocument();
    expect(faqs).toHaveBeenCalledWith(
      expect.objectContaining({ q: "freeze", lang: "en" }),
    );
  });

  it("shows no results for a Korean keyword while in English mode", async () => {
    render(listTree("en", "/faq?q=프리즈"));
    await waitFor(() => expect(faqs).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.queryByText("My streak broke.")).not.toBeInTheDocument(),
    );
  });
});

describe("FAQ detail localization", () => {
  it("renders the language the app is in, and follows a switch", async () => {
    const { rerender } = render(detailTree("ko"));
    expect(
      await screen.findByText("프리즈 토큰을 사용하면 하루 결석을 보호할 수 있습니다."),
    ).toBeInTheDocument();
    expect(faq).toHaveBeenCalledWith("faq_1", "ko");

    rerender(detailTree("en"));
    expect(
      await screen.findByText("A freeze token protects a single missed day."),
    ).toBeInTheDocument();
    expect(faq).toHaveBeenCalledWith("faq_1", "en");
  });
});
