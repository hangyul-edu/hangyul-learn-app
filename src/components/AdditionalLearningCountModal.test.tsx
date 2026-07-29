import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdditionalLearningCountModal } from "./AdditionalLearningCountModal";

function setup(overrides: Partial<Parameters<typeof AdditionalLearningCountModal>[0]> = {}) {
  const onClose = vi.fn();
  const onStart = vi.fn();
  render(
    <AdditionalLearningCountModal
      open
      kind="conversation"
      onClose={onClose}
      onStart={onStart}
      {...overrides}
    />,
  );
  return { onClose, onStart };
}

const count = (n: number) => screen.getByRole("radio", { name: `${n}개` });

describe("AdditionalLearningCountModal", () => {
  it("does not render when closed", () => {
    const { container } = render(
      <AdditionalLearningCountModal open={false} kind="conversation" onClose={() => {}} onStart={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("defaults to 5 and offers 5/10/15/20", () => {
    setup();
    for (const n of [5, 10, 15, 20]) expect(count(n)).toBeInTheDocument();
    expect(count(5)).toHaveAttribute("aria-checked", "true");
    expect(count(10)).toHaveAttribute("aria-checked", "false");
  });

  it("selecting a count moves the single selection (radio, not checkbox)", async () => {
    setup();
    await userEvent.click(count(15));
    expect(count(15)).toHaveAttribute("aria-checked", "true");
    expect(count(5)).toHaveAttribute("aria-checked", "false");
    // exactly one selected
    expect(screen.getAllByRole("radio").filter((r) => r.getAttribute("aria-checked") === "true")).toHaveLength(1);
  });

  it("the selected option uses the orange selected class", async () => {
    setup();
    await userEvent.click(count(20));
    expect(count(20).className).toContain("addlearn__option--active");
    expect(count(5).className).not.toContain("addlearn__option--active");
  });

  it("Start passes the selected count to onStart", async () => {
    const { onStart } = setup();
    await userEvent.click(count(10));
    await userEvent.click(screen.getByRole("button", { name: /시작할게요/ }));
    expect(onStart).toHaveBeenCalledWith(10);
  });

  it("Start uses the default 5 without any selection", async () => {
    const { onStart } = setup();
    await userEvent.click(screen.getByRole("button", { name: /시작할게요/ }));
    expect(onStart).toHaveBeenCalledWith(5);
  });

  it("closing calls onClose and never creates a session", async () => {
    const { onClose, onStart } = setup();
    await userEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(onClose).toHaveBeenCalled();
    expect(onStart).not.toHaveBeenCalled();
  });

  it("Conversation copy asks for 문장; TOPIK asks for 문제", () => {
    const { unmount } = render(
      <AdditionalLearningCountModal open kind="conversation" onClose={() => {}} onStart={() => {}} />,
    );
    expect(screen.getByText(/추가할 문장 수를 선택해 주세요/)).toBeInTheDocument();
    unmount();
    render(<AdditionalLearningCountModal open kind="topik" onClose={() => {}} onStart={() => {}} />);
    expect(screen.getByText(/추가할 문제 수를 선택해 주세요/)).toBeInTheDocument();
  });

  it("while submitting the CTA is disabled and shows a spinner", () => {
    const { onStart } = setup({ submitting: true });
    const cta = screen.getByRole("button", { name: /학습 시작할게요/ });
    expect(cta).toBeDisabled();
    expect(cta.querySelector(".spinner")).not.toBeNull();
    // options are locked too
    expect(count(10)).toBeDisabled();
    expect(onStart).not.toHaveBeenCalled();
  });
});
