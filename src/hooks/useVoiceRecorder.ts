import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_RECORDING_MS, pickRecordingMimeType, recordingFilename, type RecordingInfo } from "../lib/recording";

/**
 * Microphone capture for the speaking screens.
 *
 * Owns only the MediaRecorder lifecycle — permission, chunk collection, and
 * releasing the microphone. What happens to the recording afterwards (grading
 * a speech attempt, filling in a blank) is the caller's business, which is why
 * the audio arrives through `onRecorded` rather than this hook knowing about
 * attempts.
 *
 * A take ends in exactly one of two ways:
 *
 * * **Finished** — `stop()` was called (or the take reached `maxDurationMs`),
 *   so the audio goes to `onRecorded` and the microphone is released.
 * * **Abandoned** — the screen unmounted mid-take. The microphone is released
 *   just the same, but `onRecorded` never fires: nobody is left to show the
 *   result, and grading a recording the learner walked away from would credit
 *   an attempt they never submitted.
 *
 * Releasing is idempotent, so the two cannot fight over a take that finishes
 * at the same moment its screen goes away.
 */
export type VoiceRecorder = {
  /** True between `start()` and the moment the take is handed to `onRecorded`. */
  recording: boolean;
  /** Ask for the microphone and begin a take. */
  start: () => Promise<void>;
  /** End the take; `onRecorded` receives the audio. */
  stop: () => void;
};

export type VoiceRecorderOptions = {
  /**
   * The finished take. `audio` is labelled with the format the browser really
   * recorded (WebM, Ogg or Safari's MP4); upload it under `take.filename`.
   */
  onRecorded: (audio: Blob, take: RecordingInfo) => void | Promise<void>;
  /**
   * The microphone cannot be used: permission refused, no device, or the
   * recorder failed to start. All three leave the learner unable to record,
   * so they are reported the same way.
   */
  onUnavailable: () => void;
  /** The take stops itself after this long (the server's limit by default). */
  maxDurationMs?: number;
};

/** A take in progress, and the one function that ends it. */
type ActiveTake = {
  recorder: MediaRecorder;
  /** Stops the recorder and releases the microphone. Safe to call twice. */
  release: () => void;
};

export function useVoiceRecorder({
  onRecorded,
  onUnavailable,
  maxDurationMs = MAX_RECORDING_MS,
}: VoiceRecorderOptions): VoiceRecorder {
  const [recording, setRecording] = useState(false);
  const takeRef = useRef<ActiveTake | null>(null);
  const openingRef = useRef(false);
  const mountedRef = useRef(true);
  // Callbacks are read when the take ends, so a re-render never leaves it
  // holding a stale closure over the screen's state.
  const handlers = useRef({ onRecorded, onUnavailable });
  handlers.current = { onRecorded, onUnavailable };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      // The screen is going away: drop the take on the floor, but never leave
      // the microphone open behind it.
      mountedRef.current = false;
      takeRef.current?.release();
      takeRef.current = null;
    };
  }, []);

  const start = useCallback(async () => {
    // A take is already running, or its permission prompt is still up.
    if (takeRef.current || openingRef.current) return;
    openingRef.current = true;
    let stream: MediaStream | null;
    try {
      stream = await openMicrophone();
    } finally {
      openingRef.current = false;
    }
    if (stream === null) {
      if (mountedRef.current) handlers.current.onUnavailable();
      return;
    }
    // The permission prompt is asynchronous, so the screen may already be
    // gone by the time it is answered. Hand the microphone straight back.
    if (!mountedRef.current) {
      releaseStream(stream);
      return;
    }

    const chunks: Blob[] = [];
    let recorder: MediaRecorder;
    let startedAt = 0;
    try {
      const preferred = pickRecordingMimeType();
      recorder = preferred ? new MediaRecorder(stream, { mimeType: preferred }) : new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onstop = () => {
        const finished = takeRef.current;
        takeRef.current = null;
        finished?.release();
        if (!mountedRef.current) return; // abandoned — no result to deliver
        setRecording(false);
        // The recorder's own type is the truth (Safari records MP4 whatever
        // was preferred); the chunks' type is the fallback, then WebM.
        const type = recorder.mimeType || chunks[0]?.type || preferred || "audio/webm";
        const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
        void handlers.current.onRecorded(new Blob(chunks, { type }), {
          filename: recordingFilename(type),
          durationMs,
        });
      };
      recorder.start();
      startedAt = performance.now();
    } catch {
      // Unsupported format, or a device that disappeared between the
      // permission grant and the first byte.
      releaseStream(stream);
      if (mountedRef.current) handlers.current.onUnavailable();
      return;
    }

    // A take the learner forgets to stop ends at the server's limit and is
    // delivered as usual, instead of growing into an upload that is refused.
    const autoStop = setTimeout(() => stopRecorder(recorder), maxDurationMs);
    takeRef.current = {
      recorder,
      release: releaseOnce(() => {
        clearTimeout(autoStop);
        recorder.ondataavailable = null;
        recorder.onstop = null;
        stopRecorder(recorder);
        releaseStream(stream);
      }),
    };
    setRecording(true);
  }, [maxDurationMs]);

  const stop = useCallback(() => {
    const take = takeRef.current;
    if (!take) return; // nothing running — stopping twice is harmless
    stopRecorder(take.recorder);
  }, []);

  return { recording, start, stop };
}

async function openMicrophone(): Promise<MediaStream | null> {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    return null;
  }
}

/** Stop a recorder that is still running; ignore one that already stopped. */
function stopRecorder(recorder: MediaRecorder): void {
  try {
    if (recorder.state !== "inactive") recorder.stop();
  } catch {
    /* already stopped — nothing to do */
  }
}

/** Hand the microphone back to the browser, so the recording indicator clears. */
function releaseStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      /* already stopped */
    }
  }
}

function releaseOnce(release: () => void): () => void {
  let released = false;
  return () => {
    if (released) return;
    released = true;
    release();
  };
}
