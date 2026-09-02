import icBookmarkOff from "../assets/brand/ic-card-bookmark.svg";
import icBookmarkOn from "../assets/brand/ic-24-bookmark-filled.svg";

/**
 * The save/favorite control on a session card — Figma's `ic_24_text` (267:7169).
 *
 * Both states are real Figma exports of Group 427318316, rendered at the group's
 * own 19.5 x 22.25: saved is the solid #FF7D36 bookmark (TAL-045 3287:37234, byte
 * for byte the asset used in the Saved list), unsaved the white bookmark with the
 * #ADB4BA outline and plus. Nothing here is hand-drawn, and the control carries no
 * container, border, background or shadow — Figma ships a bare icon.
 *
 * Placement differs per card and belongs to the card's own CSS: the TOPIK head
 * (.tq-head) seats the full 24x24 component flush to the content edge, while the
 * conversation card (.sess__card-top) pins the bare 18 x 21.5 glyph box.
 */
export function SaveBookmarkButton({
  saved,
  onToggle,
  label,
}: {
  saved: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button className="sess__bookmark" onClick={onToggle} aria-label={label} aria-pressed={saved}>
      <img
        className="sess__bookmark-ic"
        src={saved ? icBookmarkOn : icBookmarkOff}
        alt=""
        aria-hidden="true"
        width={19.5}
        height={22.25}
      />
    </button>
  );
}
