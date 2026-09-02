import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../../api/endpoints", () => ({
  quizApi: { audio: vi.fn().mockResolvedValue({ url: "http://x/a.mp3", duration_ms: 20000 }) },
}));

import { TopikQuestion, questionKind, canSubmitTopik } from "./TopikQuestion";
import type { AnswerValue } from "../QuestionView";
import { countTopikChars } from "../../lib/topikChars";
import { buildTopikSessionCopy } from "../../lib/topikSessionCopy";
import { I18nProvider, translate } from "../../i18n";
import type { AnswerFormat, Quiz } from "../../lib/types";

/** Assertions below are written against the Korean design copy. */
const copy = buildTopikSessionCopy((k, v) => translate("ko", k, v));

function makeQuiz(over: Partial<Quiz> & { answer?: Partial<Quiz["answer"]> }): Quiz {
  return {
    quiz_id: "q",
    prompt: "문제",
    level: 3,
    material: { kind: "text", html: null, image_url: null, audio: null },
    ...over,
    answer: {
      format: "single_choice",
      choices: [],
      blanks: [],
      ...(over.answer ?? {}),
    },
  } as Quiz;
}

const READING = makeQuiz({
  question_type: "reading_multiple_choice",
  prompt: "(   )에 들어갈 말로 가장 알맞은 것을 고르십시오.",
  answer: {
    format: "single_choice",
    choices: [
      { key: "1", text: "덕분에" },
      { key: "2", text: "동안" },
      { key: "3", text: "처럼" },
      { key: "4", text: "만큼" },
    ],
    blanks: [],
  },
});

const LISTENING = makeQuiz({
  question_type: "listening_multiple_choice",
  material: { kind: "audio", html: null, image_url: null, audio: null },
  answer: {
    format: "single_choice",
    choices: [
      { key: "1", text: "가" },
      { key: "2", text: "나" },
      { key: "3", text: "다" },
      { key: "4", text: "라" },
    ],
    blanks: [],
  },
});

const FILL = makeQuiz({
  question_type: "writing_fill_blanks",
  material: { kind: "text", html: "<p>바다가 보이는 방으로 ( ㄱ ). 연락처로 ( ㄴ ).</p>", image_url: null, audio: null },
  answer: { format: "short_answer", choices: [], blanks: [{ label: "ㄱ" }, { label: "ㄴ" }] },
});

const ESSAY = makeQuiz({
  question_type: "writing_opinion_essay",
  answer: { format: "free_response", choices: [], blanks: [], min_length: 600, max_length: 700 },
});

/** Controlled wrapper so interactions update the rendered value. */
function Harness({ quiz, initial = {} }: { quiz: Quiz; initial?: AnswerValue }) {
  const [value, setValue] = useState<AnswerValue>(initial);
  return (
    <I18nProvider language="ko">
      <TopikQuestion quiz={quiz} value={value} onChange={setValue} copy={copy} />
    </I18nProvider>
  );
}

describe("questionKind", () => {
  it("uses the server question_type", () => {
    expect(questionKind(READING)).toBe("reading_multiple_choice");
    expect(questionKind(LISTENING)).toBe("listening_multiple_choice");
    expect(questionKind(FILL)).toBe("writing_fill_blanks");
  });

  it("falls back to deriving from the answer/material dimensions", () => {
    const noType = makeQuiz({
      material: { kind: "audio", html: null, image_url: null, audio: null },
      answer: { format: "single_choice", choices: [{ key: "1", text: "a" }], blanks: [] },
    });
    expect(questionKind(noType)).toBe("listening_multiple_choice");
  });

  it("returns unsupported for an unknown shape", () => {
    const weird = makeQuiz({
      question_type: "future_type" as Quiz["question_type"],
      answer: { format: "mystery" as AnswerFormat, choices: [], blanks: [] },
    });
    expect(questionKind(weird)).toBe("unsupported");
  });
});

describe("canSubmitTopik", () => {
  it("multiple choice needs exactly one selection", () => {
    expect(canSubmitTopik(READING, {})).toBe(false);
    expect(canSubmitTopik(READING, { choiceKey: "1" })).toBe(true);
  });

  it("fill-blanks needs every blank filled", () => {
    expect(canSubmitTopik(FILL, { blanks: ["답", ""] })).toBe(false);
    expect(canSubmitTopik(FILL, { blanks: ["답", "답"] })).toBe(true);
    expect(canSubmitTopik(FILL, { blanks: ["답", "   "] })).toBe(false);
  });

  it("writing must be within [min, max]", () => {
    expect(canSubmitTopik(ESSAY, { text: "가".repeat(599) })).toBe(false);
    expect(canSubmitTopik(ESSAY, { text: "가".repeat(600) })).toBe(true);
    expect(canSubmitTopik(ESSAY, { text: "가".repeat(700) })).toBe(true);
    expect(canSubmitTopik(ESSAY, { text: "가".repeat(701) })).toBe(false);
  });
});

describe("TopikQuestion rendering", () => {
  it("renders reading options as a radio group with the instruction", () => {
    render(<Harness quiz={READING} />);
    expect(screen.getByText(/가장 알맞은 것을 고르십시오/)).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(4);
    expect(screen.getByText("덕분에")).toBeInTheDocument();
  });

  it("selects exactly one option and reflects it in aria-checked", async () => {
    render(<Harness quiz={READING} />);
    const radios = screen.getAllByRole("radio");
    await userEvent.click(radios[0]);
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
    await userEvent.click(radios[2]);
    expect(radios[0]).toHaveAttribute("aria-checked", "false");
    expect(radios[2]).toHaveAttribute("aria-checked", "true");
  });

  it("renders one editable input per blank, both independently editable", async () => {
    render(<Harness quiz={FILL} />);
    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(2);
    await userEvent.type(inputs[0], "바꿔");
    await userEvent.type(inputs[1], "알려");
    expect(inputs[0]).toHaveValue("바꿔");
    expect(inputs[1]).toHaveValue("알려");
  });

  it("renders a writing textarea with a live character counter", async () => {
    render(<Harness quiz={ESSAY} />);
    expect(screen.getByText("0/700")).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox"), "안녕하세요");
    expect(screen.getByText("5/700")).toBeInTheDocument();
  });

  it("renders the listening audio player with a play control", () => {
    render(<Harness quiz={LISTENING} />);
    expect(screen.getByRole("button", { name: copy.audioPlay })).toBeInTheDocument();
    expect(screen.getByText("Track 1")).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
  });

  it("shows a safe unsupported state for an unknown type", () => {
    const weird = makeQuiz({
      question_type: "future_type" as Quiz["question_type"],
      answer: { format: "mystery" as AnswerFormat, choices: [], blanks: [] },
    });
    render(<Harness quiz={weird} />);
    expect(screen.getByRole("alert")).toHaveTextContent(copy.unsupported);
  });
});

describe("countTopikChars", () => {
  it("counts Korean, spaces, punctuation and newlines as one each", () => {
    expect(countTopikChars("안녕 하세요!")).toBe(7);
    expect(countTopikChars("a\r\nb")).toBe(3); // CRLF normalized to one \n
  });
});
