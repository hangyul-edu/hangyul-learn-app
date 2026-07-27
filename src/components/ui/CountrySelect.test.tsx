import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CountrySelect } from "./CountrySelect";

function renderSelect(value = "KR") {
  const onChange = vi.fn();
  const utils = render(<CountrySelect value={value} onChange={onChange} />);
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
    expect(screen.getByRole("option", { name: /United States/ })).toBeInTheDocument();
  });

  it("selecting a country reports it and closes the dropdown", async () => {
    const user = userEvent.setup();
    const { trigger, onChange } = renderSelect();
    await user.click(trigger);
    // The full-width button inside the option row is the click target.
    await user.click(screen.getByRole("button", { name: /日本/ }));
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
