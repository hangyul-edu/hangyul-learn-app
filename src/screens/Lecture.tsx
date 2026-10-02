import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "../i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../components/ui/kit";
import { ConfirmDialog, Dialog } from "../components/ui/Modal";
import { Async } from "../components/ui/states";
import { ChatbotBottomSheet } from "../components/ChatbotBottomSheet";
import { StreamVideo } from "../components/StreamVideo";
import { CheckpointOverlay } from "../components/lecture/CheckpointOverlay";
import { dashboardApi, learnApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { useMarkStudied } from "../hooks/learningActivity";
import { useAutoHideControls } from "../hooks/useAutoHideControls";
import { ApiError, errorMessage } from "../lib/http";
import { dueCheckpoint, isExcluded } from "../lib/lectureCheckpoints";
import type { LectureCheckpoint, LectureDetail as Lec } from "../lib/types";
import icClose from "../assets/brand/ic-24-close-white.svg";
import playerPlay from "../assets/brand/player-play.svg";
import playerBack5 from "../assets/brand/player-back5.svg";
import playerFwd5 from "../assets/brand/player-fwd5.svg";
import playerKnob from "../assets/brand/player-knob.svg";
import mascotTangerine from "../assets/brand/ask-mascot-tangerine.svg";
import mascotDot868 from "../assets/brand/ask-mascot-dot-868.svg";
import mascotDot878 from "../assets/brand/ask-mascot-dot-878.svg";
import mascotDot879 from "../assets/brand/ask-mascot-dot-879.svg";
import mascotDot881 from "../assets/brand/ask-mascot-dot-881.svg";

/** mm:ss, zero-padded — COU-004 prints both ends of the scrubber that way. */
function fmt(sec: number) {
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
}

/** Playback speeds the speed chip cycles through, shown as "1x", "1.25x"… */
const SPEEDS = [1, 1.25, 1.5, 2] as const;

/**
 * Seconds of playback between progress heartbeats. The server only counts a
 * lecture as watched when its frontier advances in steps of at most 60s, so
 * completion depends on these arriving while the video plays.
 */
export const HEARTBEAT_SECONDS = 15;

/** Navigation state the course page reads to show COU-021's reward. */
export type CourseRewardState = { rewardPoints?: number };

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
  const { t } = useTranslation();
  const { lectureId = "" } = useParams();
  const nav = useNavigate();
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

  const markStudied = useMarkStudied();

  const q = useQuery({ queryKey: ["lecture", lectureId], queryFn: () => learnApi.lecture(lectureId) });
  // Only to pick the quit confirm's wording: "goal already met" vs "a bit left".
  const dashboard = useQuery({ queryKey: ["dashboard"], queryFn: dashboardApi.summary, enabled: quitOpen });

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
  const showControls = controls.show;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") showControls();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showControls]);

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
    try {
      await learnApi.progress(lectureId, Math.floor(seconds));
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
    const end = duration || l.duration_seconds;
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
    }
  }

  function leave() {
    const l = q.data;
    if (l?.course_id) nav(`/courses/${l.course_id}`, { replace: true });
    else nav(-1);
  }

  function continueAfterEnd() {
    const l = q.data;
    const state: CourseRewardState = { rewardPoints: finished?.points ?? 0 };
    if (l?.course_id) nav(`/courses/${l.course_id}`, { replace: true, state });
    else nav(-1);
  }

  function requestClose() {
    if (q.data?.my_playback?.completed || finished || !q.data) {
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
                poster={lecture.thumbnail_url ?? undefined}
                playsInline
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  const total = v.duration || lecture.duration_seconds;
                  setDuration(total);
                  // Resume where the learner left off (the scrubber already
                  // shows that position); a finished lecture starts over.
                  const resumeAt = lecture.my_playback?.last_position_seconds ?? 0;
                  const start = !lecture.my_playback?.completed && resumeAt > 0 && resumeAt < total ? resumeAt : 0;
                  v.currentTime = start;
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
                // A video that cannot load never autoplays; bring the controls
                // up so the learner is not left on a blank screen.
                onError={() => controls.show()}
              />
            ) : premiumLocked ? (
              <div className="lecp__gate">
                <div className="lecp__gate-emoji">👑</div>
                <div className="lecp__gate-title">{t("courses.premiumLecture")}</div>
                <Button size="sm" onClick={() => nav("/subscription")}>{t("study.upgrade")}</Button>
              </div>
            ) : (
              <img className="lecp__poster" src={lecture.thumbnail_url ?? undefined} alt="" />
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
                <span className="lecp__ask-bubble">{t("courses.askBubble")}</span>
                {/* 230:7053 — a white 45px disc with a 3px #FFDC7E ring; the
                    tangerine (turned 9.31°) and its four highlights are clipped
                    to the disc, each at its frame offset. */}
                <span className="lecp__mascot" aria-hidden="true">
                  <span className="lecp__mascot-art">
                    <span className="lecp__mascot-body">
                      <span className="lecp__mascot-turn">
                        <img src={mascotTangerine} alt="" width={45.284} height={53.099} />
                      </span>
                    </span>
                    <img className="lecp__mascot-dot lecp__mascot-dot--868" src={mascotDot868} alt="" />
                    <img className="lecp__mascot-dot lecp__mascot-dot--879" src={mascotDot879} alt="" />
                    <img className="lecp__mascot-dot lecp__mascot-dot--881" src={mascotDot881} alt="" />
                    <img className="lecp__mascot-dot lecp__mascot-dot--878" src={mascotDot878} alt="" />
                  </span>
                </span>
              </button>

            <div className="lecp__controls" {...hoverHold}>
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
