/**
 * The microphone must never outlive the screen that opened it.
 *
 * These tests drive the recorder through every way a take can end — finished,
 * stopped by hand, abandoned by unmount, or never started because the device
 * refused — and assert the two things that matter each time: the microphone
 * tracks are stopped, and a take nobody is waiting for is not delivered.
 */
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useVoiceRecorder, type VoiceRecorder } from "./useVoiceRecorder";

/** A microphone track that remembers whether it was handed back. */
function fakeTrack() {
  return { stop: vi.fn(), kind: "audio" };
}

type FakeStream = { getTracks: () => ReturnType<typeof fakeTrack>[] };

function fakeStream(): FakeStream {
  const tracks = [fakeTrack()];
  return { getTracks: () => tracks };
}

/** Records what the component asked of the MediaRecorder API. */
class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = [];
  static failOnConstruct = false;
  static failOnStart = false;

  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  state: "inactive" | "recording" = "inactive";
  stopCalls = 0;

  constructor(public stream: FakeStream) {
    if (FakeMediaRecorder.failOnConstruct) throw new Error("unsupported mimeType");
    FakeMediaRecorder.instances.push(this);
  }

  start() {
    if (FakeMediaRecorder.failOnStart) throw new Error("device vanished");
    this.state = "recording";
  }

  /** What a browser does on stop(): emit the data, then fire onstop. */
  stop() {
    this.stopCalls += 1;
    if (this.state === "inactive") throw new Error("InvalidStateError");
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["audio"], { type: "audio/webm" }) });
    this.onstop?.();
  }

  static get latest(): FakeMediaRecorder {
    return FakeMediaRecorder.instances[FakeMediaRecorder.instances.length - 1];
  }
}

let openedStreams: FakeStream[];
let getUserMedia: ReturnType<typeof vi.fn>;

function useRecorderUnderTest(handlers: {
  onRecorded: (audio: Blob) => void;
  onUnavailable: () => void;
}) {
  return useVoiceRecorder(handlers);
}

/** Mounts the hook and exposes its API to the test. */
function mountRecorder(handlers: {
  onRecorded?: (audio: Blob) => void;
  onUnavailable?: () => void;
} = {}) {
  const api: { current: VoiceRecorder | null } = { current: null };
  function Screen() {
    api.current = useRecorderUnderTest({
      onRecorded: handlers.onRecorded ?? vi.fn(),
      onUnavailable: handlers.onUnavailable ?? vi.fn(),
    });
    return null;
  }
  const view = render(<Screen />);
  return { api, unmount: view.unmount };
}

async function startRecording(api: { current: VoiceRecorder | null }) {
  await act(async () => {
    await api.current!.start();
  });
}

const microphoneTracks = () => openedStreams.flatMap((stream) => stream.getTracks());
const allTracksStopped = () =>
  microphoneTracks().every((track) => track.stop.mock.calls.length > 0);

beforeEach(() => {
  FakeMediaRecorder.instances = [];
  FakeMediaRecorder.failOnConstruct = false;
  FakeMediaRecorder.failOnStart = false;
  openedStreams = [];
  getUserMedia = vi.fn().mockImplementation(async () => {
    const stream = fakeStream();
    openedStreams.push(stream);
    return stream;
  });
  (globalThis as unknown as { MediaRecorder: unknown }).MediaRecorder = FakeMediaRecorder;
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
});

afterEach(() => vi.restoreAllMocks());

