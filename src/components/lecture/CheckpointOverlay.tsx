import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { learnApi } from "../../api/endpoints";
import type { LectureCheckpoint } from "../../lib/types";
import { QuestionCard } from "./QuestionCard";
import { SpeakingCard } from "./SpeakingCard";

/** How long 완벽해요! stays up before the video carries on. */
export const PASS_HOLD_MS = 1200;

/**
 * The card a checkpoint opens over the paused video: a dim, blurred scrim
 * (COU-006..013) with the speaking card or the TOPIK question card.
 *
 * The design draws no close control, so the way out is the task itself — a
 * passed take or a correct answer's 다음 — plus a tap on the scrim (or
 * Escape) so a learner who cannot speak right now is never stuck. A
 * checkpoint whose sentence or question is gone closes straight away.
 */
export function CheckpointOverlay({
  lectureId,
  checkpoint,
  onClose,
}: {
  lectureId: string;
  checkpoint: LectureCheckpoint;
  onClose: () => void;
}) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const holdRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const interaction = useQuery({
    queryKey: ["lecture-checkpoint", lectureId, checkpoint.checkpoint_id],
    queryFn: () => learnApi.checkpointInteraction(lectureId, checkpoint.checkpoint_id),
    staleTime: Infinity,
    retry: false,
  });

  const data = interaction.data;
  const empty = interaction.isError || (!!data && !data.sentence && !data.question);
  useEffect(() => {
    if (empty) closeRef.current();
  }, [empty]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (holdRef.current) clearTimeout(holdRef.current);
    };
  }, []);

  return (
    <div
      className="overlay overlay--center lcp"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {!data ? (
        <span className="spinner" aria-hidden="true" />
      ) : data.sentence ? (
        <SpeakingCard
          sentence={data.sentence}
          onMicDeclined={onClose}
          onOutcome={(outcome) => {
            if (holdRef.current) clearTimeout(holdRef.current);
            holdRef.current = outcome === "correct" ? setTimeout(() => closeRef.current(), PASS_HOLD_MS) : null;
          }}
        />
      ) : data.question ? (
        <QuestionCard quiz={data.question} source="lecture" onDone={() => onClose()} />
      ) : null}
    </div>
  );
}
