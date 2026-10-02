import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { CONTROLS_HIDE_MS, useAutoHideControls } from "./useAutoHideControls";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const render = (props: { playing: boolean; held: boolean }) =>
  renderHook((p) => useAutoHideControls(p), { initialProps: props });

describe("useAutoHideControls", () => {
  it("starts hidden and appears only when asked for", () => {
    const { result } = render({ playing: true, held: false });
    expect(result.current.visible).toBe(false);
    act(() => result.current.toggle()); // the tap on the picture
    expect(result.current.visible).toBe(true);
  });

  it("hides again after a quiet spell while the video plays", () => {
    const { result } = render({ playing: true, held: false });
    act(() => result.current.toggle());
    act(() => vi.advanceTimersByTime(CONTROLS_HIDE_MS - 1));
    expect(result.current.visible).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.visible).toBe(false);
  });

  it("stays up while paused once shown, and pausing alone never shows them", () => {
    const { result, rerender } = render({ playing: true, held: false });
    rerender({ playing: false, held: false });
    expect(result.current.visible).toBe(false);
    act(() => result.current.toggle());
    act(() => vi.advanceTimersByTime(CONTROLS_HIDE_MS * 3));
    expect(result.current.visible).toBe(true);
  });

  it("stays up while held, and counts again once released", () => {
    const { result, rerender } = render({ playing: true, held: false });
    act(() => result.current.show());
    rerender({ playing: true, held: true });
    act(() => vi.advanceTimersByTime(CONTROLS_HIDE_MS * 3));
    expect(result.current.visible).toBe(true);
    rerender({ playing: true, held: false });
    act(() => vi.advanceTimersByTime(CONTROLS_HIDE_MS));
    expect(result.current.visible).toBe(false);
  });

  it("being held never brings hidden controls back", () => {
    const { result, rerender } = render({ playing: true, held: false });
    rerender({ playing: true, held: true });
    expect(result.current.visible).toBe(false);
  });

  it("restarts the count on interaction", () => {
    const { result } = render({ playing: true, held: false });
    act(() => result.current.show());
    act(() => vi.advanceTimersByTime(CONTROLS_HIDE_MS - 500));
    act(() => result.current.show());
    act(() => vi.advanceTimersByTime(CONTROLS_HIDE_MS - 500));
    expect(result.current.visible).toBe(true);
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.visible).toBe(false);
  });

  it("a second tap hides them", () => {
    const { result } = render({ playing: true, held: false });
    act(() => result.current.toggle());
    act(() => result.current.toggle());
    expect(result.current.visible).toBe(false);
  });
});
