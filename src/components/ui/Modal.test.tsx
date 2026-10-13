import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { Dialog, Sheet } from "./Modal";

describe("Dialog", () => {
  it("is announced as a modal dialog named by its title", () => {
    render(<Dialog open title="구독을 해지할까요?" text="body" />);
    const dialog = screen.getByRole("dialog", { name: "구독을 해지할까요?" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("moves focus inside on open and gives it back to the trigger on close", () => {
    function Host() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>delete</button>
          <Dialog open={open} onClose={() => setOpen(false)} title="삭제할까요?">
            <button onClick={() => setOpen(false)}>cancel</button>
          </Dialog>
        </>
      );
    }
    render(<Host />);
    const trigger = screen.getByRole("button", { name: "delete" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "삭제할까요?" });
    expect(dialog).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("closes on Escape, from the dialog or a control inside it", () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="t">
        <button>inside</button>
      </Dialog>,
    );
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.keyDown(screen.getByRole("button", { name: "inside" }), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("ignores Escape while it is not dismissable, and other keys", () => {
    const { rerender } = render(<Dialog open title="t" />);
    // No onClose (e.g. its action is pending): nothing to call, nothing thrown.
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    const onClose = vi.fn();
    rerender(<Dialog open onClose={onClose} title="t" />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Enter" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("leaves an Escape that ends an IME composition alone", () => {
    const onClose = vi.fn();
    render(<Dialog open onClose={onClose} title="t" />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape", isComposing: true });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes only the topmost of a dialog stacked over a sheet", () => {
    const closeSheet = vi.fn();
    const closeDialog = vi.fn();
    render(
      <Sheet open onClose={closeSheet} title="sheet">
        <Dialog open onClose={closeDialog} title="dialog" />
      </Sheet>,
    );
    fireEvent.keyDown(screen.getByRole("dialog", { name: "dialog" }), { key: "Escape" });
    expect(closeDialog).toHaveBeenCalledTimes(1);
    expect(closeSheet).not.toHaveBeenCalled();
  });
});

describe("Sheet accessibility", () => {
  it("is named by its visible title", () => {
    render(
      <Sheet open onClose={() => {}} title="카드 등록">
        <p>body</p>
      </Sheet>,
    );
    expect(screen.getByRole("dialog", { name: "카드 등록" })).toBeInTheDocument();
  });

  it("prefers an explicit label, and uses it when the title chrome is omitted", () => {
    const { rerender } = render(
      <Sheet open onClose={() => {}} title="visible" label="explicit">
        <p>body</p>
      </Sheet>,
    );
    expect(screen.getByRole("dialog", { name: "explicit" })).toBeInTheDocument();
    rerender(
      <Sheet open onClose={() => {}} bare title="hidden" label="bare sheet">
        <p>body</p>
      </Sheet>,
    );
    expect(screen.getByRole("dialog", { name: "bare sheet" })).not.toHaveAttribute("aria-labelledby");
  });

  it("closes on Escape and takes focus on open", () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} label="sheet">
        <input aria-label="field" />
      </Sheet>,
    );
    const sheet = screen.getByRole("dialog", { name: "sheet" });
    expect(sheet).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("textbox", { name: "field" }), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
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
