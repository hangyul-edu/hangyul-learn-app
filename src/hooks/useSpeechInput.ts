import { useCallback, useEffect, useRef, useState } from "react";
import type { Room } from "livekit-client";
import { speechApi } from "../api/endpoints";
import { MAX_RECORDING_MS } from "../lib/recording";
import { encodeClientMessage, parseAgentMessage, type SpokenTake, type SpokenTranscript } from "../lib/speech";
import type { SpeechSessionOpened } from "../lib/types";
import { useVoiceRecorder } from "./useVoiceRecorder";

/**
 * Microphone input for the speaking screens — live when it can be, recorded
 * when it cannot.
 *
 * **Live (realtime).** The microphone is published into a LiveKit room the
 * server opened for this learner. The STT agent in the room hears the
 * speech, decides with Silero VAD where each utterance starts and ends,
 * transcribes it, stores the transcript with the API and sends it back here
 * with its `transcript_id`. A take lasts from `start()` to `stop()` (or the
 * duration limit): every utterance in between is collected — a learner who
 * pauses mid-sentence produces two — and delivered to `onSpoken` together,
 * as the ids the answer endpoints grade. The app never submits text as an
 * answer. `stop()` is final: the microphone is muted at once and the agent
 * is told (`{type:"stop"}`), so it closes the utterance in flight right
 * away instead of waiting out the pause its VAD normally needs; the take
 * then ends as soon as that utterance's transcript (if any) is in.
 *
 * **Recorded (upload).** When the live path is off (`/speech/availability`
 * says so), fails to connect, or breaks mid-screen, the take is recorded with
 * MediaRecorder and delivered as audio for the server to transcribe —
 * exactly what the screens did before. Both takes are graded by the same
 * rules on the server, so a screen does not care which it got.
 *
 * One room per screen: it is opened on the first `start()`, the microphone is
 * unmuted per take and muted between takes, and the session is ended when
 * the screen goes away.
 */
export type SpeechInputPhase = "idle" | "connecting" | "listening" | "speaking" | "processing";
export type SpeechInputMode = "realtime" | "upload";

export type SpeechInput = {
  /** True while a take is in progress (either path). */
  recording: boolean;
  /** Finer state of a live take, for indicators. `idle` between takes. */
  phase: SpeechInputPhase;
  /** Which path the current / last take used; null before the first take. */
  mode: SpeechInputMode | null;
  /** Ask for the microphone and begin a take. */
  start: () => Promise<void>;
  /** End the take now: a live one is closed by the agent and waits only for the transcript of what was heard; a recorded one is handed over. */
  stop: () => void;
};

export type SpeechInputOptions = {
  /** What the learner speaks for — recorded with the session, informational. */
  purpose: "sentence" | "blank" | "study_session" | "conversation";
  /** What the session is about (ids), for diagnostics. */
  context?: Record<string, unknown>;
  /** The finished take: the live transcripts' ids, or the recording to upload. */
  onSpoken: (spoken: SpokenTake) => void | Promise<void>;
  /**
   * A live take ended without the agent hearing any speech (the recorded path
   * reports the same case as the server's `speech.no_speech` instead).
   */
  onNothingHeard?: () => void;
  /** Speech was heard but the agent could not transcribe or store it — a retry, never a verdict. */
  onFailed?: () => void;
  /** The microphone cannot be used: permission refused, no device, or the capture failed. */
  onUnavailable: () => void;
  /** The take stops itself after this long (the server's limit by default). */
  maxDurationMs?: number;
};

/** How long `stop()` waits for the transcript of speech the agent already heard. */
export const TRANSCRIPT_WAIT_MS = 15_000;
/**
 * With nothing heard at `stop()`, how long to wait for the agent's `stopped`
 * reply (speech may have just started) before closing the take as silent —
 * the fallback for a reply that never comes.
 */
export const STOP_GRACE_MS = 1_200;
/** A session is reopened this close to its token's expiry. */
const EXPIRY_MARGIN_MS = 30_000;

type LiveSession = { room: Room; opened: SpeechSessionOpened };

type Utterance = { id: string; text: string; latencyMs: number; provider: string; model: string };

/** A live take in progress. */
type LiveTake = {
  /** Utterances transcribed and stored so far, in the order spoken. */
  utterances: Utterance[];
  /** An utterance the agent heard but could not transcribe or store. */
  failed: boolean;
  /** The agent currently hears the learner speaking. */
  speaking: boolean;
  /** Utterances that ended and whose transcript has not arrived yet. */
  pending: number;
  /** `stop()` was called: the take ends once nothing is in flight. */
  stopping: boolean;
  timers: ReturnType<typeof setTimeout>[];
};

function settled(take: LiveTake): boolean {
  return !take.speaking && take.pending === 0;
}

