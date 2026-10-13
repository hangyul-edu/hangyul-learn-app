import { describe, expect, it } from "vitest";
import { ApiError, errorMessage } from "./http";
import { needsRetake, pickRecordingMimeType, recordingFilename, speechErrorMessage } from "./recording";

describe("pickRecordingMimeType", () => {
  const only = (...types: string[]) => (type: string) => types.includes(type);

  it("prefers WebM/Opus, then Ogg/Opus, then MP4", () => {
    expect(pickRecordingMimeType(only("audio/webm;codecs=opus", "audio/mp4"))).toBe("audio/webm;codecs=opus");
    expect(pickRecordingMimeType(only("audio/ogg;codecs=opus", "audio/mp4"))).toBe("audio/ogg;codecs=opus");
    expect(pickRecordingMimeType(only("audio/mp4"))).toBe("audio/mp4");
  });

  it("leaves the choice to the browser when it cannot be asked", () => {
    expect(pickRecordingMimeType(undefined)).toBeUndefined();
    expect(pickRecordingMimeType(only())).toBeUndefined();
    expect(
      pickRecordingMimeType(() => {
        throw new Error("not implemented");
      }),
    ).toBeUndefined();
  });
});

describe("recordingFilename", () => {
  it.each([
    ["audio/webm;codecs=opus", "attempt.webm"],
    ["audio/ogg;codecs=opus", "attempt.ogg"],
    ["audio/mp4", "attempt.m4a"],
    ["audio/mp4;codecs=mp4a.40.2", "attempt.m4a"],
    ["audio/wav", "attempt.wav"],
    ["", "attempt.webm"],
  ])("%s → %s", (type, name) => {
    expect(recordingFilename(type)).toBe(name);
  });
});

describe("speech errors", () => {
  it("treats a silent or unreadable take as a retake, with its own message", () => {
    for (const code of ["speech.no_speech", "session.voice_empty", "speech.unsupported_audio", "speech.too_long"]) {
      const e = new ApiError(422, code, "server text");
      expect(needsRetake(e)).toBe(true);
      expect(speechErrorMessage(e)).not.toBe("server text");
    }
  });

  it("leaves any other failure to the usual message", () => {
    const e = new ApiError(503, "speech_recognition_unavailable", "server text");
    expect(needsRetake(e)).toBe(false);
    expect(speechErrorMessage(e)).toBe(errorMessage(e));
  });
});
