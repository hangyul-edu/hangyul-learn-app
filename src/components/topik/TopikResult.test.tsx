import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { TopikResult } from "./TopikResult";
import { buildTopikSessionCopy } from "../../lib/topikSessionCopy";
import { translate } from "../../i18n";
import type { QuizAttemptResult } from "../../lib/types";

/** Assertions below are written against the Korean design copy. */
const copy = buildTopikSessionCopy((k, v) => translate("ko", k, v));

function renderResult(result: QuizAttemptResult) {
  return render(<TopikResult result={result} copy={copy} />);
}

describe("TopikResult", () => {
  it("renders a writing score with suggestions, grammar feedback and corrected text", () => {
    renderResult({
      attempt_id: "a1",
      status: "graded",
      correct: null,
      writing: {
        score: 42,
        max_score: 50,
        grammar_issues: ["조사 '을/를' 사용을 확인하세요"],
        suggestions: ["문장을 더 짧게 나눠 보세요"],
        corrected_text: "고친 문장입니다.",
      },
    });
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("/ 50")).toBeInTheDocument();
    expect(screen.getByText(copy.suggestionsTitle)).toBeInTheDocument();
    expect(screen.getByText("문장을 더 짧게 나눠 보세요")).toBeInTheDocument();
    expect(screen.getByText(copy.grammarTitle)).toBeInTheDocument();
    expect(screen.getByText(copy.correctedTitle)).toBeInTheDocument();
    expect(screen.getByText("고친 문장입니다.")).toBeInTheDocument();
    // Writing is never mislabeled as "아쉬워요".
    expect(screen.queryByText(copy.incorrect)).not.toBeInTheDocument();
  });

  it("renders an awaiting-review state for a deferred writing submission", () => {
    renderResult({ attempt_id: "a2", status: "submitted", correct: null });
    expect(screen.getByText(copy.awaitingReview)).toBeInTheDocument();
  });

  it("renders a correct verdict for a selection question", () => {
    renderResult({ attempt_id: "a3", status: "graded", correct: true });
    expect(screen.getByText(copy.correct)).toBeInTheDocument();
  });

  it("renders an incorrect verdict with the representative answer", () => {
    renderResult({
      attempt_id: "a4",
      status: "graded",
      correct: false,
      correct_answer: "1",
      explanation: "'덕분에'가 정답입니다.",
    });
    expect(screen.getByText(new RegExp(copy.incorrect))).toBeInTheDocument();
    expect(screen.getByText(/정답: 1/)).toBeInTheDocument();
    expect(screen.getByText("'덕분에'가 정답입니다.")).toBeInTheDocument();
  });
});
