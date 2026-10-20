/**
 * What a spoken answer is, as far as submitting it goes.
 *
 * A take reaches the server one of two ways:
 *
 * * **Realtime** — the microphone was streamed into a LiveKit room, the STT
 *   agent segmented the speech (Silero VAD) and transcribed it, and the API
 *   stored the transcript. The app holds only its `transcriptId`: the answer
 *   endpoints grade the stored transcript by id, never text the app sends.
 * * **Upload** — the take was recorded with MediaRecorder and is uploaded as
 *   audio for the server to transcribe (the fallback when the realtime path
 *   is off or unreachable).
 *
 * Either way the server decides correctness from what was said; the app only
 * carries the take.
 */
import type { RecordingInfo } from "./recording";

/** What the STT agent heard in one take of this learner's live session. */
export type SpokenTranscript = {
  /** The stored transcripts of the take, in the order spoken (one per utterance). */
  transcriptIds: string[];
  /** What was heard, for display only — never submitted as the answer. */
  text: string;
  status: "ok" | "no_speech" | "failed";
  /** End of speech → transcript ready, as measured by the agent. */
  latencyMs: number;
  provider: string;
  model?: string;
};

/** One finished take: a live transcript, or a recording to upload. */
export type SpokenTake =
  | { transcript: SpokenTranscript; audio?: undefined; take?: undefined }
  | { audio: Blob; take: RecordingInfo; transcript?: undefined };

export function isTranscript(spoken: Blob | SpokenTranscript): spoken is SpokenTranscript {
  return !(spoken instanceof Blob) && Array.isArray((spoken as SpokenTranscript).transcriptIds);
}

/**
 * Messages the STT agent publishes on the session's data topic. `vad` says
 * whether the learner is being heard; `transcript` is the result of one
 * utterance (`transcript_id` is null when the agent could not store it);
 * `stopped` answers the app's `stop` once everything heard before it has
 * been reported (`in_flight`: utterances still being transcribed).
 */
export type SpeechAgentMessage =
  | { type: "vad"; state: "speaking" | "silence"; speech_ms?: number }
  | { type: "stopped"; in_flight: number }
  | { type: "vad_level"; probability: number; speaking: boolean }
  | { type: "transcribing"; utterance_id: string; audio_duration_ms: number }
  | {
      type: "transcript";
      utterance_id: string;
      transcript_id: string | null;
      seq: number | null;
      delivered: boolean;
      text: string;
      status: "ok" | "no_speech" | "failed";
      error: string | null;
      provider: string;
      model: string;
      confidence: number;
      latency_ms: number;
      audio_duration_ms: number;
      speech_ms: number;
    };

/**
 * Messages the app publishes to the agent on the same topic. `stop`: the take
 * is over — close the utterance in flight now instead of waiting for silence.
 */
export type SpeechClientMessage = { type: "stop" };

export function encodeClientMessage(message: SpeechClientMessage): Uint8Array<ArrayBuffer> {
  // Copied into a plain ArrayBuffer: `publishData` refuses a shared one.
  return new Uint8Array(new TextEncoder().encode(JSON.stringify(message)));
}

/** Parse one data-channel payload; null for anything that is not ours. */
export function parseAgentMessage(payload: Uint8Array): SpeechAgentMessage | null {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(payload)) as { type?: unknown };
    if (!parsed || typeof parsed.type !== "string") return null;
    return parsed as SpeechAgentMessage;
  } catch {
    return null;
  }
}

/** The server said the learner said something else entirely (not an attempt at the target). */
export function isUnrelatedSpeech(feedbackCode: string | undefined | null): boolean {
  return feedbackCode === "unrelated_speech";
}
