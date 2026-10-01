import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { StreamVideo, isHlsUrl } from "./StreamVideo";

describe("StreamVideo", () => {
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
});
