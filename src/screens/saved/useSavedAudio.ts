import { useEffect, useRef, useState } from "react";
import { sentenceApi } from "../../api/endpoints";
import { useToast } from "../../hooks/toast";
import { useTranslation } from "../../i18n";
import { playOn, unlockedAudio } from "../../lib/unlockedAudio";

/**
 * The speaker button next to a saved sentence: fetch its signed audio URL and
 * play it right away. Re-tapping the same sentence stops it; tapping another
 * swaps. Stops when the screen goes.
 */
export function useSavedAudio() {
  const { t } = useTranslation();
  const toast = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  function stop() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    setPlayingId(null);
  }

  async function toggle(id: string) {
    if (playingId === id) {
      stop();
      return;
    }
    stop();
    setLoadingId(id);
    // Unlocked inside the tap, before the URL fetch (iOS).
    const a = unlockedAudio();
    try {
      const { url } = await sentenceApi.audio(id);
      audioRef.current = a;
      a.onended = () => setPlayingId(null);
      a.onerror = () => {
        setPlayingId(null);
        toast.error(t("saved.audioError"));
      };
      await playOn(a, url);
      setPlayingId(id);
      void sentenceApi.markViewed(id).catch(() => {});
    } catch {
      toast.error(t("saved.audioError"));
    } finally {
      setLoadingId(null);
    }
  }

  useEffect(() => () => stop(), []);

  return { playingId, loadingId, toggle, stop };
}
