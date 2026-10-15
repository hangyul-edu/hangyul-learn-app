import { useRef, useState, type RefObject } from "react";

/**
 * Pointer drag-to-reorder for a vertical list whose children are the rows.
 * While dragging, the held row follows the pointer and the rows it passes
 * shift by one row's stride; on release `onDrop(from, to)` runs — or
 * `onCancel` when it was let go where it started.
 */
export function useDragReorder({
  listRef,
  enabled,
  onDrop,
  onCancel,
}: {
  listRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  onDrop: (from: number, to: number) => void;
  onCancel: () => void;
}) {
  const dragIdxRef = useRef<number | null>(null);
  const targetRef = useRef<number | null>(null);
  const startRef = useRef({ y: 0, rects: [] as DOMRect[], stride: 0 });
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);
  const [dragDy, setDragDy] = useState(0);
  // The window listeners outlive the render that added them: read the latest.
  const handlers = useRef({ onDrop, onCancel });
  handlers.current = { onDrop, onCancel };

  function onMove(e: PointerEvent) {
    const di = dragIdxRef.current;
    if (di == null) return;
    const { y, rects } = startRef.current;
    const dy = e.clientY - y;
    setDragDy(dy);
    const center = rects[di].top + rects[di].height / 2 + dy;
    let target = di;
    for (let j = 0; j < rects.length; j++) {
      const c = rects[j].top + rects[j].height / 2;
      if (j < di && center < c) {
        target = j;
        break;
      }
      if (j > di && center > c) target = j;
    }
    targetRef.current = target;
    setTargetIndex(target);
  }

  function onUp() {
    window.removeEventListener("pointermove", onMove);
    const di = dragIdxRef.current;
    const target = targetRef.current;
    dragIdxRef.current = null;
    targetRef.current = null;
    setDragIndex(null);
    setTargetIndex(null);
    setDragDy(0);
    if (di == null || target == null || target === di) handlers.current.onCancel();
    else handlers.current.onDrop(di, target);
  }

  function beginDrag(e: React.PointerEvent, index: number) {
    if (!enabled || (e.button != null && e.button !== 0)) return;
    e.preventDefault();
    const rows = Array.from(listRef.current?.children ?? []) as HTMLElement[];
    const rects = rows.map((el) => el.getBoundingClientRect());
    startRef.current = { y: e.clientY, rects, stride: rects.length > 1 ? rects[1].top - rects[0].top : 0 };
    dragIdxRef.current = index;
    targetRef.current = index;
    setDragIndex(index);
    setTargetIndex(index);
    setDragDy(0);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  }

  /** The vertical offset (px) row `i` is drawn at right now. */
  function itemTransform(i: number): number {
    if (dragIndex == null || targetIndex == null) return 0;
    if (i === dragIndex) return dragDy;
    const s = startRef.current.stride;
    if (dragIndex < targetIndex && i > dragIndex && i <= targetIndex) return -s;
    if (dragIndex > targetIndex && i < dragIndex && i >= targetIndex) return s;
    return 0;
  }

  return {
    dragIndex,
    targetIndex,
    beginDrag,
    itemTransform,
    /** A drag is under way (server data must not reshuffle the rows). */
    isDragging: () => dragIdxRef.current != null,
  };
}
