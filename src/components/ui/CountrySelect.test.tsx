import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../i18n";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CountrySelect } from "./CountrySelect";

function renderSelect(value = "KR") {
  const onChange = vi.fn();
  const utils = render(<I18nProvider language="ko"><CountrySelect value={value} onChange={onChange} /></I18nProvider>);
  const trigger = screen.getByRole("button", { name: /국가 선택/ });
  return { onChange, trigger, ...utils };
}

describe("CountrySelect", () => {
  it("is closed initially — no list, chevron down, aria-expanded false", () => {
    const { trigger } = renderSelect();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    // Closed → downward caret path.
    expect(document.querySelector("path")).toHaveAttribute("d", "M6 9l6 6 6-6");
  });

  it("opens an anchored dropdown listbox (not a dialog) on click", async () => {
    const user = userEvent.setup();
    const { trigger } = renderSelect();
    await user.click(trigger);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    // Open → upward caret path.
    expect(document.querySelector("path")).toHaveAttribute("d", "M6 15l6-6 6 6");
    // Names follow the app language, so a ko-rendered list is in Korean.
    expect(screen.getByRole("option", { name: /^미국 \+1$/ })).toBeInTheDocument();
  });

  it("lists every country and territory in alphabetical order", async () => {
    const user = userEvent.setup();
    const { trigger } = renderSelect();
    await user.click(trigger);
    const options = screen.getAllByRole("option");
    expect(options.length).toBeGreaterThanOrEqual(240);
    const names = options.map((o) => o.querySelector(".country-select__label")!.textContent!);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "ko")));
    expect(names[0]).toBe("가나");
    expect(screen.getByRole("option", { name: /^캐나다 \+1$/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /^푸에르토리코 \+1$/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /^카자흐스탄 \+7$/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /^코소보 \+383$/ })).toBeInTheDocument();
  });

  it("sorts A–Z in English", async () => {
    const user = userEvent.setup();
    render(<I18nProvider language="en"><CountrySelect value="KR" onChange={vi.fn()} /></I18nProvider>);
    await user.click(screen.getByRole("button", { name: /Select country/ }));
    const names = screen.getAllByRole("option").map((o) => o.querySelector(".country-select__label")!.textContent!);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en")));
    expect(names[0]).toBe("Afghanistan");
  });

  it.each([
    ["캐나", /^캐나다 \+1$/], // name in the app language
    ["canada", /^캐나다 \+1$/], // English name
    ["+852", /^홍콩.* \+852$/], // calling code with a plus
    ["0082", /^대한민국 \+82$/], // with the 00 prefix
  ])("search %s finds the country", async (query, name) => {
    const user = userEvent.setup();
    const { trigger } = renderSelect();
    await user.click(trigger);
    await user.type(screen.getByRole("searchbox"), query);
    expect(screen.getByRole("option", { name })).toBeInTheDocument();
  });

  it("a calling-code search lists only that code's countries", async () => {
    const user = userEvent.setup();
    const { trigger } = renderSelect();
    await user.click(trigger);
    await user.type(screen.getByRole("searchbox"), "+7");
    const names = screen.getAllByRole("option").map((o) => o.textContent);
    expect(names.every((n) => /\+7\d*$/.test(n ?? ""))).toBe(true);
    expect(names.some((n) => n?.includes("러시아"))).toBe(true);
  });

  it("says so when nothing matches", async () => {
    const user = userEvent.setup();
    const { trigger } = renderSelect();
    await user.click(trigger);
    await user.type(screen.getByRole("searchbox"), "zzzz");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("검색 결과가 없어요")).toBeInTheDocument();
  });

  it("names the current country in the trigger label", () => {
    renderSelect("GB");
    expect(screen.getByRole("button", { name: "국가 선택, 현재 영국" })).toBeInTheDocument();
  });

  it("selecting a country reports it and closes the dropdown", async () => {
    const user = userEvent.setup();
    const { trigger, onChange } = renderSelect();
    await user.click(trigger);
    // The full-width button inside the option row is the click target.
    await user.click(screen.getByRole("button", { name: /일본/ }));
    expect(onChange).toHaveBeenCalledWith("JP");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on outside click and on Escape", async () => {
    const user = userEvent.setup();
    const { trigger } = renderSelect();

    await user.click(trigger);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.click(document.body); // outside click
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await user.click(trigger);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
