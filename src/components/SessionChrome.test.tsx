import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { SessionChrome } from "./SessionChrome";

function renderChrome(minimal: boolean) {
  return render(
    <MemoryRouter>
      <SessionChrome
        title="저장한 문제"
        heading="목표 하루 학습 문제"
        panel={<div>AI PANEL</div>}
        progress={0.5}
        total={5}
        correct={2}
        askContext={null}
        minimal={minimal}
      >
        <div>CARD</div>
      </SessionChrome>
    </MemoryRouter>,
  );
}

describe("SessionChrome — review (minimal) mode", () => {
  it("normal mode renders the progress bar, counter, and AI panel", () => {
    renderChrome(false);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByText("2/5")).toBeInTheDocument();
    expect(screen.getByText("AI PANEL")).toBeInTheDocument();
  });

  it("minimal mode hides the progress bar, counter, and AI panel but keeps title + content", () => {
    renderChrome(true);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByText("2/5")).not.toBeInTheDocument();
    expect(screen.queryByText("목표 하루 학습 문제")).not.toBeInTheDocument();
    expect(screen.queryByText("AI PANEL")).not.toBeInTheDocument();
    expect(screen.getByText("저장한 문제")).toBeInTheDocument();
    expect(screen.getByText("CARD")).toBeInTheDocument();
  });
});
