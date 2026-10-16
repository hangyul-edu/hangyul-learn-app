/**
 * A regular member's locked session field (TAL-008 / TAL-016): the
 * "★ Premium only" tag is hidden until the field is tapped, then shows for a
 * moment; a second tap keeps it up for the full time again.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "../../i18n";
import { PREMIUM_TAG_MS, PremiumLockedField } from "./PremiumLockedField";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function renderField() {
  return render(
    <I18nProvider language="en">
      <PremiumLockedField placeholder="✨ Choose a question type to focus on" />
    </I18nProvider>,
  );
}

describe("PremiumLockedField", () => {
  it("shows the tag only after a tap, then hides it again", () => {
    renderField();
    expect(screen.queryByText("★ Premium only")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Choose a question type/ }));
    expect(screen.getByText("★ Premium only")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(PREMIUM_TAG_MS));
    expect(screen.queryByText("★ Premium only")).not.toBeInTheDocument();
  });

  it("restarts the time on another tap", () => {
    renderField();
    const field = screen.getByRole("button", { name: /Choose a question type/ });
    fireEvent.click(field);
    act(() => vi.advanceTimersByTime(PREMIUM_TAG_MS - 500));
    fireEvent.click(field);
    act(() => vi.advanceTimersByTime(PREMIUM_TAG_MS - 500));
    expect(screen.getByText("★ Premium only")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(500));
    expect(screen.queryByText("★ Premium only")).not.toBeInTheDocument();
  });

  it("tells assistive tech the field is premium-only", () => {
    renderField();
    expect(
      screen.getByRole("button", {
        name: "Choose a question type to focus on (This feature is available to premium members only.)",
      }),
    ).toHaveTextContent("🔒 Choose a question type to focus on");
  });
});
