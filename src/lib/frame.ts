/**
 * An element's box in the app frame's coordinates.
 *
 * `.app-frame` is a size container, which also makes it the containing block
 * of every `position: fixed` element inside it (so dims and sheets cover the
 * framed phone on desktop, not the whole window). A fixed popup placed from
 * `getBoundingClientRect()` — window coordinates — must therefore subtract the
 * frame's own offset; on a phone the frame sits at the window's origin and the
 * two agree.
 */
export function rectInFrame(el: Element): { top: number; bottom: number; left: number; right: number; width: number } {
  const r = el.getBoundingClientRect();
  const frame = el.closest(".app-frame")?.getBoundingClientRect();
  const dx = frame?.left ?? 0;
  const dy = frame?.top ?? 0;
  return { top: r.top - dy, bottom: r.bottom - dy, left: r.left - dx, right: r.right - dx, width: r.width };
}
