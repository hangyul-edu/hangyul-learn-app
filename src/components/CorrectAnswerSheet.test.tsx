import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CorrectAnswerSheet } from "./CorrectAnswerSheet";

function setup(mode: "next" | "complete", over = {}) {
  const onReplay = vi.fn();
  const onNext = vi.fn();
  const onComplete = vi.fn();
  const utils = render(
    <CorrectAnswerSheet mode={mode} onReplay={onReplay} onNext={onNext} onComplete={onComplete} {...over} />,
  );
  return { onReplay, onNext, onComplete, ...utils };
}

describe("CorrectAnswerSheet", () => {
  it("intermediate mode shows 다시 듣기 + 다음, no 완료, and NO blur scrim", () => {
    const { container } = setup("next");
    expect(screen.getByRole("button", { name: "다시 듣기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다음 문제로" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "학습 완료" })).not.toBeInTheDocument();
    expect(container.querySelector(".casheet__scrim")).not.toBeInTheDocument();
  });

  it("complete mode shows 다시 듣기 + 완료, no 다음, and DOES mount the blur scrim", () => {
    const { container } = setup("complete");
    expect(screen.getByRole("button", { name: "다시 듣기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "학습 완료" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "다음 문제로" })).not.toBeInTheDocument();
    expect(container.querySelector(".casheet__scrim")).toBeInTheDocument();
    // The sheet itself is not inside the scrim (stays sharp).
    expect(container.querySelector(".casheet__scrim .casheet")).not.toBeInTheDocument();
  });

  it("wires the button actions", async () => {
    const { onReplay, onNext } = setup("next");
    await userEvent.click(screen.getByRole("button", { name: "다시 듣기" }));
    await userEvent.click(screen.getByRole("button", { name: "다음 문제로" }));
    expect(onReplay).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("완료 triggers completion", async () => {
    const { onComplete } = setup("complete");
    await userEvent.click(screen.getByRole("button", { name: "학습 완료" }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("disables 다시 듣기 while replaying", () => {
    setup("next", { replaying: true });
    expect(screen.getByRole("button", { name: "다시 듣기" })).toBeDisabled();
  });

  it("disables the primary button while busy", () => {
    setup("next", { advancing: true });
    expect(screen.getByRole("button", { name: "다음 문제로" })).toBeDisabled();
    setup("complete", { completing: true });
    expect(screen.getByRole("button", { name: "학습 완료" })).toBeDisabled();
  });
});
