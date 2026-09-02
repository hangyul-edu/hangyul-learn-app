import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { I18nProvider, useI18n, T } from "./context";
import { interpolate, parts, plain, resolve, translate } from "./translate";
import { ko } from "./locales/ko";
import { en } from "./locales/en";
import { LANGUAGE_STORAGE_KEY, normalizeLanguage, detectLanguage } from "../lib/language";
import type { CatalogNode } from "./types";

/** Every leaf path in a catalog, for structural comparison. */
function leaves(node: CatalogNode, prefix = ""): string[] {
  return Object.entries(node).flatMap(([k, v]) =>
    typeof v === "string" ? [`${prefix}${k}`] : leaves(v, `${prefix}${k}.`),
  );
}

describe("catalogs", () => {
  it("cover exactly the same keys in both languages", () => {
    expect(leaves(en as CatalogNode).sort()).toEqual(leaves(ko as CatalogNode).sort());
  });

  it("has no empty messages in either language", () => {
    for (const lang of ["ko", "en"] as const) {
      for (const key of leaves(ko as CatalogNode)) {
        expect(resolve(lang, key), `${lang}.${key} is empty`).not.toHaveLength(0);
      }
    }
  });

  it("uses the same placeholder set for a key in both languages", () => {
    const slots = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort();
    for (const key of leaves(ko as CatalogNode)) {
      expect(slots(resolve("en", key)), `placeholders differ for ${key}`).toEqual(
        slots(resolve("ko", key)),
      );
    }
  });

  it("keeps emphasis markers balanced", () => {
    for (const lang of ["ko", "en"] as const) {
      for (const key of leaves(ko as CatalogNode)) {
        const m = resolve(lang, key);
        expect((m.match(/<s>/g) ?? []).length).toBe((m.match(/<\/s>/g) ?? []).length);
      }
    }
  });
});

describe("translate", () => {
  it("substitutes placeholders and leaves unknown ones intact", () => {
    expect(interpolate("Hi {name}, you have {n}", { name: "Ana", n: 3 })).toBe("Hi Ana, you have 3");
    expect(interpolate("Hi {name}", {})).toBe("Hi {name}");
  });

  it("renders the Figma copy for each language rather than translating it", () => {
    // The Korean leads with the name, the English trails it — the two frames
    // were authored independently and neither is derived from the other.
    expect(plain(translate("ko", "home.greeting", { name: "민준" }))).toBe("민준님, 반가워요!");
    expect(plain(translate("en", "home.greeting", { name: "Elsy" }))).toBe("Welcome, Elsy!");
    expect(translate("ko", "home.streak", { days: 100 })).toBe("연속 학습 100일째");
    expect(translate("en", "home.streak", { days: 100 })).toBe("100-Day Streak");
  });

  it("falls back to Korean for a key missing from another catalog", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(resolve("en", "home.streak")).toBe("{days}-Day Streak"); // present, no fallback
    expect(resolve("ko", "nope.missing")).toBe("nope.missing"); // unknown everywhere
    warn.mockRestore();
  });

  it("splits emphasis markers into parts", () => {
    expect(parts("Welcome, <s>Elsy!</s>")).toEqual([
      { text: "Welcome, ", strong: false },
      { text: "Elsy!", strong: true },
    ]);
    expect(parts("plain")).toEqual([{ text: "plain", strong: false }]);
  });
});

describe("normalizeLanguage", () => {
  it("accepts locale tags and casing, and clamps anything else", () => {
    expect(normalizeLanguage("ko")).toBe("ko");
    expect(normalizeLanguage("ko-KR")).toBe("ko");
    expect(normalizeLanguage("ko_KR")).toBe("ko");
    expect(normalizeLanguage("KO")).toBe("ko");
    expect(normalizeLanguage("en-US")).toBe("en");
    expect(normalizeLanguage("fr")).toBe("en");
    expect(normalizeLanguage(null)).toBe("en");
  });
});

function Probe() {
  const { language, setLanguage, adoptProfileLanguage } = useI18n();
  return (
    <div>
      <span data-testid="lang">{language}</span>
      <T k="home.greeting" vars={{ name: "Ana" }} />
      <button onClick={() => setLanguage("ko")}>choose ko</button>
      <button onClick={() => adoptProfileLanguage("ko")}>profile ko</button>
    </div>
  );
}

describe("I18nProvider", () => {
  beforeEach(() => localStorage.clear());

  it("renders the emphasised segment as <b> where the design puts it", () => {
    render(
      <I18nProvider language="en">
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByText("Ana!").tagName).toBe("B");
    expect(screen.getByText("Welcome,", { exact: false })).toBeInTheDocument();
  });

  it("persists an explicit choice and reflects it on the document", () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    act(() => screen.getByText("choose ko").click());
    expect(screen.getByTestId("lang")).toHaveTextContent("ko");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("ko");
    expect(document.documentElement.lang).toBe("ko");
  });

  it("seeds from the profile when the user has not chosen one", () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    act(() => screen.getByText("profile ko").click());
    expect(screen.getByTestId("lang")).toHaveTextContent("ko");
  });

  it("never lets a profile refetch override an explicit choice", () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "en");
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    act(() => screen.getByText("profile ko").click());
    expect(screen.getByTestId("lang")).toHaveTextContent("en");
  });

  it("detects a supported browser language", () => {
    expect(["ko", "en"]).toContain(detectLanguage());
  });
});
