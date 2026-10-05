/**
 * What a microphone recording is, as far as uploading it goes.
 *
 * Browsers record in different containers — Chrome and Edge WebM/Opus,
 * Firefox Ogg/Opus, Safari MP4/AAC — and the server decodes all of them. The
 * one rule is to say honestly which one it is: the Blob carries the recorder's
 * real MIME type and the upload a matching file extension, never a hardcoded
 * `.webm` on Safari's MP4.
 */
import { resolveMessage } from "../i18n/current";
import { ApiError, errorMessage } from "./http";

/** Longest take the server accepts; the recorder stops itself here. */
export const MAX_RECORDING_MS = 15_000;

/** Preferred formats, best first. Opus is what speech recognition likes best. */
const PREFERRED_TYPES = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4", "audio/webm"];

/**
 * The first preferred format this browser can record, or `undefined` to let
 * the browser pick its default (older engines without `isTypeSupported`).
 */
export function pickRecordingMimeType(
  isTypeSupported: ((type: string) => boolean) | undefined = typeof MediaRecorder !== "undefined"
    ? (type) => MediaRecorder.isTypeSupported(type)
    : undefined,
): string | undefined {
  if (!isTypeSupported) return undefined;
  for (const type of PREFERRED_TYPES) {
    try {
      if (isTypeSupported(type)) return type;
    } catch {
      /* a browser that throws on unknown types — try the next */
    }
  }
  return undefined;
}

/** A file extension matching a recording's MIME type. */
export function recordingExtension(mimeType: string | undefined | null): string {
  const base = (mimeType ?? "").split(";")[0].trim().toLowerCase();
  if (base === "audio/ogg" || base === "audio/opus") return "ogg";
  if (base === "audio/mp4" || base === "audio/aac" || base === "audio/x-m4a" || base === "video/mp4") return "m4a";
  if (base === "audio/wav" || base === "audio/x-wav") return "wav";
  return "webm";
}

/** The upload filename for a recording of this MIME type. */
export function recordingFilename(mimeType: string | undefined | null): string {
  return `attempt.${recordingExtension(mimeType)}`;
}

/**
 * Server codes for a take that could not be graded at all — silence, an
 * unreadable file, or one over the limit. Nothing was recorded against the
 * learner, so the screen asks for another take instead of marking it wrong.
 */
const RETAKE_MESSAGES: Record<string, string> = {
  "speech.no_speech": "speechError.noSpeech",
  "session.voice_empty": "speechError.noSpeech",
  "speech.unsupported_audio": "speechError.unsupportedAudio",
  "speech.too_long": "speechError.tooLong",
};

/** True when the take was not graded and the learner should simply record again. */
export function needsRetake(e: unknown): boolean {
  return e instanceof ApiError && e.code in RETAKE_MESSAGES;
}

/** `errorMessage`, with a friendly line for the not-graded cases above. */
export function speechErrorMessage(e: unknown): string {
  if (e instanceof ApiError && e.code in RETAKE_MESSAGES) return resolveMessage(RETAKE_MESSAGES[e.code]);
  return errorMessage(e);
}

/** What the recorder knows about a finished take, beside its audio. */
export type RecordingInfo = {
  /** Upload filename with an extension matching the audio's real format. */
  filename: string;
  /** Measured length of the take, in milliseconds. */
  durationMs: number;
};
