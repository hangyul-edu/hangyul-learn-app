import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { StreamVideo, isHlsUrl } from "./StreamVideo";

// A stand-in hls.js: records what the component asks of it and lets a test
// raise the library's events (ERROR, FRAG_LOADED) by name.
type ErrorData = { fatal: boolean; type: string; response?: { code: number } };
type Handler = (event: string, data?: ErrorData) => void;
type FakePlayer = {
  handlers: Record<string, Handler>;
  emit: (event: string, data?: ErrorData) => void;
  onError: (event: string, data: ErrorData) => void;
  startLoad: ReturnType<typeof vi.fn>;
  recoverMediaError: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  source?: string;
};
const hls = vi.hoisted(() => ({
  supported: true,
  instances: [] as FakePlayer[],
}));
vi.mock("hls.js", () => {
  class FakeHls {
    static Events = { ERROR: "hlsError", FRAG_LOADED: "hlsFragLoaded" };
    static ErrorTypes = { NETWORK_ERROR: "networkError", MEDIA_ERROR: "mediaError", OTHER_ERROR: "otherError" };
    static isSupported = () => hls.supported;
    handlers: Record<string, Handler> = {};
    startLoad = vi.fn();
    recoverMediaError = vi.fn();
    destroy = vi.fn();
    source?: string;
    constructor() {
      hls.instances.push(this as unknown as FakePlayer);
    }
    on(event: string, handler: Handler) {
      if (event === undefined) throw new Error("subscribed to an event hls.js does not have");
      this.handlers[event] = handler;
    }
    emit(event: string, data?: ErrorData) {
      this.handlers[event]?.(event, data);
    }
    onError(event: string, data: ErrorData) {
      this.emit(event, data);
    }
    loadSource(src: string) {
      this.source = src;
    }
    attachMedia() {}
  }
  return { default: FakeHls };
});

const HLS = "https://customer-x.cloudflarestream.com/tok/manifest/video.m3u8";
const MP4 = "http://127.0.0.1:8000/media/lecture-videos/vid_1.mp4";
const BLIP: ErrorData = { fatal: true, type: "networkError", response: { code: 0 } };

async function mountHls(onStreamError = vi.fn()) {
  const view = render(<StreamVideo src={HLS} onStreamError={onStreamError} />);
  await waitFor(() => expect(hls.instances).toHaveLength(1));
  const video = view.container.querySelector("video")!;
  return { player: hls.instances[0], onStreamError, video, view };
}

