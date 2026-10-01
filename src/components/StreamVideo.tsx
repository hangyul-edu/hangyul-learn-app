import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { VideoHTMLAttributes } from "react";

/** True for an HLS playlist URL (the hosting provider's signed stream). */
export function isHlsUrl(url: string): boolean {
  return /\.m3u8(\?|#|$)/i.test(url);
}

/**
 * A `<video>` that plays the hosting provider's HLS streams everywhere.
 *
 * Safari plays HLS natively; Chrome and Firefox do not, so there the stream is
 * attached through hls.js (loaded only when needed). Anything else — the MP4
 * the offline provider serves — goes straight into `src`.
 */
export const StreamVideo = forwardRef<HTMLVideoElement, VideoHTMLAttributes<HTMLVideoElement> & { src: string }>(
  function StreamVideo({ src, ...props }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);
    useImperativeHandle(ref, () => videoRef.current as HTMLVideoElement);

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      const native = video.canPlayType("application/vnd.apple.mpegurl") !== "";
      if (!isHlsUrl(src) || native) {
        video.src = src;
        return;
      }
      let destroyed = false;
      let detach: (() => void) | undefined;
      void import("hls.js").then(({ default: Hls }) => {
        if (destroyed) return;
        if (!Hls.isSupported()) {
          video.src = src;
          return;
        }
        const hls = new Hls();
        hls.loadSource(src);
        hls.attachMedia(video);
        detach = () => hls.destroy();
      });
      return () => {
        destroyed = true;
        detach?.();
      };
    }, [src]);

    return <video ref={videoRef} {...props} />;
  },
);
