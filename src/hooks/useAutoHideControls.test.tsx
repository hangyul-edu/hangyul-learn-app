import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { CONTROLS_HIDE_MS, useAutoHideControls } from "./useAutoHideControls";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const render = (props: { playing: boolean; held: boolean }) =>
  renderHook((p) => useAutoHideControls(p), { initialProps: props });

describe("useAutoHideControls", () => {
  it("hides the controls after a quiet spell while the video plays", () => {
    const { result } = render({ playing: true, held: false });
    expect(result.current.visible).toBe(true);
    act(() => vi.advanceTimersByTime(CONTROLS_HIDE_MS - 1));
    expect(result.current.visible).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.visible).toBe(false);
  });

  it("keeps them up while paused", () => {
    const { result } = render({ playing: false, held: false });
    act(() => vi.advanceTimersByTime(CONTROLS_HIDE_MS * 3));
    expect(result.current.visible).toBe(true);
  });

  it("brings them back when playback pauses", () => {
    const { result, rerender } = render({ playing: true, held: false });
    act(() => vi.advanceTimersByTime(CONTROLS_HIDE_MS));
    expect(result.current.visible).toBe(false);
    rerender({ playing: false, held: false });
    expect(result.current.visible).toBe(true);
  });

  it("keeps them up while held, and counts again once released", () => {
    const { result, rerender } = render({ playing: true, held: true });
    act(() => vi.advanceTimersByTime(CONTROLS_HIDE_MS * 3));
    expect(result.current.visible).toBe(true);
    rerender({ playing: true, held: false });
    act(() => vi.advanceTimersByTime(CONTROLS_HIDE_MS));
    expect(result.current.visible).toBe(false);
  });

  it("restarts the count on interaction", () => {
    const { result } = render({ playing: true, held: false });
    act(() => vi.advanceTimersByTime(CONTROLS_HIDE_MS - 500));
    act(() => result.current.show());
    act(() => vi.advanceTimersByTime(CONTROLS_HIDE_MS - 500));
    expect(result.current.visible).toBe(true);
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.visible).toBe(false);
  });

  it("toggles on a tap of the picture", () => {
    const { result } = render({ playing: true, held: false });
    act(() => result.current.toggle());
    expect(result.current.visible).toBe(false);
    act(() => result.current.toggle());
    expect(result.current.visible).toBe(true);
  });
});
