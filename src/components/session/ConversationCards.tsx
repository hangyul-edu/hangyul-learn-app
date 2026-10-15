import { SaveBookmarkButton } from "../SaveBookmarkButton";
import { useTranslation } from "../../i18n";
import { FillSentence, hasBlank } from "./FillSentence";
import { PronunciationPanel } from "./PronunciationPanel";
import icMic from "../../assets/brand/ic-session-mic.svg";
import icQuestion from "../../assets/brand/ic-question.svg";
import icAlert from "../../assets/brand/ic-24-alert.svg";
import type { SessionConversationCopy } from "../../lib/sessionConversationCopy";
import type { Sentence } from "../../lib/types";
import { Spinner } from "../ui/Spinner";

/** Whether the current item is bookmarked, and how to flip it. */
export type Bookmark = { saved: boolean; onToggle: () => void };

/** The two-step reveal: hint → full answer → gone. `stage` undefined means
 * untouched, so the chip offers a hint. */
export type HintControl = {
  stage: "hint" | "answer" | undefined;
  busy: boolean;
  disabled: boolean;
  onReveal: () => void;
};

/** Typing the answer into the blank, and switching between typing and speaking. */
export type AnswerInput = {
  keyboard: boolean;
  onToggleKeyboard: () => void;
  typed: string;
  onTyped: (value: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  composingRef: React.MutableRefObject<boolean>;
};

/** Speaking the answer. `scoring` covers the wait after a take is handed over. */
export type VoiceControl = {
  recording: boolean;
  scoring: boolean;
  onStart: () => void;
  onStop: () => void;
};

/** The item after a correct answer: the blue completed card and a locked mic.
 *
 * The mic stays visible (sharp behind the intermediate sheet, blurred behind
 * the final one) but disabled — an answered item is never evaluated twice. */
export function SolvedSentenceCard({
  sentence,
  bookmark,
}: {
  sentence: Sentence;
  bookmark: Bookmark;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className="sess__card sess__card--conv sess__card--correct">
        <div className="sess__card-top">
          <div className="sess__correct-head">
            <span className="sess__check">
              <span className="badge-check" aria-hidden="true" />
            </span>
            <span>{t("session.correctExclaim")}</span>
          </div>
          <SaveBookmarkButton
            saved={bookmark.saved}
            onToggle={bookmark.onToggle}
            label={t(
              bookmark.saved
                ? "sessionConversation.bookmarkUnsave"
                : "sessionConversation.bookmarkSave",
            )}
          />
        </div>
        <div
          className="sess__sentence sess__sentence--correct"
          role="status"
          aria-label={t("session.correctA11y", {
            korean: sentence.korean,
            translation: sentence.translation,
          })}
        >
          {sentence.korean}
        </div>
        <div className="sess__trans">{sentence.translation}</div>
      </div>

      <div className="sess__mic-wrap">
        <button className="sess__mic" disabled aria-label={t("session.alreadyDone")}>
          <img className="sess__mic-ic" src={icMic} alt="" aria-hidden="true" />
        </button>
      </div>
    </>
  );
}

/**
 * The item while it is still being answered — including after a wrong attempt.
 *
 * A wrong answer never advances the session, so no next/complete control
 * appears here: the incorrect header and (in voice mode) the pronunciation
 * panel report the result, and the same input stays available for an immediate
 * retry on the same sentence.
 */
export function AnswerSentenceCard({
  sentence,
  copy,
  incorrect,
  bookmark,
  hint,
  answer,
  voice,
  revealedText,
  pronunciation,
}: {
  sentence: Sentence;
  copy: SessionConversationCopy;
  incorrect: boolean;
  bookmark: Bookmark;
  hint: HintControl;
  answer: AnswerInput;
  voice: VoiceControl;
  /** The server-revealed prefix to show inside the blank, if any. */
  revealedText: string;
  /** Voice-only feedback; null in keyboard mode or after a correct answer. */
  pronunciation: { score: number; message: string } | null;
}) {
  const { t } = useTranslation();
  const typingIntoBlank = answer.keyboard && hasBlank(sentence);
  return (
    <>
      <div className={`sess__card sess__card--conv ${incorrect ? "sess__card--incorrect" : ""}`}>
        <div className="sess__card-top">
          {incorrect ? (
            <div className="sess__incorrect-head" role="status">
              <span className="sess__warn" aria-hidden="true">
                <img className="badge-warn" src={icAlert} alt="" aria-hidden="true" />
              </span>
              <span>{copy.incorrectStatus}</span>
            </div>
          ) : (
            <p className="sess__instr">{t("session.fillBlank")}</p>
          )}
          <SaveBookmarkButton
            saved={bookmark.saved}
            onToggle={bookmark.onToggle}
            label={bookmark.saved ? copy.bookmarkUnsave : copy.bookmarkSave}
          />
        </div>

        <FillSentence
          sentence={sentence}
          keyboard={typingIntoBlank}
          typed={answer.typed}
          onTyped={answer.onTyped}
          revealed={revealedText}
          onSubmit={answer.onSubmit}
          submitting={answer.submitting}
          composingRef={answer.composingRef}
        />
        {sentence.translation && <div className="sess__trans">{sentence.translation}</div>}

        {/* Non-blank sentences keep the romanization hint line; blanks reveal
            the hint inside the blank itself. */}
        {hint.stage != null && !hasBlank(sentence) && sentence.romanization && (
          <p className="sess__hint">💡 {sentence.romanization}</p>
        )}

        {/* Incorrect state: subtle divider below the sentence, then (voice
            only) the pronunciation feedback panel. */}
        {incorrect && <hr className="sess__divider" />}
        {pronunciation && (
          <PronunciationPanel
            score={pronunciation.score}
            message={pronunciation.message}
            copy={copy}
          />
        )}

        <div className="sess__card-actions">
          {hint.stage !== "answer" && (
            <button
              className={"sess__chip" + (hint.stage === "hint" ? " sess__chip--answer" : "")}
              onClick={hint.onReveal}
              disabled={hint.busy || hint.disabled}
              aria-busy={hint.busy}
            >
              <span className="sess__chip-q" aria-hidden="true">
                <img src={icQuestion} alt="" />
              </span>
              {hint.stage === "hint" ? copy.answer : copy.hint}
            </button>
          )}
          <button
            className="sess__chip"
            onClick={answer.onToggleKeyboard}
            aria-pressed={answer.keyboard}
            disabled={!hasBlank(sentence)}
          >
            {/* 2689:26087 — the mode chip is label-only in Figma. */}
            {answer.keyboard ? copy.voiceMode : copy.keyboardMode}
          </button>
        </div>
      </div>

      {/* Keyboard mode has no separate confirm button: the answer is submitted
          by the keyboard's action key (Enter on a physical keyboard, Go/이동 on
          a mobile keyboard) — see FillSentence's onKeyDown + enterKeyHint. */}
      {!typingIntoBlank && (
        <div className="sess__mic-wrap">
          {voice.recording ? (
            <button
              className="sess__mic is-rec"
              onClick={voice.onStop}
              aria-label={copy.stopRecordA11y}
            >
              ■
            </button>
          ) : (
            <button
              className="sess__mic"
              onClick={voice.onStart}
              disabled={voice.scoring}
              aria-label={incorrect ? copy.micRetryA11y : copy.recordA11y}
            >
              {voice.scoring ? (
                <Spinner size={26} />
              ) : (
                /* Group 33277 (673:10472) — disc, glyph and both shadows are
                   all inside this one export; nothing is redrawn here. */
                <img className="sess__mic-ic" src={icMic} alt="" aria-hidden="true" />
              )}
            </button>
          )}
        </div>
      )}
    </>
  );
}
