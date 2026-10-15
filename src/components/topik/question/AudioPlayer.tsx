import { useEffect, useRef, useState } from "react";
import { quizApi } from "../../../api/endpoints";
import type { TopikSessionCopy } from "../../../lib/topikSessionCopy";
import type { Quiz } from "../../../lib/types";
import { Spinner } from "../../ui/Spinner";

function fmtTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Listening audio: fetches a signed URL lazily on first play, exposes
 * play/pause + a track label + time, and surfaces a retryable error. Selection
 * state lives above this component, so playback never disturbs the answer. */
export function AudioPlayer({
  quiz,
  copy,
  tone = "neutral",
  done,
}: {
  quiz: Quiz;
  copy: TopikSessionCopy;
  tone?: "neutral" | "incorrect";
  /** Answered correctly — TAL-021 drops the warm ground for a neutral grey. */
  done?: boolean;
}) {
  // Duration isn't in the list payload; it's learned from the audio endpoint or
  // the element's loadedmetadata event.
  const [state, setState] = useState<"idle" | "loading" | "playing" | "paused" | "error">("idle");
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const elRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(quiz.material.audio?.url ?? null);

  // Pause + release on unmount / question switch so audio never bleeds across items.
  useEffect(() => {
    return () => {
      elRef.current?.pause();
      elRef.current = null;
    };
  }, []);

  async function ensureEl(): Promise<HTMLAudioElement> {
    if (!urlRef.current) {
      const res = await quizApi.audio(quiz.quiz_id);
      urlRef.current = res.url;
      if (res.duration_ms) setDur(res.duration_ms / 1000);
    }
    if (!elRef.current) {
      const el = new Audio(urlRef.current);
      el.ontimeupdate = () => setPos(el.currentTime);
      el.onloadedmetadata = () => setDur(el.duration);
      el.onended = () => {
        setState("paused");
        setPos(0);
      };
      el.onerror = () => setState("error");
      elRef.current = el;
    }
    return elRef.current;
  }

  async function toggle() {
    try {
      if (state === "playing") {
        elRef.current?.pause();
        setState("paused");
        return;
      }
      setState("loading");
      const el = await ensureEl();
      await el.play();
      setState("playing");
    } catch {
      setState("error");
    }
  }

  const label =
    state === "loading" ? copy.audioLoading : state === "playing" ? copy.audioPause : copy.audioPlay;

  return (
    <div className={`tq-audio ${tone === "incorrect" ? "tq-audio--incorrect" : ""} ${done ? "tq-audio--done" : ""}`}>
      <button
        type="button"
        className={`tq-audio__play ${state === "playing" ? "is-playing" : ""}`}
        onClick={toggle}
        disabled={state === "loading"}
        aria-label={label}
      >
        {state === "loading" ? (
          <Spinner size={24} stroke={2.5} />
        ) : state === "playing" ? (
          <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1.2" fill="#fff" />
            <rect x="14" y="5" width="4" height="14" rx="1.2" fill="#fff" />
          </svg>
        ) : (
          <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5.5v13l11-6.5-11-6.5z" fill="#fff" />
          </svg>
        )}
      </button>
      <div className="tq-audio__meta">
        <span className="tq-audio__label">{copy.audioTrack}</span>
        <span className="tq-audio__time">
          {fmtTime(pos)} / {fmtTime(dur)}
        </span>
        {state === "error" && <span className="tq-audio__error">{copy.audioError}</span>}
      </div>
    </div>
  );
}