function combine(take: LiveTake): SpokenTake | null {
  if (take.utterances.length === 0) return null;
  const transcript: SpokenTranscript = {
    transcriptIds: take.utterances.map((u) => u.id),
    text: take.utterances.map((u) => u.text).join(" ").trim(),
    status: "ok",
    latencyMs: Math.max(...take.utterances.map((u) => u.latencyMs)),
    provider: take.utterances[0].provider,
    model: take.utterances[0].model,
  };
  return { transcript };
}

export function useSpeechInput({
  purpose,
  context,
  onSpoken,
  onNothingHeard,
  onFailed,
  onUnavailable,
  maxDurationMs = MAX_RECORDING_MS,
}: SpeechInputOptions): SpeechInput {
  const [phase, setPhase] = useState<SpeechInputPhase>("idle");
  const [mode, setMode] = useState<SpeechInputMode | null>(null);
  const liveRef = useRef<LiveSession | null>(null);
  const takeRef = useRef<LiveTake | null>(null);
  const startingRef = useRef(false);
  const mountedRef = useRef(true);
  // Once the live path has failed on this screen it stays off: a learner
  // mid-exercise should not wait on a reconnect attempt per take.
  const liveDisabledRef = useRef(false);
  const handlers = useRef({ onSpoken, onNothingHeard, onFailed, onUnavailable, purpose, context });
  handlers.current = { onSpoken, onNothingHeard, onFailed, onUnavailable, purpose, context };

  const upload = useVoiceRecorder({
    onRecorded: (audio, take) => handlers.current.onSpoken({ audio, take }),
    onUnavailable: () => handlers.current.onUnavailable(),
    maxDurationMs,
  });

  const clearTake = useCallback(() => {
    const take = takeRef.current;
    takeRef.current = null;
    take?.timers.forEach(clearTimeout);
  }, []);

  const muteMicrophone = useCallback(async () => {
    const live = liveRef.current;
    if (!live) return;
    try {
      await live.room.localParticipant.setMicrophoneEnabled(false);
    } catch {
      /* the room may already be gone */
    }
  }, []);

  /** End the take with whatever it collected. */
  const finishTake = useCallback(() => {
    const take = takeRef.current;
    if (!take) return;
    clearTake();
    // A take ended by `stop()` muted the microphone there; one cut short by
    // a disconnect has not.
    if (!take.stopping) void muteMicrophone();
    if (!mountedRef.current) return;
    setPhase("idle");
    const spoken = combine(take);
    if (spoken) void handlers.current.onSpoken(spoken);
    else if (take.failed) handlers.current.onFailed?.();
    else handlers.current.onNothingHeard?.();
  }, [clearTake, muteMicrophone]);

  const onAgentMessage = useCallback(
    (payload: Uint8Array, topic: string | undefined) => {
      const live = liveRef.current;
      if (!live || topic !== live.opened.data_topic) return;
      const message = parseAgentMessage(payload);
      const take = takeRef.current;
      if (!message || !take) return;
      if (message.type === "vad") {
        if (message.state === "speaking") {
          take.speaking = true;
          if (mountedRef.current) setPhase("speaking");
        } else {
          take.speaking = false;
          take.pending += 1;
          if (mountedRef.current) setPhase("processing");
        }
      } else if (message.type === "transcribing") {
        if (mountedRef.current) setPhase("processing");
      } else if (message.type === "transcript") {
        take.pending = Math.max(0, take.pending - 1);
        if (message.delivered && message.transcript_id && message.status === "ok") {
          take.utterances.push({
            id: message.transcript_id,
            text: message.text,
            latencyMs: message.latency_ms,
            provider: message.provider,
            model: message.model,
          });
        } else if (message.status === "failed" || !message.delivered || !message.transcript_id) {
          // Heard, but not transcribed or not stored: cannot be graded.
          take.failed = true;
        }
        // `no_speech`: the agent heard nothing worth a transcript — not a failure.
        if (take.stopping && settled(take)) finishTake();
        else if (!take.stopping && mountedRef.current) setPhase(take.speaking ? "speaking" : "listening");
      } else if (message.type === "stopped") {
        // Everything up to the stop is accounted for: an utterance it cut
        // short has already been announced (`vad silence`), so if nothing is
        // pending now, nothing is coming.
        if (take.stopping && settled(take)) finishTake();
      }
    },
    [finishTake],
  );

  /** Tell the agent the take is over, so it closes the utterance in flight now. */
  const sendStop = useCallback(async () => {
    const live = liveRef.current;
    if (!live) return;
    try {
      await live.room.localParticipant.publishData(encodeClientMessage({ type: "stop" }), {
        reliable: true,
        topic: live.opened.data_topic,
      });
    } catch {
      /* the room is gone — the timers below still end the take */
    }
  }, []);

  const endLiveSession = useCallback(() => {
    const live = liveRef.current;
    liveRef.current = null;
    if (!live) return;
    void live.room.disconnect().catch(() => undefined);
    void speechApi.endSession(live.opened.session_id).catch(() => undefined);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTake();
      endLiveSession();
    };
  }, [clearTake, endLiveSession]);

  /** The room for this screen — reused across takes, reopened near expiry. */
  const ensureLive = useCallback(async (): Promise<LiveSession | null> => {
    const current = liveRef.current;
    if (current) {
      const expiresAt = Date.parse(current.opened.expires_at);
      const fresh = Number.isNaN(expiresAt) || expiresAt - Date.now() > EXPIRY_MARGIN_MS;
      if (fresh && current.room.state === "connected") return current;
      endLiveSession();
    }
    const availability = await speechApi.availability();
    if (!availability.realtime_available) return null;
    const opened = await speechApi.openSession({ purpose: handlers.current.purpose, context: handlers.current.context });
    const { Room, RoomEvent } = await import("livekit-client");
    const room = new Room({ adaptiveStream: false, dynacast: false });
    room.on(RoomEvent.DataReceived, (payload, _participant, _kind, topic) => onAgentMessage(payload, topic));
    room.on(RoomEvent.Disconnected, () => {
      if (liveRef.current?.room === room) liveRef.current = null;
      // A take cut off by the disconnect ends with what it has.
      if (takeRef.current) finishTake();
    });
    try {
      await room.connect(opened.url, opened.token);
    } catch (e) {
      void speechApi.endSession(opened.session_id).catch(() => undefined);
      throw e;
    }
    if (!mountedRef.current) {
      void room.disconnect().catch(() => undefined);
      void speechApi.endSession(opened.session_id).catch(() => undefined);
      return null;
    }
    const live = { room, opened };
    liveRef.current = live;
    return live;
  }, [endLiveSession, finishTake, onAgentMessage]);

  const start = useCallback(async () => {
    if (takeRef.current || startingRef.current || upload.recording) return;
    startingRef.current = true;
    try {
      let live: LiveSession | null = null;
      if (!liveDisabledRef.current) {
        if (mountedRef.current) setPhase("connecting");
        try {
          live = await ensureLive();
        } catch {
          // Unreachable server, refused session, failed WebRTC connection:
          // this screen records and uploads from here on.
          liveDisabledRef.current = true;
          live = null;
        }
      }
      if (!mountedRef.current) return;
      if (!live) {
        setPhase("idle");
        setMode("upload");
        await upload.start();
        return;
      }
      setMode("realtime");
      const take: LiveTake = {
        utterances: [],
        failed: false,
        speaking: false,
        pending: 0,
        stopping: false,
        timers: [],
      };
      takeRef.current = take;
      try {
        await live.room.localParticipant.setMicrophoneEnabled(true);
      } catch {
        // Permission refused or no device — the same dead end as the recorder's.
        clearTake();
        if (mountedRef.current) {
          setPhase("idle");
          handlers.current.onUnavailable();
        }
        return;
      }
      if (!mountedRef.current || takeRef.current !== take) return;
      setPhase("listening");
      // A take the learner forgets to stop ends at the server's limit.
      take.timers.push(setTimeout(() => stopRef.current(), maxDurationMs));
    } finally {
      startingRef.current = false;
    }
  }, [clearTake, ensureLive, maxDurationMs, upload]);

  const stop = useCallback(() => {
    const take = takeRef.current;
    if (!take) {
      upload.stop();
      return;
    }
    if (take.stopping) return;
    take.stopping = true;
    // The recording is over: the agent closes the utterance in flight now,
    // and the microphone has nothing more to add.
    void sendStop().then(muteMicrophone);
    if (settled(take)) {
      if (take.utterances.length > 0 || take.failed) {
        finishTake();
        return;
      }
      if (mountedRef.current) setPhase("processing");
      // Nothing heard yet: the agent's `stopped` reply settles whether speech
      // had just started; if it never comes, close the take as silent.
      take.timers.push(
        setTimeout(() => {
          if (takeRef.current === take && settled(take)) finishTake();
        }, STOP_GRACE_MS),
      );
    }
    // Speech in flight: its transcript ends the take — within a bound, so a
    // stalled agent never leaves the screen hanging.
    take.timers.push(
      setTimeout(() => {
        if (takeRef.current === take) finishTake();
      }, TRANSCRIPT_WAIT_MS),
    );
  }, [finishTake, muteMicrophone, sendStop, upload]);
  const stopRef = useRef(stop);
  stopRef.current = stop;

  return {
    recording: upload.recording || (phase !== "idle" && takeRef.current !== null) || phase === "connecting",
    phase,
    mode,
    start,
    stop,
  };
}
