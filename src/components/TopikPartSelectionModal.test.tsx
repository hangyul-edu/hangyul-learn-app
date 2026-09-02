import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../i18n";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TopikPartSelectionModal } from "./TopikPartSelectionModal";

function setup(overrides: Partial<Parameters<typeof TopikPartSelectionModal>[0]> = {}) {
  const onClose = vi.fn();
  const onStart = vi.fn();
  render(<I18nProvider language="ko"><TopikPartSelectionModal open onClose={onClose} onStart={onStart} {...overrides} /></I18nProvider>);
  return { onClose, onStart };
}

describe("TopikPartSelectionModal", () => {
  it("renders the eyebrow, title, three options and CTA", () => {
    setup();
    expect(screen.getByText("오늘은 어떤 파트를 학습해볼까요?")).toBeInTheDocument();
    expect(screen.getByText("학습할 파트를 선택하세요")).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("button", { name: /시작할게요/ })).toBeInTheDocument();
  });

  it("selects Listening (듣기) by default", () => {
    setup();
    expect(screen.getByRole("radio", { name: "듣기" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "읽기" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("radio", { name: "쓰기" })).toHaveAttribute("aria-checked", "false");
  });

  it("selects only one option at a time", async () => {
    setup();
    await userEvent.click(screen.getByRole("radio", { name: "읽기" }));
    expect(screen.getByRole("radio", { name: "읽기" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "듣기" })).toHaveAttribute("aria-checked", "false");
    await userEvent.click(screen.getByRole("radio", { name: "쓰기" }));
    expect(screen.getByRole("radio", { name: "쓰기" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "읽기" })).toHaveAttribute("aria-checked", "false");
  });

  it("starts with the selected part when the CTA is pressed", async () => {
    const { onStart } = setup();
    await userEvent.click(screen.getByRole("radio", { name: "읽기" }));
    await userEvent.click(screen.getByRole("button", { name: /시작할게요/ }));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith("reading");
  });

  it("defaults to listening on start when nothing is changed", async () => {
    const { onStart } = setup();
    await userEvent.click(screen.getByRole("button", { name: /시작할게요/ }));
    expect(onStart).toHaveBeenCalledWith("listening");
  });

  it("closing (X) calls onClose and never onStart", async () => {
    const { onClose, onStart } = setup();
    await userEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onStart).not.toHaveBeenCalled();
  });

  it("Escape closes without starting", async () => {
    const { onClose, onStart } = setup();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
    expect(onStart).not.toHaveBeenCalled();
  });

  it("renders nothing when closed", () => {
    const onClose = vi.fn();
    const onStart = vi.fn();
    render(<I18nProvider language="ko"><TopikPartSelectionModal open={false} onClose={onClose} onStart={onStart} /></I18nProvider>);
    expect(screen.queryByText("학습할 파트를 선택하세요")).not.toBeInTheDocument();
  });
});
