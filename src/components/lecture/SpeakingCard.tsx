import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "../../i18n";
import { sentenceApi } from "../../api/endpoints";
import { useToast } from "../../hooks/toast";
import { useSpeechInput } from "../../hooks/useSpeechInput";
import { errorMessage } from "../../lib/http";
import { needsRetake, speechErrorMessage } from "../../lib/recording";
import { isUnrelatedSpeech } from "../../lib/speech";
import { resolveMessage } from "../../i18n/current";
import { SaveBookmarkButton } from "../SaveBookmarkButton";
import type { Sentence } from "../../lib/types";
import { Button } from "../ui/kit";
import icSpeaker from "../../assets/brand/ic-speaker-pill.svg";
import icAlert from "../../assets/brand/ic-24-alert.svg";
import icRetry from "../../assets/brand/ic-24-retry.svg";
import icChevron from "../../assets/brand/ic-card-chevron.svg";
import { playOn, unlockedAudio } from "../../lib/unlockedAudio";

/**
 * `error` — the take could not be graded (the server or the network failed):
 * not a wrong reading, so it never counts against the learner; the card asks
 * to try again.
 */
export type SpeakingOutcome = "prompt" | "correct" | "wrong" | "error";

/**
 * How long a take listens before it is graded: long enough to read the
 * sentence aloud at a learner's pace, never so long the card feels stuck.
 */
export function listenWindowMs(korean: string): number {
  const syllables = korean.replace(/\s/g, "").length;
  return Math.min(8000, Math.max(2500, 1500 + syllables * 350));
}

/**
 * The sentence's type size. Figma draws a short phrase at Bold 36, which fits
 * about seven syllables a line in the card; longer sentences step down so
 * they stay within three or four lines rather than filling the card.
 */
export function koreanSize(korean: string): "lg" | "md" | "sm" | "xs" {
  const syllables = korean.replace(/\s/g, "").length;
  if (syllables <= 12) return "lg";
  if (syllables <= 24) return "md";
  if (syllables <= 40) return "sm";
  return "xs";
}

/**
 * The repeat-after-me card — in a lecture (COU-006 1:2570, perfect COU-007
 * 1:2620, try again COU-008 1:2676) and in the standalone speaking practice
 * (COU-014/015/016).
 *
 * The design draws no mic button: the card listens on its own as soon as it
 * shows, grades the take, and turns blue (완벽해요!) or red (다시 한 번
 * 말해보세요!). 다시하기 listens again. The speaker pill plays the model
 * audio; a take in progress is dropped while it plays and starts afresh
 * after. When the microphone cannot be used the card asks for it with the
 * permission modal drawn beside COU-007 (1565:25050).
 */