describe("a take that finishes normally", () => {
  it("delivers the audio and releases the microphone", async () => {
    const onRecorded = vi.fn();
    const { api } = mountRecorder({ onRecorded });

    await startRecording(api);
    expect(api.current!.recording).toBe(true);

    await act(async () => api.current!.stop());

    expect(onRecorded).toHaveBeenCalledTimes(1);
    expect(onRecorded.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(allTracksStopped()).toBe(true);
    expect(api.current!.recording).toBe(false);
  });

  it("can record again afterwards", async () => {
    const onRecorded = vi.fn();
    const { api } = mountRecorder({ onRecorded });

    await startRecording(api);
    await act(async () => api.current!.stop());
    await startRecording(api);
    await act(async () => api.current!.stop());

    expect(onRecorded).toHaveBeenCalledTimes(2);
    expect(openedStreams).toHaveLength(2);
    expect(allTracksStopped()).toBe(true);
  });
});

describe("stopping by hand", () => {
  it("is harmless when nothing is recording", async () => {
    const onRecorded = vi.fn();
    const { api } = mountRecorder({ onRecorded });

    expect(() => api.current!.stop()).not.toThrow();
    expect(onRecorded).not.toHaveBeenCalled();
  });

  it("ignores a second stop for the same take", async () => {
    const onRecorded = vi.fn();
    const { api } = mountRecorder({ onRecorded });

    await startRecording(api);
    await act(async () => {
      api.current!.stop();
      api.current!.stop(); // double-tap
    });

    expect(onRecorded).toHaveBeenCalledTimes(1);
  });

  it("does not open a second microphone while one take is running", async () => {
    const { api } = mountRecorder();

    await startRecording(api);
    await startRecording(api);

    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });
});

describe("unmounting", () => {
  it("releases the microphone when the screen goes away mid-take", async () => {
    const onRecorded = vi.fn();
    const { api, unmount } = mountRecorder({ onRecorded });
    await startRecording(api);

    act(() => unmount());

    expect(allTracksStopped()).toBe(true);
    expect(FakeMediaRecorder.latest.state).toBe("inactive");
  });

  it("does not deliver a take the learner walked away from", async () => {
    const onRecorded = vi.fn();
    const { api, unmount } = mountRecorder({ onRecorded });
    await startRecording(api);

    act(() => unmount());

    expect(onRecorded).not.toHaveBeenCalled();
  });

  it("is safe once the take has already finished", async () => {
    const onRecorded = vi.fn();
    const { api, unmount } = mountRecorder({ onRecorded });
    await startRecording(api);
    await act(async () => api.current!.stop());
    const stopsBefore = FakeMediaRecorder.latest.stopCalls;

    expect(() => act(() => unmount())).not.toThrow();

    expect(onRecorded).toHaveBeenCalledTimes(1); // not delivered twice
    expect(FakeMediaRecorder.latest.stopCalls).toBe(stopsBefore); // not stopped again
  });

  it("hands back a microphone granted after the screen was gone", async () => {
    // The permission prompt outlives the screen: the stream arrives with
    // nobody left to record for.
    let grant: (stream: FakeStream) => void = () => {};
    getUserMedia.mockImplementation(
      () =>
        new Promise((resolve) => {
          grant = (stream) => resolve(stream);
        }),
    );
    const onRecorded = vi.fn();
    const { api, unmount } = mountRecorder({ onRecorded });

    // Started outside act(): nothing touches React state until the prompt is
    // answered, and overlapping act() calls would break the environment.
    const pending = api.current!.start();
    act(() => unmount());
    const late = fakeStream();
    openedStreams.push(late);
    await act(async () => {
      grant(late);
      await pending;
    });

    expect(late.getTracks()[0].stop).toHaveBeenCalled();
    expect(FakeMediaRecorder.instances).toHaveLength(0); // never started a take
    expect(onRecorded).not.toHaveBeenCalled();
  });
});

describe("when the microphone cannot be used", () => {
  it("reports a refused permission and opens nothing", async () => {
    getUserMedia.mockImplementation(() => Promise.reject(new Error("NotAllowedError")));
    const onUnavailable = vi.fn();
    const { api } = mountRecorder({ onUnavailable });

    await startRecording(api);

    expect(onUnavailable).toHaveBeenCalledTimes(1);
    expect(api.current!.recording).toBe(false);
    expect(FakeMediaRecorder.instances).toHaveLength(0);
  });

  it("releases the microphone when the recorder cannot be created", async () => {
    FakeMediaRecorder.failOnConstruct = true;
    const onUnavailable = vi.fn();
    const { api } = mountRecorder({ onUnavailable });

    await startRecording(api);

    expect(onUnavailable).toHaveBeenCalledTimes(1);
    expect(allTracksStopped()).toBe(true); // the granted stream is handed back
    expect(api.current!.recording).toBe(false);
  });

  it("releases the microphone when the recorder refuses to start", async () => {
    FakeMediaRecorder.failOnStart = true;
    const onUnavailable = vi.fn();
    const { api } = mountRecorder({ onUnavailable });

    await startRecording(api);

    expect(onUnavailable).toHaveBeenCalledTimes(1);
    expect(allTracksStopped()).toBe(true);
    expect(api.current!.recording).toBe(false);
  });

  it("can try again after a failure", async () => {
    getUserMedia.mockImplementationOnce(() => Promise.reject(new Error("NotAllowedError")));
    const onRecorded = vi.fn();
    const onUnavailable = vi.fn();
    const { api } = mountRecorder({ onRecorded, onUnavailable });

    await startRecording(api); // refused
    await startRecording(api); // granted
    await act(async () => api.current!.stop());

    expect(onUnavailable).toHaveBeenCalledTimes(1);
    expect(onRecorded).toHaveBeenCalledTimes(1);
  });
});
