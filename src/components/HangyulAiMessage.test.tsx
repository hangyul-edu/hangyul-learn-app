import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { HangyulAiMessage } from "./HangyulAiMessage";

describe("HangyulAiMessage (shared 한귤AI response)", () => {
  it("renders the avatar, default sender name, and bubble content", () => {
    const { container } = render(<HangyulAiMessage>무엇이든 물어보세요!</HangyulAiMessage>);
    expect(screen.getByText("한귤AI")).toBeInTheDocument();
    expect(screen.getByText("무엇이든 물어보세요!")).toBeInTheDocument();
    // avatar (aria-hidden) + bubble are present
    expect(container.querySelector(".askai__ai-face")).not.toBeNull();
    expect(container.querySelector(".askai__msg--ai")).not.toBeNull();
  });

  it("forwards a bubble class + aria-label (e.g. the typing state)", () => {
    const { container } = render(
      <HangyulAiMessage bubbleClassName="askai__msg--loading" bubbleAriaLabel="답변을 불러오는 중">
        <span />
      </HangyulAiMessage>,
    );
    const bubble = container.querySelector(".askai__msg--ai");
    expect(bubble).toHaveClass("askai__msg--loading");
    expect(bubble).toHaveAttribute("aria-label", "답변을 불러오는 중");
  });
});