export function SpeakingCard({
  sentence,
  onOutcome,
  onMicDeclined,
  prev,
  next,
}: {
  sentence: Sentence;
  onOutcome?: (outcome: SpeakingOutcome) => void;
  /** 닫기 on the permission modal — the learner chose not to speak. */
  onMicDeclined: () => void;
  /** COU-015's ‹ › arrows, standalone practice only. */
  prev?: () => void;
  next?: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [outcome, setOutcome] = useState<SpeakingOutcome>("prompt");
  const [unrelated, setUnrelated] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [micBlocked, setMicBlocked] = useState(false);
  const [saved, setSaved] = useState(!!sentence.bookmarked);
  const discardRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sentenceRef = useRef(sentence);
  sentenceRef.current = sentence;
  const outcomeRef = useRef(onOutcome);
  outcomeRef.current = onOutcome;

  const settle = useCallback((next: SpeakingOutcome) => {
    setOutcome(next);
    outcomeRef.current?.(next);
  }, []);

  const recorder = useSpeechInput({
    purpose: "sentence",
    context: { sentence_id: sentence.sentence_id, source: "lecture" },
    onSpoken: async (spoken) => {
      if (discardRef.current) {
        discardRef.current = false;
        return;
      }
      setScoring(true);
      try {
        const take = sentenceRef.current;
        // The server grades what was said — the live transcript by id, or
        // the recording it transcribes — never the fact that audio arrived.
        const attempt = await sentenceApi.speechAttempt(
          take.sentence_id,
          spoken.transcript ?? spoken.audio,
          spoken.take,
          "lecture",
        );
        if (take.sentence_id !== sentenceRef.current.sentence_id) return;
        setUnrelated(!attempt.correct && isUnrelatedSpeech(attempt.feedback_code));
        settle(attempt.correct ? "correct" : "wrong");
      } catch (e) {
        toast.error(speechErrorMessage(e));
        // Silence or an unreadable take was not graded: let them record again.
        // A failed grading (server / network) is not a wrong reading either.
        if (!needsRetake(e)) settle("error");
      } finally {
        setScoring(false);
      }
    },
    onNothingHeard: () => toast.error(resolveMessage("speechError.noSpeech")),
    onFailed: () => {
      toast.error(t("sessionConversation.evaluationError"));
      settle("error");
    },
    onUnavailable: () => setMicBlocked(true),
  });
  const recorderRef = useRef(recorder);
  recorderRef.current = recorder;

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const listen = useCallback(async () => {
    clearTimer();
    setMicBlocked(false);
    await recorderRef.current.start();
    timerRef.current = setTimeout(() => recorderRef.current.stop(), listenWindowMs(sentenceRef.current.korean));
  }, []);

  // Each new sentence starts fresh and listens straight away.
  useEffect(() => {
    setOutcome("prompt");
    setUnrelated(false);
    setSaved(!!sentence.bookmarked);
    void listen();
    return () => {
      clearTimer();
      audioRef.current?.pause();
    };
  }, [sentence, listen]);

  async function playModel() {
    if (recorderRef.current.recording) {
      discardRef.current = true;
      clearTimer();
      recorderRef.current.stop();
    }
    // Unlocked inside the tap, before the URL fetch (iOS).
    const audio = unlockedAudio();
    try {
      const { url } = await sentenceApi.audio(sentence.sentence_id);
      audioRef.current?.pause();
      audioRef.current = audio;
      audio.onended = () => {
        if (outcome === "prompt") void listen();
      };
      await playOn(audio, url);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  function retry() {
    setUnrelated(false);
    setOutcome("prompt");
    outcomeRef.current?.("prompt");
    void listen();
  }

  async function toggleSave() {
    const nextSaved = !saved;
    setSaved(nextSaved);
    try {
      await (nextSaved ? sentenceApi.bookmark(sentence.sentence_id) : sentenceApi.unbookmark(sentence.sentence_id));
    } catch (e) {
      setSaved(!nextSaved);
      toast.error(errorMessage(e));
    }
  }

  const title = t(
    outcome === "correct"
      ? "courses.speakPerfect"
      : outcome === "wrong"
        ? "courses.speakAgain"
        : outcome === "error"
          ? "courses.speakError"
          : "courses.speakPrompt",
  );

  return (
    <div className={`lspk lspk--${outcome === "error" ? "wrong" : outcome}`} role="group" aria-label={title}>
      <div className="lspk__head">
        <h2 className="lspk__title">{title}</h2>
        <SaveBookmarkButton
          saved={saved}
          onToggle={() => void toggleSave()}
          label={t(saved ? "courses.unsaveSentence" : "courses.saveSentence")}
        />
      </div>

      {/* Held to the screen over a lecture, this middle part scrolls when a
          long sentence and its romanization outgrow the card. */}
      <div className="lspk__scroll">
      <div className="lspk__glyph">
        {outcome === "prompt" ? (
          <button
            className={`lspk__speaker ${recorder.recording ? "is-listening" : ""}`}
            onClick={() => void playModel()}
            aria-label={t("courses.listenA11y")}
          >
            <img src={icSpeaker} alt="" aria-hidden="true" width={25} height={17.76} />
          </button>
        ) : outcome === "correct" ? (
          <span className="badge-check lspk__badge" aria-hidden="true" />
        ) : (
          <img className="lspk__badge" src={icAlert} alt="" aria-hidden="true" width={36} height={36} />
        )}
      </div>

      <div className="lspk__sentence-row">
        {prev ? (
          <button className="lspk__arrow lspk__arrow--prev" onClick={prev} aria-label={t("courses.prevSentence")}>
            <img src={icChevron} alt="" aria-hidden="true" />
          </button>
        ) : (
          <span className="lspk__arrow" aria-hidden="true" />
        )}
        <p className={`lspk__korean lspk__korean--${koreanSize(sentence.korean)}`} lang="ko">
          {sentence.korean}
        </p>
        {next ? (
          <button className="lspk__arrow" onClick={next} aria-label={t("courses.nextSentence")}>
            <img src={icChevron} alt="" aria-hidden="true" />
          </button>
        ) : (
          <span className="lspk__arrow" aria-hidden="true" />
        )}
      </div>
      {sentence.romanization && <p className="lspk__roman">[{sentence.romanization}]</p>}
      <p className="lspk__trans">{sentence.translation}</p>
      {outcome === "wrong" && unrelated && <p className="lspk__note">{t("courses.speakUnrelated")}</p>}
      </div>

      {outcome !== "prompt" && (
        <button className="lspk__retry" onClick={retry}>
          <img src={icRetry} alt="" aria-hidden="true" width={19} height={20} />
          {t("courses.speakRetry")}
        </button>
      )}

      <p className="sr-only" aria-live="polite">
        {scoring || recorder.phase === "processing"
          ? t("courses.scoringA11y")
          : recorder.recording
            ? t("courses.listeningA11y")
            : ""}
      </p>

      {micBlocked && (
        <div className="overlay overlay--center lspk__mic" role="presentation">
          <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="lspk-mic-title">
            <div className="dialog__title" id="lspk-mic-title">{t("courses.micTitle")}</div>
            <div className="dialog__text">{t("courses.micText")}</div>
            <div className="dialog__actions">
              <Button variant="ghost" block onClick={onMicDeclined}>
                {t("courses.micClose")}
              </Button>
              <Button variant="primary" block onClick={() => void listen()}>
                {t("courses.micAllow")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
