import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { speechApi, room, RoomEvent } = vi.hoisted(() => {
  const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
  const room = {
    state: "disconnected",
    handlers,
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      (handlers[event] ??= []).push(handler);
      return room;
    }),
    connect: vi.fn(async () => {
      room.state = "connected";
    }),
    disconnect: vi.fn(async () => {
      room.state = "disconnected";
    }),
    localParticipant: {
      setMicrophoneEnabled: vi.fn(async () => undefined),
      publishData: vi.fn(async () => undefined),
    },
    emit(event: string, ...args: unknown[]) {
      for (const handler of handlers[event] ?? []) handler(...args);
    },
  };
  return {
    room,
    RoomEvent: { DataReceived: "dataReceived", Disconnected: "disconnected" },
    speechApi: {
      availability: vi.fn(),
      openSession: vi.fn(),
      endSession: vi.fn(async () => undefined),
      transcripts: vi.fn(),
    },
  };
});
vi.mock("../api/endpoints", () => ({ speechApi }));
vi.mock("livekit-client", () => ({
  Room: vi.fn(function Room() {
    return room;
  }),
  RoomEvent,
}));

import { STOP_GRACE_MS, TRANSCRIPT_WAIT_MS, useSpeechInput } from "./useSpeechInput";

const OPENED = {
  session_id: "spch_1",
  room: "speech-spch_1",
  url: "ws://livekit.test",
  token: "jwt",
  identity: "user_1",
  data_topic: "hangyul.speech",
  expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
  provider: { provider: "whisper_local", model: "large-v3-turbo" },
  agent_online: true,
};

function message(body: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(body));
}

function transcriptMessage(id: string | null, text: string, extra: Record<string, unknown> = {}): Uint8Array {
  return message({
    type: "transcript", utterance_id: `u-${id ?? "x"}`, transcript_id: id, seq: 1, delivered: id !== null, text,
    status: "ok", error: null, provider: "whisper_local", model: "large-v3-turbo", confidence: 0.9,
    latency_ms: 1300, audio_duration_ms: 1800, speech_ms: 900, ...extra,
  });
}

function emit(payload: Uint8Array, topic = "hangyul.speech") {
  act(() => room.emit("dataReceived", payload, undefined, undefined, topic));
}

class MockMediaRecorder {
  static instances: MockMediaRecorder[] = [];
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  state = "inactive";
  mimeType = "audio/webm";
  constructor() {
    MockMediaRecorder.instances.push(this);
  }
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["audio"], { type: "audio/webm" }) });
    this.onstop?.();
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  room.state = "disconnected";
  for (const key of Object.keys(room.handlers)) delete room.handlers[key];
  MockMediaRecorder.instances = [];
  (globalThis as unknown as { MediaRecorder: unknown }).MediaRecorder = MockMediaRecorder;
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) },
  });
  speechApi.availability.mockResolvedValue({ realtime_available: true, livekit_configured: true, agent_online: true });
  speechApi.openSession.mockResolvedValue(OPENED);
});
afterEach(() => vi.useRealTimers());

function setup(overrides: Partial<Parameters<typeof useSpeechInput>[0]> = {}) {
  const onSpoken = vi.fn();
  const onNothingHeard = vi.fn();
  const onUnavailable = vi.fn();
  const hook = renderHook(() =>
    useSpeechInput({ purpose: "sentence", onSpoken, onNothingHeard, onUnavailable, ...overrides }),
  );
  return { ...hook, onSpoken, onNothingHeard, onUnavailable };
}

