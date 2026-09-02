import icPlus from "../assets/brand/ic-16-plus.svg";

/**
 * `ic_24_plus` (1:1314) — the add-friend glyph. Figma frames it 16x16 with the
 * 14x14 vector centred inside, stroked 2px in Gray 5. Used by the friend-league
 * empty state (LEG-011 1658:23890) and the Manage Friends header (LEG-012
 * 1815:24373); both were drawing their own path, at different sizes and in a
 * colour the design system does not define.
 */
export function PlusIcon() {
  return <img className="ic-plus" src={icPlus} alt="" aria-hidden="true" width={14} height={14} />;
}
