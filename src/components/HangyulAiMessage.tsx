import type { ReactNode } from "react";
import { CharacterArt } from "./brand/ProfileAssets";

/**
 * One 한귤AI chat response, rendered as a single overlapped message group:
 * a large foreground avatar and sender name in the upper-left, with a wide
 * cream speech bubble that begins lower and indented to the right (its organic
 * top-left edge tucking behind the avatar). Shared by every Hangyul AI chat
 * surface via ChatSheetView, so the design never drifts between screens.
 *
 * Layout/stacking live in CSS (`.askai__ai*`): avatar (z 3) > name (z 2) >
 * bubble + tail (z 1). Only assistant messages use this; user messages keep
 * their plain right-aligned bubble.
 */
export function HangyulAiMessage({
  children,
  senderName = "한귤AI",
  bubbleClassName,
  bubbleAriaLabel,
}: {
  children: ReactNode;
  senderName?: string;
  /** Extra class on the bubble (e.g. the loading/typing state). */
  bubbleClassName?: string;
  /** Accessible label for non-text bubbles (e.g. the typing indicator). */
  bubbleAriaLabel?: string;
}) {
  return (
    <div className="askai__ai">
      <span className="askai__ai-face" aria-hidden="true">
        <CharacterArt variant="AVATAR_01" fill="100%" />
      </span>
      <span className="askai__ai-name">{senderName}</span>
      <div
        className={`askai__msg askai__msg--ai${bubbleClassName ? ` ${bubbleClassName}` : ""}`}
        aria-label={bubbleAriaLabel}
      >
        {children}
      </div>
    </div>
  );
}