describe("useSpeechInput — live path", () => {
  it("opens a session, streams the microphone and delivers the agent's transcript by id", async () => {
    const { result, onSpoken } = setup();
    await act(async () => {
      await result.current.start();
    });

    expect(speechApi.openSession).toHaveBeenCalledWith({ purpose: "sentence", context: undefined });
    expect(room.connect).toHaveBeenCalledWith("ws://livekit.test", "jwt");
    expect(room.localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(true);
    expect(result.current.mode).toBe("realtime");
    expect(result.current.recording).toBe(true);
    expect(result.current.phase).toBe("listening");

    emit(message({ type: "vad", state: "speaking" }));
    expect(result.current.phase).toBe("speaking");
    emit(message({ type: "vad", state: "silence", speech_ms: 900 }));
    expect(result.current.phase).toBe("processing");
    emit(transcriptMessage("trn_1", "안녕하세요"));
    // The learner has not stopped: the take keeps listening for more.
    expect(onSpoken).not.toHaveBeenCalled();
    expect(result.current.phase).toBe("listening");

    act(() => result.current.stop());
    await waitFor(() => expect(onSpoken).toHaveBeenCalledTimes(1));
    expect(onSpoken).toHaveBeenCalledWith({
      transcript: { transcriptIds: ["trn_1"], text: "안녕하세요", status: "ok", latencyMs: 1300, provider: "whisper_local", model: "large-v3-turbo" },
    });
    expect(room.localParticipant.setMicrophoneEnabled).toHaveBeenLastCalledWith(false);
    expect(result.current.recording).toBe(false);
    expect(result.current.phase).toBe("idle");
    // No MediaRecorder was involved.
    expect(MockMediaRecorder.instances).toHaveLength(0);
  });

  it("a sentence spoken with a pause is one take with two transcripts, in order", async () => {
    const { result, onSpoken } = setup();
    await act(async () => {
      await result.current.start();
    });
    emit(message({ type: "vad", state: "speaking" }));
    emit(message({ type: "vad", state: "silence", speech_ms: 1200 }));
    emit(transcriptMessage("trn_a", "반가워요 같은 조니까 앞으로는", { latency_ms: 4000 }));
    emit(message({ type: "vad", state: "speaking" }));
    // Stopped while the second half is still being transcribed: the take waits for it.
    emit(message({ type: "vad", state: "silence", speech_ms: 900 }));
    act(() => result.current.stop());
    expect(onSpoken).not.toHaveBeenCalled();
    emit(transcriptMessage("trn_b", "말 편하게 해도 괜찮지?", { latency_ms: 5000 }));
    await waitFor(() => expect(onSpoken).toHaveBeenCalledTimes(1));
    const spoken = onSpoken.mock.calls[0][0].transcript;
    expect(spoken.transcriptIds).toEqual(["trn_a", "trn_b"]);
    expect(spoken.text).toBe("반가워요 같은 조니까 앞으로는 말 편하게 해도 괜찮지?");
    expect(spoken.latencyMs).toBe(5000);
  });

  it("ignores messages on other topics and reuses the room for the next take", async () => {
    const { result, onSpoken } = setup();
    await act(async () => {
      await result.current.start();
    });
    emit(transcriptMessage("x", "무시"), "other.topic");
    emit(transcriptMessage("trn_2", "네"));
    act(() => result.current.stop());
    await waitFor(() => expect(onSpoken).toHaveBeenCalledTimes(1));
    expect(onSpoken.mock.calls[0][0].transcript.transcriptIds).toEqual(["trn_2"]);

    await act(async () => {
      await result.current.start();
    });
    expect(speechApi.openSession).toHaveBeenCalledTimes(1);
    expect(room.connect).toHaveBeenCalledTimes(1);
    expect(room.localParticipant.setMicrophoneEnabled).toHaveBeenCalledTimes(3); // on, off, on
  });

  it("a transcript the agent could not store is a failure to retry, not an answer", async () => {
    const onFailed = vi.fn();
    const { result, onSpoken, onNothingHeard } = setup({ onFailed });
    await act(async () => {
      await result.current.start();
    });
    emit(transcriptMessage(null, "안녕하세요"));
    act(() => result.current.stop());
    await waitFor(() => expect(onFailed).toHaveBeenCalledTimes(1));
    expect(onSpoken).not.toHaveBeenCalled();
    expect(onNothingHeard).not.toHaveBeenCalled();
    expect(result.current.recording).toBe(false);
  });

  it("stop() tells the agent the take is over and mutes the microphone at once", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      result.current.stop();
    });
    expect(room.localParticipant.publishData).toHaveBeenCalledTimes(1);
    const [payload, options] = room.localParticipant.publishData.mock.calls[0] as unknown as [
      Uint8Array,
      { topic: string; reliable: boolean },
    ];
    expect(JSON.parse(new TextDecoder().decode(payload))).toEqual({ type: "stop" });
    expect(options).toEqual({ reliable: true, topic: "hangyul.speech" });
    expect(room.localParticipant.setMicrophoneEnabled).toHaveBeenLastCalledWith(false);
  });

  it("stop() with nothing heard ends the take as soon as the agent confirms nothing was in flight", async () => {
    vi.useFakeTimers();
    const { result, onSpoken, onNothingHeard } = setup();
    await act(async () => {
      await result.current.start();
    });
    act(() => result.current.stop());
    expect(result.current.phase).toBe("processing");
    expect(onNothingHeard).not.toHaveBeenCalled();
    emit(message({ type: "stopped", in_flight: 0 }));
    expect(onNothingHeard).toHaveBeenCalledTimes(1);
    expect(onSpoken).not.toHaveBeenCalled();
    expect(result.current.recording).toBe(false);
  });

  it("stop() with nothing heard and no reply from the agent reports silence after a short grace period", async () => {
    vi.useFakeTimers();
    const { result, onSpoken, onNothingHeard } = setup();
    await act(async () => {
      await result.current.start();
    });
    act(() => result.current.stop());
    expect(onNothingHeard).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(STOP_GRACE_MS + 100);
    });
    expect(onNothingHeard).toHaveBeenCalledTimes(1);
    expect(onSpoken).not.toHaveBeenCalled();
    expect(result.current.recording).toBe(false);
  });

  it("stop() mid-utterance: the agent closes it on request and its transcript ends the take", async () => {
    vi.useFakeTimers();
    const { result, onSpoken, onNothingHeard } = setup();
    await act(async () => {
      await result.current.start();
    });
    emit(message({ type: "vad", state: "speaking" }));
    act(() => result.current.stop());
    // The agent ends the utterance at once (no 1.1 s pause), announces it and
    // confirms the stop while the transcript is still being made.
    emit(message({ type: "vad", state: "silence", speech_ms: 700 }));
    emit(message({ type: "stopped", in_flight: 1 }));
    expect(onSpoken).not.toHaveBeenCalled();
    expect(onNothingHeard).not.toHaveBeenCalled();
    emit(transcriptMessage("trn_cut", "합의됐습니다"));
    expect(onSpoken).toHaveBeenCalledTimes(1);
    expect(onSpoken.mock.calls[0][0].transcript.transcriptIds).toEqual(["trn_cut"]);
    expect(result.current.recording).toBe(false);
  });

  it("stop() after speech waits for the transcript, bounded", async () => {
    vi.useFakeTimers();
    const { result, onSpoken, onNothingHeard } = setup();
    await act(async () => {
      await result.current.start();
    });
    emit(message({ type: "vad", state: "speaking" }));
    act(() => result.current.stop());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    expect(onNothingHeard).not.toHaveBeenCalled();
    emit(message({ type: "vad", state: "silence", speech_ms: 500 }));
    emit(transcriptMessage("trn_3", "네"));
    expect(onSpoken).toHaveBeenCalledTimes(1);

    // A stalled agent never leaves the screen hanging.
    await act(async () => {
      await result.current.start();
    });
    emit(message({ type: "vad", state: "speaking" }));
    act(() => result.current.stop());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TRANSCRIPT_WAIT_MS + 10);
    });
    expect(onNothingHeard).toHaveBeenCalledTimes(1);
  });

  it("a refused microphone is reported as unavailable", async () => {
    room.localParticipant.setMicrophoneEnabled.mockRejectedValueOnce(new Error("NotAllowedError"));
    const { result, onUnavailable } = setup();
    await act(async () => {
      await result.current.start();
    });
    expect(onUnavailable).toHaveBeenCalledTimes(1);
    expect(result.current.recording).toBe(false);
  });

  it("ends the session when the screen goes away", async () => {
    const { result, unmount } = setup();
    await act(async () => {
      await result.current.start();
    });
    unmount();
    expect(room.disconnect).toHaveBeenCalled();
    expect(speechApi.endSession).toHaveBeenCalledWith("spch_1");
  });
});

