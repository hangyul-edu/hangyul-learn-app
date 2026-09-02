import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CorrectAnswerSheet } from "./CorrectAnswerSheet";
import { I18nProvider } from "../i18n";

function setup(mode: "next" | "complete", over = {}) {
  const onRetry = vi.fn();
  const onNext = vi.fn();
  const onComplete = vi.fn();
  const utils = render(
    <I18nProvider language="ko">
      <CorrectAnswerSheet mode={mode} onRetry={onRetry} onNext={onNext} onComplete={onComplete} {...over} />
    </I18nProvider>,);
  return { onRetry, onNext, onComplete, ...utils };
}

describe("CorrectAnswerSheet", () => {
  it("intermediate mode shows 다시 시작 + 다음, no 완료, and NO scrim", () => {
    const { container } = setup("next");
    expect(screen.getByRole("button", { name: "다시 시작" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다음 문제로" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "학습 완료" })).not.toBeInTheDocument();
    expect(container.querySelector(".casheet__scrim")).not.toBeInTheDocument();
  });

  it("complete mode shows 다시 시작 + 완료, no 다음, and DOES mount the dim scrim", () => {
    const { container } = setup("complete");
    expect(screen.getByRole("button", { name: "다시 시작" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "학습 완료" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "다음 문제로" })).not.toBeInTheDocument();
    expect(container.querySelector(".casheet__scrim")).toBeInTheDocument();
    // The sheet itself is not inside the scrim (stays sharp).
    expect(container.querySelector(".casheet__scrim .casheet")).not.toBeInTheDocument();
  });

  it("wires the button actions", async () => {
    const { onRetry, onNext } = setup("next");
    await userEvent.click(screen.getByRole("button", { name: "다시 시작" }));
    await userEvent.click(screen.getByRole("button", { name: "다음 문제로" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("has no 다시 듣기 anywhere — the left tile retries, it never replays audio", () => {
    setup("next");
    expect(screen.queryByRole("button", { name: "다시 듣기" })).not.toBeInTheDocument();
    setup("complete");
    expect(screen.queryByRole("button", { name: "다시 듣기" })).not.toBeInTheDocument();
  });

  it("완료 triggers completion", async () => {
    const { onComplete } = setup("complete");
    await userEvent.click(screen.getByRole("button", { name: "학습 완료" }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("disables the primary button while busy", () => {
    setup("next", { advancing: true });
    expect(screen.getByRole("button", { name: "다음 문제로" })).toBeDisabled();
    setup("complete", { completing: true });
    expect(screen.getByRole("button", { name: "학습 완료" })).toBeDisabled();
  });
});
