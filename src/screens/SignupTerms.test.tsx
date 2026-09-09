/**
 * The sign-up agreement sheet and the Terms & Policies detail page must show
 * the same Terms of Service.
 *
 * Sign-up used to open its own five-article summary, which drifted from
 * TRM-002. Both now render `TERMS_OF_SERVICE` through `PolicyBody`, and this
 * compares the two rendered documents character for character in each language
 * so a future edit cannot reintroduce a second copy.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "../i18n";
import { ToastProvider } from "../hooks/toast";
import type { AppLanguage } from "../lib/language";

vi.mock("../api/endpoints", () => ({
  authApi: {
    startPhone: vi.fn(),
    confirmPhone: vi.fn(),
    startEmail: vi.fn(),
    confirmEmail: vi.fn(),
    signup: vi.fn(),
  },
}));
vi.mock("../hooks/auth", () => ({
  useAuth: () => ({ applyTokens: vi.fn(), bootstrapMe: vi.fn() }),
}));

const { Signup } = await import("./Signup");
const { Policy } = await import("./Policy");

function wrap(language: AppLanguage, children: React.ReactNode) {
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider language={language}>
        <ToastProvider>{children}</ToastProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

/** The Terms of Service as the Terms & Policies page renders it. */
function policyPageText(language: AppLanguage): string {
  const view = render(
    wrap(
      language,
      <MemoryRouter initialEntries={["/policy/terms-of-use"]}>
        <Routes>
          <Route path="/policy/:doc" element={<Policy />} />
        </Routes>
      </MemoryRouter>,
    ),
  );
  const text = document.querySelector(".policy")?.textContent ?? "";
  view.unmount();
  return text;
}

/** The Terms of Service as the sign-up agreement sheet renders it. */
async function signupSheetText(language: AppLanguage, label: string): Promise<string> {
  const view = render(
    wrap(
      language,
      <MemoryRouter initialEntries={["/signup"]}>
        <Routes>
          <Route path="/signup" element={<Signup />} />
        </Routes>
      </MemoryRouter>,
    ),
  );
  await userEvent.click(screen.getByText(label));
  const text = document.querySelector(".policy")?.textContent ?? "";
  view.unmount();
  return text;
}

describe("sign-up Terms of Service", () => {
  it.each([
    ["ko" as const, "회원이용약관 (필수)", "이용약관", "제1조 (목적)"],
    ["en" as const, "Terms of service (required)", "Terms of Service", "Article 1 (Purpose)"],
  ])("matches the Terms & Policies document in %s", async (language, label, title, first) => {
    const sheet = await signupSheetText(language, label);
    cleanup();
    const page = policyPageText(language);

    // Guard against comparing two empty strings.
    expect(page.length).toBeGreaterThan(2000);
    expect(page).toContain(first);
    expect(sheet).toBe(page);

    // The sheet is headed by the document's own title, not a signup-only one.
    cleanup();
    const view = render(
      wrap(
        language,
        <MemoryRouter initialEntries={["/signup"]}>
          <Routes>
            <Route path="/signup" element={<Signup />} />
          </Routes>
        </MemoryRouter>,
      ),
    );
    await userEvent.click(screen.getByText(label));
    expect(screen.getByText(title)).toBeInTheDocument();
    view.unmount();
  });

  it("shows Korean and English versions that actually differ", async () => {
    const ko = await signupSheetText("ko", "회원이용약관 (필수)");
    cleanup();
    const en = await signupSheetText("en", "Terms of service (required)");
    expect(ko).not.toBe(en);
    expect(ko).toContain("제17조 (준거법 및 관할)");
    expect(en).toContain("Article 17 (Governing Law and Jurisdiction)");
    // No Korean may leak into the English sheet.
    expect(en).not.toMatch(/[가-힣]/);
  });
});
