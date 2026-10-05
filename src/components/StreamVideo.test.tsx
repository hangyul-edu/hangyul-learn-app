import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { StreamVideo, isHlsUrl } from "./StreamVideo";

// A stand-in hls.js: records what the component asks of it and lets a test
// raise the library's ERROR event.
type ErrorData = { fatal: boolean; type: string; response?: { code: number } };
const hls = vi.hoisted(() => ({
  supported: true,
  instances: [] as {
    onError?: (event: string, data: ErrorData) => void;
    startLoad: ReturnType<typeof vi.fn>;
    recoverMediaError: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
    source?: string;
  }[],
}));
vi.mock("hls.js", () => {
  class FakeHls {
    static Events = { ERROR: "hlsError" };
    static ErrorTypes = { NETWORK_ERROR: "networkError", MEDIA_ERROR: "mediaError", OTHER_ERROR: "otherError" };
    static isSupported = () => hls.supported;
    startLoad = vi.fn();
    recoverMediaError = vi.fn();
    destroy = vi.fn();
    onError?: (event: string, data: ErrorData) => void;
    source?: string;
    constructor() {
      hls.instances.push(this);
    }
    on(_event: string, handler: (event: string, data: ErrorData) => void) {
      this.onError = handler;
    }
    loadSource(src: string) {
      this.source = src;
    }
    attachMedia() {}
  }
  return { default: FakeHls };
});

const HLS = "https://customer-x.cloudflarestream.com/tok/manifest/video.m3u8";

async function mountHls(onStreamError = vi.fn()) {
  render(<StreamVideo src={HLS} onStreamError={onStreamError} />);
  await waitFor(() => expect(hls.instances).toHaveLength(1));
  return { player: hls.instances[0], onStreamError };
}

describe("StreamVideo", () => {
  beforeEach(() => {
    hls.instances.length = 0;
    hls.supported = true;
  });

  it("recognises the provider's HLS playlists, signed or not", () => {
    expect(isHlsUrl("https://cdn.example/v/manifest/video.m3u8?token=abc")).toBe(true);
    expect(isHlsUrl("https://cdn.example/v/manifest/video.m3u8")).toBe(true);
    expect(isHlsUrl("http://127.0.0.1:8000/media/lecture-videos/vid_1.mp4")).toBe(false);
  });

  it("plays a plain file (the offline provider's MP4) directly", () => {
    const { container } = render(<StreamVideo src="http://127.0.0.1:8000/media/lecture-videos/vid_1.mp4" />);
    expect(container.querySelector("video")?.getAttribute("src")).toBe(
      "http://127.0.0.1:8000/media/lecture-videos/vid_1.mp4",
    );
  });

  it("plays HLS through hls.js wherever it is supported", async () => {
    const { player } = await mountHls();
    expect(player.source).toBe(HLS);
  });

  it("hands an expired URL (403) straight to the owner", async () => {
    const { player, onStreamError } = await mountHls();
    player.onError?.("hlsError", { fatal: true, type: "networkError", response: { code: 403 } });
    expect(player.startLoad).not.toHaveBeenCalled();
    expect(player.destroy).toHaveBeenCalled();
    expect(onStreamError).toHaveBeenCalledTimes(1);
  });

  it("retries a network blip once before giving up", async () => {
    const { player, onStreamError } = await mountHls();
    player.onError?.("hlsError", { fatal: true, type: "networkError", response: { code: 0 } });
    expect(player.startLoad).toHaveBeenCalledTimes(1);
    expect(onStreamError).not.toHaveBeenCalled();
    player.onError?.("hlsError", { fatal: true, type: "networkError", response: { code: 0 } });
    expect(onStreamError).toHaveBeenCalledTimes(1);
  });

  it("recovers a media error once, and ignores non-fatal ones", async () => {
    const { player, onStreamError } = await mountHls();
    player.onError?.("hlsError", { fatal: false, type: "mediaError" });
    player.onError?.("hlsError", { fatal: true, type: "mediaError" });
    expect(player.recoverMediaError).toHaveBeenCalledTimes(1);
    expect(onStreamError).not.toHaveBeenCalled();
    player.onError?.("hlsError", { fatal: true, type: "mediaError" });
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
});
