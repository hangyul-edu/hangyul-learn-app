import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Dialog, Sheet } from "./Modal";

describe("Dialog", () => {
  it("is announced as a modal dialog named by its title", () => {
    render(<Dialog open title="구독을 해지할까요?" text="body" />);
    const dialog = screen.getByRole("dialog", { name: "구독을 해지할까요?" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });
});

describe("Sheet hardware-back handling", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps its single history entry when the parent re-renders with a new onClose", () => {
    // Callers pass inline arrows (`onClose={() => setOpen(false)}`), so every
    // parent render hands the sheet a new function. That must not tear down
    // the sheet's history entry: `history.back()` is asynchronous, so popping
    // and re-pushing lands the queued traversal on the fresh entry and fires
    // popstate — closing a sheet nobody asked to close.
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const push = vi.spyOn(window.history, "pushState");
    const view = (onClose: () => void) => (
      <Sheet open onClose={onClose} label="sheet">
        <p>body</p>
      </Sheet>
    );

    const { rerender } = render(view(() => {}));
    rerender(view(() => {}));
    rerender(view(() => {}));

    expect(push).toHaveBeenCalledTimes(1);
    expect(back).not.toHaveBeenCalled();
  });

  it("closes through the latest onClose when Back is pressed", () => {
    const first = vi.fn();
    const latest = vi.fn();
    const view = (onClose: () => void) => (
      <Sheet open onClose={onClose} label="sheet">
        <p>body</p>
      </Sheet>
    );
    const { rerender } = render(view(first));
    rerender(view(latest));

    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);
  });
});
