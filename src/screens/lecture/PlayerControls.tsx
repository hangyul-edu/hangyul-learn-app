import type { PointerEvent as ReactPointerEvent } from "react";
import { useTranslation } from "../../i18n";
import { mmss } from "../../lib/format";
import playerPlay from "../../assets/brand/player-play.svg";
import playerBack5 from "../../assets/brand/player-back5.svg";
import playerFwd5 from "../../assets/brand/player-fwd5.svg";
import playerKnob from "../../assets/brand/player-knob.svg";

/** Pointer handlers by which a resting mouse holds the overlaid controls up. */
export type HoverHold = {
  onPointerEnter: (e: ReactPointerEvent) => void;
  onPointerLeave: (e: ReactPointerEvent) => void;
};

/**
 * The player's bottom controls: elapsed / total time, the scrubber, ±5s and
 * play/pause, and the speed chip. Releasing the scrubber reports the position
 * (`onScrubEnd`); dragging holds the controls up (`onScrubbing`).
 */
export function PlayerControls({
  hoverHold,
  pos,
  total,
  playing,
  speed,
  onSeek,
  onTogglePlay,
  onCycleSpeed,
  onScrubbing,
  onScrubEnd,
}: {
  hoverHold: HoverHold;
  pos: number;
  total: number;
  playing: boolean;
  speed: number;
  onSeek: (seconds: number) => void;
  onTogglePlay: () => void;
  onCycleSpeed: () => void;
  onScrubbing: (scrubbing: boolean) => void;
  onScrubEnd: () => void;
}) {
  const { t } = useTranslation();
  /** Fraction of the clip already played, as a percentage of the track. */
  const pct = Math.max(0, Math.min(100, (pos / (total || 1)) * 100));
  return (
    <div className="lecp__controls" {...hoverHold}>
      <div className="lecp__times">
        <span>{mmss(pos)}</span>
        <span>{mmss(total)}</span>
      </div>
      <div className="lecp__track">
        <span className="lecp__track-fill" style={{ width: `${pct}%` }} />
        <img className="lecp__knob" src={playerKnob} alt="" aria-hidden="true" style={{ left: `${pct}%` }} />
        <input
          className="lecp__range"
          type="range"
          min={0}
          max={total}
          step={1}
          value={pos}
          aria-label={t("courses.progress")}
          onChange={(e) => onSeek(Number(e.target.value))}
          onPointerDown={() => onScrubbing(true)}
          onPointerUp={() => onScrubbing(false)}
          onPointerCancel={() => onScrubbing(false)}
          onMouseUp={onScrubEnd}
          onTouchEnd={onScrubEnd}
        />
      </div>

      <div className="lecp__buttons">
        <button className="lecp__skip" onClick={() => onSeek(pos - 5)} aria-label={t("courses.back5")}>
          <img src={playerBack5} alt="" aria-hidden="true" />
          <span>5</span>
        </button>
        <button className="lecp__play" onClick={onTogglePlay} aria-label={t(playing ? "courses.pause" : "courses.play")}>
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
        <button className="lecp__skip lecp__skip--fwd" onClick={() => onSeek(pos + 5)} aria-label={t("courses.fwd5")}>
          <img src={playerFwd5} alt="" aria-hidden="true" />
          <span>5</span>
        </button>
      </div>

      <button className="lecp__speed" onClick={onCycleSpeed} aria-label={t("courses.speedA11y", { rate: String(speed) })}>
        {speed}x
      </button>
    </div>
  );
}