describe("StreamVideo", () => {
  beforeEach(() => {
    hls.instances.length = 0;
    hls.supported = true;
  });

  it("recognises the provider's HLS playlists, signed or not", () => {
    expect(isHlsUrl("https://cdn.example/v/manifest/video.m3u8?token=abc")).toBe(true);
    expect(isHlsUrl("https://cdn.example/v/manifest/video.m3u8")).toBe(true);
    expect(isHlsUrl(MP4)).toBe(false);
  });

  it("plays a plain file (the offline provider's MP4) directly", () => {
    const { container } = render(<StreamVideo src={MP4} />);
    expect(container.querySelector("video")?.getAttribute("src")).toBe(MP4);
  });

  it("plays HLS through hls.js wherever it is supported", async () => {
    const { player } = await mountHls();
    expect(player.source).toBe(HLS);
  });

  it("hands an expired URL (403) straight to the owner", async () => {
    const { player, onStreamError } = await mountHls();
    player.onError("hlsError", { fatal: true, type: "networkError", response: { code: 403 } });
    expect(player.startLoad).not.toHaveBeenCalled();
    expect(player.destroy).toHaveBeenCalled();
    expect(onStreamError).toHaveBeenCalledTimes(1);
  });

  it("retries a network blip once before giving up", async () => {
    const { player, onStreamError } = await mountHls();
    player.onError("hlsError", BLIP);
    expect(player.startLoad).toHaveBeenCalledTimes(1);
    expect(onStreamError).not.toHaveBeenCalled();
    player.onError("hlsError", BLIP);
    expect(onStreamError).toHaveBeenCalledTimes(1);
  });

  it("gives a later network blip its own retry once segments flow again", async () => {
    const { player, onStreamError } = await mountHls();
    player.onError("hlsError", BLIP);
    expect(player.startLoad).toHaveBeenCalledTimes(1);
    // The retry worked: a segment arrived.
    player.emit("hlsFragLoaded");
    player.onError("hlsError", BLIP);
    expect(player.startLoad).toHaveBeenCalledTimes(2);
    expect(onStreamError).not.toHaveBeenCalled();
    expect(player.destroy).not.toHaveBeenCalled();
    // Two blips in a row with nothing loaded between them: refresh the URL.
    player.onError("hlsError", BLIP);
    expect(player.startLoad).toHaveBeenCalledTimes(2);
    expect(onStreamError).toHaveBeenCalledTimes(1);
  });

  it("recovers a media error once, and ignores non-fatal ones", async () => {
    const { player, onStreamError } = await mountHls();
    player.onError("hlsError", { fatal: false, type: "mediaError" });
    player.onError("hlsError", { fatal: true, type: "mediaError" });
    expect(player.recoverMediaError).toHaveBeenCalledTimes(1);
    expect(onStreamError).not.toHaveBeenCalled();
    player.onError("hlsError", { fatal: true, type: "mediaError" });
    expect(onStreamError).toHaveBeenCalledTimes(1);
  });

  it("ignores the element's own error event while hls.js drives it (no double refresh)", async () => {
    const { player, onStreamError, video } = await mountHls();
    fireEvent.error(video);
    expect(onStreamError).not.toHaveBeenCalled();
    // The failure itself arrives through hls.js, and is reported exactly once.
    player.onError("hlsError", { fatal: true, type: "otherError" });
    expect(onStreamError).toHaveBeenCalledTimes(1);
  });

  it("reports the element's error event for native playback of a plain file", () => {
    const onStreamError = vi.fn();
    const { container } = render(<StreamVideo src={MP4} onStreamError={onStreamError} />);
    fireEvent.error(container.querySelector("video")!);
    expect(onStreamError).toHaveBeenCalledTimes(1);
  });

  it("falls back to the browser's own HLS without MSE, and reports its errors", async () => {
    hls.supported = false;
    const onStreamError = vi.fn();
    const { container } = render(<StreamVideo src={HLS} onStreamError={onStreamError} />);
    const video = container.querySelector("video")!;
    await waitFor(() => expect(video.getAttribute("src")).toBe(HLS));
    fireEvent.error(video);
    expect(onStreamError).toHaveBeenCalledTimes(1);
  });

  it("destroys the hls.js player on unmount and on a new URL", async () => {
    const { player, view } = await mountHls();
    view.rerender(<StreamVideo src={`${HLS}?token=fresh`} />);
    await waitFor(() => expect(hls.instances).toHaveLength(2));
    expect(player.destroy).toHaveBeenCalledTimes(1);
    expect(hls.instances[1].source).toBe(`${HLS}?token=fresh`);
    view.unmount();
    expect(hls.instances[1].destroy).toHaveBeenCalledTimes(1);
  });
});

describe("StreamVideo when the player chunk cannot load", () => {
  it("asks the owner for a retry instead of leaving a blank player", async () => {
    vi.resetModules();
    vi.doMock("hls.js", () => {
      throw new Error("Failed to fetch dynamically imported module");
    });
    try {
      const { StreamVideo: FreshStreamVideo } = await import("./StreamVideo");
      const onStreamError = vi.fn();
      render(<FreshStreamVideo src={HLS} onStreamError={onStreamError} />);
      await waitFor(() => expect(onStreamError).toHaveBeenCalledTimes(1));
    } finally {
      vi.doUnmock("hls.js");
    }
  });

  it("stays quiet when the chunk fails after the player was unmounted", async () => {
    vi.resetModules();
    let fail!: (reason: Error) => void;
    vi.doMock("hls.js", () => new Promise((_resolve, reject) => (fail = reject)));
    try {
      const { StreamVideo: FreshStreamVideo } = await import("./StreamVideo");
      const onStreamError = vi.fn();
      const view = render(<FreshStreamVideo src={HLS} onStreamError={onStreamError} />);
      await waitFor(() => expect(fail).toBeTypeOf("function"));
      view.unmount();
      fail(new Error("offline"));
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(onStreamError).not.toHaveBeenCalled();
    } finally {
      vi.doUnmock("hls.js");
    }
  });
});
