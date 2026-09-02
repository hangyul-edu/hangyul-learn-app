import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "../i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../components/ui/kit";
import { Async } from "../components/ui/states";
import { learnApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { useMarkStudied } from "../hooks/learningActivity";
import { ApiError, errorMessage } from "../lib/http";
import type { LectureDetail as Lec } from "../lib/types";
import icClose from "../assets/brand/ic-close.svg";
import playerPlay from "../assets/brand/player-play.svg";
import playerBack5 from "../assets/brand/player-back5.svg";
import playerFwd5 from "../assets/brand/player-fwd5.svg";
import playerKnob from "../assets/brand/player-knob.svg";
import chatbotFab from "../assets/brand/chatbot-fab.svg";

/** mm:ss, zero-padded — COU-004 prints both ends of the scrubber that way. */
function fmt(sec: number) {
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
}

/** Playback speeds the 1X chip cycles through. */
const SPEEDS = [1, 1.25, 1.5, 2] as const;

export function Lecture() {
  const { t } = useTranslation();
  const { lectureId = "" } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [pos, setPos] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(SPEEDS[0]);
  const [muteSpeaking, setMuteSpeaking] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [premiumLocked, setPremiumLocked] = useState(false);
  const [, setSaving] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const markStudied = useMarkStudied();

  const q = useQuery({ queryKey: ["lecture", lectureId], queryFn: () => learnApi.lecture(lectureId) });

  useEffect(() => {
    if (q.data) setPos(q.data.my_playback?.last_position_seconds ?? 0);
  }, [q.data]);

  // Try to fetch a real playback URL; premium content 402s → show the gate.
  useEffect(() => {
    if (!q.data) return;
    learnApi
      .lecturePlay(lectureId)
      .then((r) => setVideoUrl(r.video.url))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 402) setPremiumLocked(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data]);

  /** Fraction of the clip already played, as a percentage of the track. */
  function pct(l: Lec) {
    const total = duration || l.duration_seconds || 1;
    return Math.max(0, Math.min(100, (pos / total) * 100));
  }

  function seek(seconds: number) {
    const next = Math.max(0, seconds);
    setPos(next);
    if (videoRef.current) videoRef.current.currentTime = next;
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => setPlaying(false));
    else v.pause();
  }

  function cycleSpeed() {
    const next = SPEEDS[(SPEEDS.indexOf(speed as (typeof SPEEDS)[number]) + 1) % SPEEDS.length];
    setSpeed(next);
    if (videoRef.current) videoRef.current.playbackRate = next;
  }

  async function saveProgress(seconds: number, done: boolean) {
    setSaving(true);
    try {
      await learnApi.progress(lectureId, seconds);
      setPos(seconds);
      if (done) {
        toast.success(t("courses.completedToast"));
        qc.invalidateQueries({ queryKey: ["dashboard"] });
        qc.invalidateQueries({ queryKey: ["course"] });
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="screen lecp">
      {/* cp_B_01_topNav on black: the close glyph at 20, and the
          "말하기 제외" switch pinned to the right (COU-004 230:7046). */}
      <header className="lecp__nav">
        <button className="lecp__close" onClick={() => nav(-1)} aria-label={t("common.back")}>
          <img src={icClose} alt="" aria-hidden="true" />
        </button>
        <label className="lecp__mute">
          <span className="lecp__mute-label">{t("courses.excludeSpeaking")}</span>
          <input type="checkbox" checked={muteSpeaking} onChange={(e) => setMuteSpeaking(e.target.checked)} />
          <span className="lecp__switch" aria-hidden="true" />
        </label>
      </header>

      <Async loading={q.isLoading} error={q.error} data={q.data} onRetry={() => q.refetch()}>
        {(l: Lec) => (
          <>
            <div className="lecp__stage">
              {videoUrl ? (
                <video
                  ref={videoRef}
                  className="lecp__video"
                  src={videoUrl}
                  poster={l.thumbnail_url ?? undefined}
                  playsInline
                  muted={muteSpeaking}
                  onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || l.duration_seconds)}
                  onTimeUpdate={(e) => {
                    setPos(e.currentTarget.currentTime);
                    if (e.currentTarget.currentTime > 0) markStudied("lecture", lectureId);
                  }}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onEnded={() => void saveProgress(l.duration_seconds, true)}
                />
              ) : premiumLocked ? (
                <div className="lecp__gate">
                  <div className="lecp__gate-emoji">👑</div>
                  <div className="lecp__gate-title">{t("courses.premiumLecture")}</div>
                  <Button size="sm" onClick={() => nav("/subscription")}>{t("study.upgrade")}</Button>
                </div>
              ) : (
                <img className="lecp__poster" src={l.thumbnail_url ?? undefined} alt="" />
              )}

              {/* 230:7051 / 230:7053 — the tutor prompt and its 45px FAB. */}
              <button className="lecp__ask" onClick={() => nav("/ai")} aria-label={t("courses.chatbotA11y")}>
                <span className="lecp__ask-bubble">{t("courses.askBubble")}</span>
                <img className="lecp__ask-fab" src={chatbotFab} alt="" aria-hidden="true" />
              </button>
            </div>

            <div className="lecp__controls">
              <div className="lecp__times">
                <span>{fmt(pos)}</span>
                <span>{fmt(duration || l.duration_seconds)}</span>
              </div>
              <div className="lecp__track">
                <span className="lecp__track-fill" style={{ width: `${pct(l)}%` }} />
                <img className="lecp__knob" src={playerKnob} alt="" aria-hidden="true" style={{ left: `${pct(l)}%` }} />
                <input
                  className="lecp__range"
                  type="range"
                  min={0}
                  max={duration || l.duration_seconds}
                  step={1}
                  value={pos}
                  aria-label={t("courses.progress")}
                  onChange={(e) => seek(Number(e.target.value))}
                  onMouseUp={() => void saveProgress(pos, false)}
                  onTouchEnd={() => void saveProgress(pos, false)}
                />
              </div>

              <div className="lecp__buttons">
                <button className="lecp__skip" onClick={() => seek(pos - 5)} aria-label={t("courses.back5")}>
                  <img src={playerBack5} alt="" aria-hidden="true" />
                  <span>5</span>
                </button>
                <button className="lecp__play" onClick={togglePlay} aria-label={t(playing ? "courses.pause" : "courses.play")}>
                  <img src={playerPlay} alt="" aria-hidden="true" />
                </button>
                <button className="lecp__skip lecp__skip--fwd" onClick={() => seek(pos + 5)} aria-label={t("courses.fwd5")}>
                  <img src={playerFwd5} alt="" aria-hidden="true" />
                  <span>5</span>
                </button>
              </div>

              <button className="lecp__speed" onClick={cycleSpeed} aria-label={t("courses.speedA11y", { rate: String(speed) })}>
                {speed}X
              </button>
            </div>
          </>
        )}
      </Async>
    </div>
  );
}
