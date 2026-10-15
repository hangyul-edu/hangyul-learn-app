import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "../i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../components/ui/kit";
import { ConfirmDialog, Dialog } from "../components/ui/Modal";
import { Async } from "../components/ui/states";
import { ChatbotBottomSheet } from "../components/ChatbotBottomSheet";
import { StreamVideo } from "../components/StreamVideo";
import { CheckpointOverlay } from "../components/lecture/CheckpointOverlay";
import { learnApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { useMarkStudied } from "../hooks/learningActivity";
import { useAutoHideControls } from "../hooks/useAutoHideControls";
import { ApiError, errorMessage } from "../lib/http";
import { checkpointAtResume, dueCheckpoint, isExcluded } from "../lib/lectureCheckpoints";
import type { LectureCheckpoint, LectureDetail as Lec } from "../lib/types";
import icClose from "../assets/brand/ic-24-close-white.svg";
import playerPlay from "../assets/brand/player-play.svg";
import playerBack5 from "../assets/brand/player-back5.svg";
import playerFwd5 from "../assets/brand/player-fwd5.svg";
import playerKnob from "../assets/brand/player-knob.svg";
import { AskMascot } from "../components/lecture/AskMascot";
import { useDashboard } from "../api/queries";
import { mmss } from "../lib/format";

/** Playback speeds the speed chip cycles through, shown as "1x", "1.25x"… */
const SPEEDS = [1, 1.25, 1.5, 2] as const;
/** At most this many fresh playback URLs per window before giving up on the stream. */
const STREAM_REFRESH_LIMIT = 3;
const STREAM_REFRESH_WINDOW_MS = 5 * 60 * 1000;

/**
 * Seconds of playback between progress heartbeats. The server only counts a
 * lecture as watched when its frontier advances in steps of at most 60s, so
 * completion depends on these arriving while the video plays.
 */
export const HEARTBEAT_SECONDS = 15;
/** A saved position this close to the end means the video was watched to the
 * end (finishing saves the full length): the next visit starts over. */
const RESTART_NEAR_END_SECONDS = 3;

/** Navigation state the course page reads to show COU-021's reward. */
export type CourseRewardState = { rewardPoints?: number };

/** Set by the series page when it opens a lesson: the player then returns by
 * stepping back instead of pushing the series page again. */
export type LectureEntryState = { fromSeriesId?: string };

const SERIES_REWARD_KEY = "hangyul.seriesReward:";

// The latest position save per lecture (beat, pause or exit). Reopening the
// lecture waits for it before reading the lecture back, so a quick close and
// reopen can never read the position from before the save landed.
const pendingSaves = new Map<string, Promise<unknown>>();

/** Every position save still in flight has landed (or failed). Pages that
 * read watch history — the series page's 바로 학습하기 — wait for this, or a
 * lesson just closed would not be the one most recently watched yet. */
export function progressSavesSettled(): Promise<unknown> {
  return Promise.all([...pendingSaves.values()]);
}

/** Send a position save and track it; never rejects. */
function saveOnExit(lectureId: string, seconds: number) {
  const save = learnApi
    .progress(lectureId, Math.floor(seconds))
    .catch(() => undefined)
    .finally(() => {
      if (pendingSaves.get(lectureId) === save) pendingSaves.delete(lectureId);
    });
  pendingSaves.set(lectureId, save);
}

/** Hand the just-earned points to the series page we are stepping back to
 * (history.back cannot carry router state). */
function stashSeriesReward(seriesId: string, points: number) {
  try {
    sessionStorage.setItem(SERIES_REWARD_KEY + seriesId, String(points));
  } catch {
    // Storage unavailable: the points are paid anyway; only the modal is lost.
  }
}

/** The points a lesson handed back to this series page, if any. */
export function peekSeriesReward(seriesId: string): number {
  try {
    return Number(sessionStorage.getItem(SERIES_REWARD_KEY + seriesId)) || 0;
  } catch {
    return 0;
  }
}

export function clearSeriesReward(seriesId: string) {
  try {
    sessionStorage.removeItem(SERIES_REWARD_KEY + seriesId);
  } catch {
    // nothing to clear
  }
}

/**
 * The lecture player — COU-004 (conversation, 230:7011) and COU-005 (TOPIK,
 * 1135:20041).
 *
 * At each checkpoint the admin set, playback pauses and the conversation
 * (COU-006..008) or TOPIK (COU-011..013) card opens; finishing it resumes the
 * video. The switch in the nav skips one kind: 말하기 제외 the speaking cards
 * of a conversation lecture, 문제 풀이 제외 the questions of a TOPIK lecture.
 * At the end the lecture is completed on the server and COU-009 congratulates;
 * 계속하기 returns to the course, which shows the +100P reward (COU-021).
 */
export function Lecture() {
  const { t, language } = useTranslation();
  const { lectureId = "" } = useParams();
  const nav = useNavigate();
  const entry = useLocation().state as LectureEntryState | null;
  const toast = useToast();
  const qc = useQueryClient();
  const [pos, setPos] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(SPEEDS[0]);
  const [exclude, setExclude] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [premiumLocked, setPremiumLocked] = useState(false);
  const [active, setActive] = useState<LectureCheckpoint | null>(null);
  const [askOpen, setAskOpen] = useState(false);
  const [quitOpen, setQuitOpen] = useState(false);
  const [finished, setFinished] = useState<{ points: number } | null>(null);
  // What keeps the overlaid controls up while the video plays.
  const [hovering, setHovering] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [focusInside, setFocusInside] = useState(false);
  const controls = useAutoHideControls({
    playing,
    held: hovering || scrubbing || focusInside || askOpen || quitOpen || !!active || !!finished,
  });
  // A mouse resting on a piece of the controls holds them (touch has no hover).
  const hoverHold = {
    onPointerEnter: (e: ReactPointerEvent) => e.pointerType === "mouse" && setHovering(true),
    onPointerLeave: (e: ReactPointerEvent) => e.pointerType === "mouse" && setHovering(false),
  };
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastTimeRef = useRef(0);
  const lastBeatRef = useRef(0);
  // The end-of-video completion is in flight (onEnded can fire twice).
  const finishingRef = useRef(false);
  // Where to pick up after the signed URL was swapped for a fresh one, and
  // when recent swaps happened (a stream that keeps failing is not retried
  // forever).
  const reloadRef = useRef<{ at: number; play: boolean } | null>(null);
  const refreshTimesRef = useRef<number[]>([]);

  /**
   * The stream stopped mid-watch — usually its signed URL ran out. Ask for a
   * fresh URL and carry on from the same second; the controls come up if the
   * stream cannot be saved.
   */
  function refreshStream() {
    const now = Date.now();
    const recent = refreshTimesRef.current.filter((t) => now - t < STREAM_REFRESH_WINDOW_MS);
    if (recent.length >= STREAM_REFRESH_LIMIT) {
      refreshTimesRef.current = recent;
      controls.show();
      return;
    }
    refreshTimesRef.current = [...recent, now];
    const v = videoRef.current;
    reloadRef.current = { at: v?.currentTime ?? lastTimeRef.current, play: !!v && !v.paused };
    learnApi
      .lectureVideo(lectureId)
      .then((r) => setVideoUrl(r.video_url))
      .catch((e) => {
        reloadRef.current = null;
        if (e instanceof ApiError && e.status === 402) {
          setPremiumLocked(true);
          setVideoUrl(null);
        }
        controls.show();
      });
  }

  const markStudied = useMarkStudied();

  // Always read fresh on open — the saved position comes with it — and only
  // after this lecture's exit save (if one is still in flight) has landed.
  // The app-wide 15s staleTime used to hand a reopened lecture its cached
  // position from the previous visit, so it started over from the beginning.
  const q = useQuery({
    queryKey: ["lecture", lectureId, language],
    queryFn: async () => {
      await pendingSaves.get(lectureId);
      return learnApi.lecture(lectureId, language);
    },
    staleTime: 0,
    refetchOnMount: "always",
  });
  // The video waits for that fresh read (cached data shows the title meanwhile).
  const fresh = q.isFetchedAfterMount && !!q.data;
  // Only to pick the quit confirm's wording: "goal already met" vs "a bit left".
  const dashboard = useDashboard({ enabled: quitOpen });

  const checkpoints = useMemo(
    () => [...(q.data?.checkpoints ?? [])].sort((a, b) => a.at_second - b.at_second),
    [q.data],
  );
  const topik = q.data?.track_id === "track_topik";

  useEffect(() => {
    if (q.data) setPos(q.data.my_playback?.last_position_seconds ?? 0);
  }, [q.data]);

  // Hidden controls cannot take focus, so for keyboard users Tab is the
  // "tap": it brings them up to be tabbed through.
  // The "궁금한 건 나한테 물어봐!" prompt is shown once per visit: the first time
  // the controls come up it appears beside the mascot and fades itself out
  // (or goes with the controls if they hide first), and never returns.
  const [prompt, setPrompt] = useState<"pending" | "showing" | "done">("pending");
  useEffect(() => {
    if (controls.visible && prompt === "pending") setPrompt("showing");
    if (!controls.visible && prompt === "showing") setPrompt("done");
  }, [controls.visible, prompt]);

  const showControls = controls.show;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") showControls();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showControls]);

  // Try to fetch a real playback URL; premium content 402s → show the gate.
  // Once per visit, after the fresh read: a later refetch (window focus) must
  // not swap the URL and restart the video mid-play.
  // Any other failure says so with a retry, instead of a black stage forever.
  const playRequestedRef = useRef(false);
  const [playFailed, setPlayFailed] = useState(false);
  function requestPlay() {
    playRequestedRef.current = true;
    setPlayFailed(false);
    learnApi
      .lecturePlay(lectureId)
      .then((r) => setVideoUrl(r.video.url))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 402) setPremiumLocked(true);
        else setPlayFailed(true);
      });
  }
  useEffect(() => {
    if (!fresh || playRequestedRef.current) return;
    requestPlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fresh]);

  // Save the position whenever the learner leaves — the X, the system back,
  // switching lecture or app — not only on pause: closing mid-play used to
  // keep only the last 15s beat, or nothing in the first 15 seconds.
  const finishedRef = useRef(false);
  finishedRef.current = !!finished;
  useEffect(() => {
    const flush = () => {
      const at = lastTimeRef.current;
      if (finishedRef.current || at <= 0 || Math.floor(at) === Math.floor(lastBeatRef.current)) return;
      lastBeatRef.current = at;
      saveOnExit(lectureId, at);
    };
    const onHidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [lectureId]);

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

  function play() {
    void videoRef.current?.play().catch(() => setPlaying(false));
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) play();
    else v.pause();
  }

  function cycleSpeed() {
    const next = SPEEDS[(SPEEDS.indexOf(speed as (typeof SPEEDS)[number]) + 1) % SPEEDS.length];
    setSpeed(next);
    if (videoRef.current) videoRef.current.playbackRate = next;
  }

  /** Report the position; quiet, since it runs in the background while watching. */
  async function heartbeat(seconds: number) {
    lastBeatRef.current = seconds;
    // Tracked like the exit save: the pause that closing triggers sends the
    // last position here, and a quick reopen must wait for it.
    saveOnExit(lectureId, seconds);
    try {
      await pendingSaves.get(lectureId);
      // The catalog's started/done markers come from the progress just written.
      // (This screen's own ["lecture", id] is left alone: refetching it would
      // re-request the playback URL and reload the video mid-play.)
      void qc.invalidateQueries({ queryKey: ["lectures"] });
    } catch {
      // The next beat carries the position again.
    }
  }

  function onTime(v: HTMLVideoElement) {
    const now = v.currentTime;
    const previous = lastTimeRef.current;
    lastTimeRef.current = now;
    setPos(now);
    if (now > 0) markStudied("lecture", lectureId);
    if (now < lastBeatRef.current) {
      // Rewound: count the next 15s from here. Dragging the scrubber back
      // fires a time update per frame, and reporting each one flooded the API;
      // the drag's release (and any pause) reports the position instead.
      lastBeatRef.current = now;
    } else if (now - lastBeatRef.current >= HEARTBEAT_SECONDS) {
      void heartbeat(now);
    }
    if (active || !q.data) return;
    const due = dueCheckpoint(checkpoints, previous, now, (c) =>
      isExcluded(c.interaction_type, q.data.track_id, exclude),
    );
    if (due) {
      v.pause();
      setActive(due);
    }
  }

  function closeCheckpoint() {
    setActive(null);
    play();
  }

  async function finish(l: Lec) {
    if (finishingRef.current) return;
    finishingRef.current = true;
    // The video ended: report the lesson's full stored length. The element's
    // own duration, floored to whole seconds, can sit a second short of a
    // length that was rounded up when it was stored.
    const end = Math.max(duration || 0, l.duration_seconds);
    await heartbeat(end);
    try {
      const done = await learnApi.completeLecture(lectureId);
      setFinished({ points: done.points_earned });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["course"] });
      void qc.invalidateQueries({ queryKey: ["courses"] });
      void qc.invalidateQueries({ queryKey: ["lectures"] });
    } catch (e) {
      // 409: skipped through rather than watched — nothing to celebrate.
      if (!(e instanceof ApiError && e.status === 409)) toast.error(errorMessage(e));
    } finally {
      finishingRef.current = false;
    }
  }

  // Out of a lesson, the learner lands on its series' lesson list (COU-002).
  // Opened from that list, the player steps back to it: replacing the player
  // with a fresh series entry left the original one behind it in history, so
  // every lesson watched added one more back press. Opened any other way (a
  // link, a notification), the player is replaced by the series page.
  function backToSeries(rewardPoints = 0) {
    const l = q.data;
    if (l?.series_id && entry?.fromSeriesId === l.series_id) {
      if (rewardPoints > 0) stashSeriesReward(l.series_id, rewardPoints);
      nav(-1);
    } else if (l?.series_id) {
      const state: CourseRewardState = { rewardPoints };
      nav(`/series/${l.series_id}`, { replace: true, state });
    } else {
      nav(-1);
    }
  }

  function leave() {
    backToSeries();
  }

  function continueAfterEnd() {
    backToSeries(finished?.points ?? 0);
  }

  function requestClose() {
    // Just finished: the end-of-video request is on its way and its result
    // (COU-009, then the reward) appears in a moment — not a "quit?" prompt.
    if (finishingRef.current) return;
    // Finished this time: leave the way 계속하기 does, carrying the reward.
    if (finished) {
      continueAfterEnd();
      return;
    }
    if (q.data?.my_playback?.completed || !q.data) {
      leave();
      return;
    }
    videoRef.current?.pause();
    setQuitOpen(true);
  }

  const goalMet = !!dashboard.data?.tracks.find((tr) => tr.track_id === q.data?.track_id)?.goal.achieved;
  const l = q.data;

  return (
    <div
      className="screen lecp"
      // Until there is a video to watch (loading, an error, the premium gate)
      // the controls stay up, so the close button is always there.
      data-controls={controls.visible || !videoUrl ? "shown" : "hidden"}
    >
      {/* The picture fills the screen, letterboxed and never cropped. The
          video opens playing with the controls hidden; tapping or clicking the
          picture shows them, and tapping it while they are up hides them. */}
      <div className="lecp__stage" onClick={controls.toggle}>
        <Async loading={q.isLoading} error={q.error} data={q.data} onRetry={() => q.refetch()}>
          {(lecture: Lec) =>
            videoUrl ? (
              <StreamVideo
                ref={videoRef}
                className="lecp__video"
                src={videoUrl}
                playsInline
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  const total = v.duration || lecture.duration_seconds;
                  setDuration(total);
                  // A fresh URL replaced one that ran out: same second, same
                  // playing-or-paused state as before the swap.
                  const reload = reloadRef.current;
                  if (reload) {
                    reloadRef.current = null;
                    v.currentTime = Math.min(reload.at, total);
                    lastTimeRef.current = v.currentTime;
                    if (reload.play) void v.play().catch(() => setPlaying(false));
                    return;
                  }
                  // Resume where the learner left off (the scrubber already
                  // shows that position). Only a video watched to its end
                  // starts over. Being completed is not that: it is permanent,
                  // and re-watching a completed lesson used to restart it on
                  // every visit.
                  const resumeAt = lecture.my_playback?.last_position_seconds ?? 0;
                  const start = resumeAt > 0 && resumeAt < total - RESTART_NEAR_END_SECONDS ? resumeAt : 0;
                  if (start !== resumeAt) setPos(start);
                  // Left on a checkpoint's card: reopen on that card, the
                  // video paused at its second, instead of playing the
                  // fraction of a second up to it and stopping again.
                  const leftOn = checkpointAtResume(checkpoints, start, (c) =>
                    isExcluded(c.interaction_type, lecture.track_id, exclude),
                  );
                  if (leftOn) {
                    v.currentTime = leftOn.at_second;
                    lastTimeRef.current = leftOn.at_second;
                    lastBeatRef.current = leftOn.at_second;
                    setPos(leftOn.at_second);
                    setActive(leftOn);
                    return;
                  }
                  // Seeking to 0 is a no-op that only delays the first frame.
                  if (start > 0) v.currentTime = start;
                  lastTimeRef.current = start;
                  lastBeatRef.current = start;
                  // Opening a lecture starts it. If the browser refuses to
                  // autoplay, bring the controls up so the play button is there.
                  void v.play().catch(() => {
                    setPlaying(false);
                    controls.show();
                  });
                }}
                onTimeUpdate={(e) => onTime(e.currentTarget)}
                onPlay={() => setPlaying(true)}
                onPause={(e) => {
                  setPlaying(false);
                  if (!e.currentTarget.ended) void heartbeat(e.currentTarget.currentTime);
                }}
                onEnded={() => void finish(lecture)}
                // A stream that stopped (its signed URL ran out, or hls.js gave
                // up) gets a fresh URL; until it plays again the controls stay
                // up so the learner is not left on a blank screen.
                onStreamError={() => {
                  controls.show();
                  refreshStream();
                }}
              />
            ) : premiumLocked ? (
              <div className="lecp__gate">
                <div className="lecp__gate-emoji">👑</div>
                <div className="lecp__gate-title">{t("courses.premiumLecture")}</div>
                <Button size="sm" onClick={() => nav("/subscription")}>{t("study.upgrade")}</Button>
              </div>
            ) : playFailed ? (
              <div className="lecp__gate" role="alert">
                <div className="lecp__gate-title">{t("courses.videoLoadError")}</div>
                <Button size="sm" onClick={requestPlay}>{t("common.retry")}</Button>
              </div>
            ) : (
              // While the playback URL loads the stage stays black: the video
              // itself is the first picture, never the lesson's thumbnail.
              <div className="lecp__blank" aria-hidden="true" />
            )
          }
        </Async>
      </div>

      {/* The controls float over the picture and fade out while it plays.
          The layer itself lets taps through to the picture; only its pieces
          take them. Hovering, keyboard focus or dragging inside holds them. */}
      <div
        className="lecp__chrome"
        onFocus={(e) => setFocusInside(e.target instanceof HTMLElement && e.target.matches(":focus-visible"))}
        onBlur={() => setFocusInside(false)}
        onPointerDown={controls.show}
      >
        {/* Behind the controls: dims the picture so they read on any frame,
            and tapping an empty spot of it hides them again. */}
        {videoUrl && <div className="lecp__scrim" onClick={controls.hide} />}

        {/* cp_B_01_topNav: the close glyph at 20, and the exclude switch
            pinned to the right (COU-004 230:7046 / COU-005). */}
        <header className="lecp__nav" {...hoverHold}>
          <button className="lecp__close" onClick={requestClose} aria-label={t("common.close")}>
            <img src={icClose} alt="" aria-hidden="true" />
          </button>
          <label className="lecp__mute">
            <span className="lecp__mute-label">{t(topik ? "courses.excludePractice" : "courses.excludeSpeaking")}</span>
            <input type="checkbox" checked={exclude} onChange={(e) => setExclude(e.target.checked)} />
            <span className="lecp__switch" aria-hidden="true" />
          </label>
        </header>

        {l && (
          <>
              {/* 230:7051 / 230:7053 — the tutor prompt and the 45px mascot open
                  the 물어보기 sheet over the paused video (COU-010). */}
              <button
                {...hoverHold}
                className="lecp__ask"
                onClick={() => {
                  videoRef.current?.pause();
                  setAskOpen(true);
                }}
                aria-label={t("courses.chatbotA11y")}
              >
                {prompt === "showing" && (
                  <span className="lecp__ask-bubble" aria-hidden="true" onAnimationEnd={() => setPrompt("done")}>
                    {t("courses.askBubble")}
                  </span>
                )}
                {/* 230:7053 — a white 45px disc with a 3px gradient ring. */}
                <AskMascot />
              </button>

            <div className="lecp__controls" {...hoverHold}>
              <div className="lecp__times">
                <span>{mmss(pos)}</span>
                <span>{mmss(duration || l.duration_seconds)}</span>
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
                  onPointerDown={() => setScrubbing(true)}
                  onPointerUp={() => setScrubbing(false)}
                  onPointerCancel={() => setScrubbing(false)}
                  onMouseUp={() => void heartbeat(pos)}
                  onTouchEnd={() => void heartbeat(pos)}
                />
              </div>

              <div className="lecp__buttons">
                <button className="lecp__skip" onClick={() => seek(pos - 5)} aria-label={t("courses.back5")}>
                  <img src={playerBack5} alt="" aria-hidden="true" />
                  <span>5</span>
                </button>
                <button className="lecp__play" onClick={togglePlay} aria-label={t(playing ? "courses.pause" : "courses.play")}>
                  {/* ic_64_play: Default (the triangle) while paused, Variant2
                      (784:52239, two bars) while the video plays. */}
                  {playing ? (
                    <span className="lecp__pause" aria-hidden="true">
                      <span className="lecp__pause-bar lecp__pause-bar--left" />
                      <span className="lecp__pause-bar lecp__pause-bar--right" />
                    </span>
                  ) : (
                    <img src={playerPlay} alt="" aria-hidden="true" />
                  )}
                </button>
                <button className="lecp__skip lecp__skip--fwd" onClick={() => seek(pos + 5)} aria-label={t("courses.fwd5")}>
                  <img src={playerFwd5} alt="" aria-hidden="true" />
                  <span>5</span>
                </button>
              </div>

              <button className="lecp__speed" onClick={cycleSpeed} aria-label={t("courses.speedA11y", { rate: String(speed) })}>
                {speed}x
              </button>
            </div>
          </>
        )}
      </div>

      {active && <CheckpointOverlay lectureId={lectureId} checkpoint={active} onClose={closeCheckpoint} />}

      <ChatbotBottomSheet
        open={askOpen}
        source="lecture"
        context={{ kind: "lecture", lecture_id: lectureId }}
        onClose={() => setAskOpen(false)}
      />

      {/* 235:8047, or 1616:25224 once today's goal is already met. */}
      <ConfirmDialog
        open={quitOpen}
        title={<span className="dialog__title-lines">{t(goalMet ? "courses.quitGoalTitle" : "courses.quitTitle")}</span>}
        text={t(goalMet ? "courses.quitGoalText" : "courses.quitText")}
        cancelLabel={t("courses.keepGoing")}
        confirmLabel={t("courses.quitNow")}
        onCancel={() => {
          setQuitOpen(false);
          play();
        }}
        onConfirm={leave}
      />

      {/* COU-009 (750:48385) — the end of the video. */}
      <Dialog
        open={finished !== null}
        title={
          <>
            {t("courses.endTitle")}
            <span className="dialog__title-accent">{t("courses.endWarn")}</span>
          </>
        }
        text={t("courses.endText")}
      >
        <div className="dialog__actions">
          <Button variant="primary" block onClick={continueAfterEnd}>
            {t("courses.endCta")}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
