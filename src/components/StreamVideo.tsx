import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { VideoHTMLAttributes } from "react";

/** True for an HLS playlist URL (the hosting provider's signed stream). */
export function isHlsUrl(url: string): boolean {
  return /\.m3u8(\?|#|$)/i.test(url);
}

type StreamVideoProps = VideoHTMLAttributes<HTMLVideoElement> & {
  src: string;
  /**
   * The stream stopped and could not be recovered here — typically its signed
   * URL ran out (manifest/segment 401/403). The owner fetches a fresh URL and
   * passes it as `src`; the position is the owner's to restore.
   */
  onStreamError?: () => void;
};

/**
 * A `<video>` that plays the hosting provider's HLS streams everywhere.
 *
 * Where Media Source Extensions exist (Chrome, Firefox, Edge, desktop Safari)
 * the stream goes through hls.js — loaded only when needed — which is the
 * library's own recommendation even where native HLS answers "maybe" (Android
 * Chrome plays it poorly). Without MSE (iOS Safari) the browser plays HLS
 * natively. Anything else — the MP4 the offline provider serves — goes
 * straight into `src`.
 *
 * hls.js reports stream failures through its own events, not the `<video>`
 * `error` event, so they are handled here: a recoverable network or media
 * error is retried once, anything else is handed to `onStreamError`.
 */
export const StreamVideo = forwardRef<HTMLVideoElement, StreamVideoProps>(function StreamVideo(
  { src, onStreamError, ...props },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useImperativeHandle(ref, () => videoRef.current as HTMLVideoElement);
  const onStreamErrorRef = useRef(onStreamError);
  onStreamErrorRef.current = onStreamError;

  // Native playback (plain files, or HLS without MSE) reports through `error`.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onError = () => onStreamErrorRef.current?.();
    video.addEventListener("error", onError);
    return () => video.removeEventListener("error", onError);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!isHlsUrl(src)) {
      video.src = src;
      return;
    }
    let destroyed = false;
    let detach: (() => void) | undefined;
    void import("hls.js").then(({ default: Hls }) => {
      if (destroyed) return;
      if (!Hls.isSupported()) {
        // No MSE (iOS Safari): the browser's own HLS player.
        video.src = src;
        return;
      }
      const hls = new Hls();
      let networkRetried = false;
      let mediaRetried = false;
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        const status = data.response?.code;
        const expired = status === 401 || status === 403;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && !expired && !networkRetried) {
          networkRetried = true;
          hls.startLoad();
          return;
        }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !mediaRetried) {
          mediaRetried = true;
          hls.recoverMediaError();
          return;
        }
        hls.destroy();
        detach = undefined;
        onStreamErrorRef.current?.();
      });
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
});