describe("useSpeechInput — recorded fallback", () => {
  it("records with MediaRecorder when the live path is off", async () => {
    speechApi.availability.mockResolvedValue({ realtime_available: false, livekit_configured: false, agent_online: false });
    const { result, onSpoken } = setup();
    await act(async () => {
      await result.current.start();
    });
    expect(speechApi.openSession).not.toHaveBeenCalled();
    expect(result.current.mode).toBe("upload");
    expect(MockMediaRecorder.instances).toHaveLength(1);
    expect(result.current.recording).toBe(true);

    act(() => result.current.stop());
    await waitFor(() => expect(onSpoken).toHaveBeenCalledTimes(1));
    const spoken = onSpoken.mock.calls[0][0];
    expect(spoken.audio).toBeInstanceOf(Blob);
    expect(spoken.take.filename).toBe("attempt.webm");
    expect(spoken.transcript).toBeUndefined();
  });

  it("falls back to recording when the session cannot be opened, and stays there", async () => {
    speechApi.openSession.mockRejectedValue(new Error("503"));
    const { result } = setup();
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.mode).toBe("upload");
    expect(MockMediaRecorder.instances).toHaveLength(1);
    act(() => result.current.stop());

    await act(async () => {
      await result.current.start();
    });
    expect(speechApi.availability).toHaveBeenCalledTimes(1);
    expect(MockMediaRecorder.instances).toHaveLength(2);
  });

  it("falls back to recording when the WebRTC connection fails", async () => {
    room.connect.mockRejectedValueOnce(new Error("ice failed"));
    const { result } = setup();
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.mode).toBe("upload");
    expect(speechApi.endSession).toHaveBeenCalledWith("spch_1");
  });
});
