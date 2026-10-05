/**
 * iOS refuses audio started after an `await` in a tap handler; the element is
 * therefore started (on silence) inside the tap and the real URL played on it.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { playOn, unlockedAudio } from "./unlockedAudio";

afterEach(() => vi.restoreAllMocks());

describe("unlockedAudio", () => {
  it("starts playing at once, on a moment of silence", () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const audio = unlockedAudio();
    expect(play).toHaveBeenCalledTimes(1);
    expect(audio.src).toMatch(/^data:audio\/wav;base64,UklGR/); // "RIFF"
  });

  it("does not throw when the browser refuses the silent start", () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValue(new DOMException("no", "NotAllowedError"));
    expect(() => unlockedAudio()).not.toThrow();
  });

  it("plays the fetched URL on the same element", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    const audio = unlockedAudio();
    await playOn(audio, "https://cdn.example.com/tts/a.mp3");
    expect(audio.src).toBe("https://cdn.example.com/tts/a.mp3");
    expect(play).toHaveBeenCalledTimes(2);
    expect(play.mock.contexts[1]).toBe(audio);
  });
});
