import { useCallback, useRef, useState } from "react";

/**
 * Microphone capture for the speaking screens.
 *
 * Owns only the MediaRecorder lifecycle — permission, chunk collection, and
 * releasing the microphone when the take ends. What happens to the recording
 * afterwards (grading a speech attempt, filling in a blank) is the caller's
 * business, which is why the audio arrives through `onRecorded` rather than
 * this hook knowing about attempts.
 *
 * The microphone track is released when the take ends. A screen unmounted
 * mid-take does not release it — that matches the inline recorders this hook
 * replaced, and is left alone deliberately rather than changed here.
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
  onRecorded: (audio: Blob) => void | Promise<void>;
  /** The user refused the microphone, or the device has none. */
  onPermissionDenied: () => void;
  /** Defaults to `audio/webm`, which is what the API expects. */
  mimeType?: string;
};

export function useVoiceRecorder({
  onRecorded,
  onPermissionDenied,
  mimeType = "audio/webm",
}: VoiceRecorderOptions): VoiceRecorder {
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // Callbacks are read at stop time, so a re-render never leaves the take
  // holding a stale closure over the screen's state.
  const handlers = useRef({ onRecorded, onPermissionDenied });
  handlers.current = { onRecorded, onPermissionDenied };

  const start = useCallback(async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      handlers.current.onPermissionDenied();
      return;
    }
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      setRecording(false);
      void handlers.current.onRecorded(new Blob(chunksRef.current, { type: mimeType }));
    };
    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
  }, [mimeType]);

  const stop = useCallback(() => recorderRef.current?.stop(), []);

  return { recording, start, stop };
}
