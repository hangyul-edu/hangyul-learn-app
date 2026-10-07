import { describe, expect, it } from "vitest";
import { checkpointAtResume, dueCheckpoint, isExcluded } from "./lectureCheckpoints";
import type { LectureCheckpoint } from "./types";

const CPS: LectureCheckpoint[] = [
  { checkpoint_id: "a", interaction_type: "speaking_exercise", at_second: 10 },
  { checkpoint_id: "b", interaction_type: "multiple_choice", at_second: 30 },
];
const keep = () => false;

describe("dueCheckpoint", () => {
  it("fires when continuous playback crosses the checkpoint second", () => {
    expect(dueCheckpoint(CPS, 9.8, 10.05, keep)?.checkpoint_id).toBe("a");
    // The next tick, after the modal closes and playback resumes, is past it.
    expect(dueCheckpoint(CPS, 10.05, 10.3, keep)).toBeNull();
  });

  it("does not fire checkpoints jumped over by a seek or a skip", () => {
    expect(dueCheckpoint(CPS, 8, 13, keep)).toBeNull();
    expect(dueCheckpoint(CPS, 40, 9, keep)).toBeNull();
  });

  it("does not fire one the switch excludes", () => {
    expect(dueCheckpoint(CPS, 29.9, 30.1, (c) => c.interaction_type === "multiple_choice")).toBeNull();
  });

  it("fires again when the learner rewinds and plays through it", () => {
    // Regression: a checkpoint was fired once per visit, so after rewinding
    // (or switching the exclude switch back off) its modal never came back.
    expect(dueCheckpoint(CPS, 9.8, 10.05, keep)?.checkpoint_id).toBe("a");
    expect(dueCheckpoint(CPS, 12, 6, keep)).toBeNull(); // the rewind itself
    expect(dueCheckpoint(CPS, 9.8, 10.05, keep)?.checkpoint_id).toBe("a");
  });

  it("fires a checkpoint at 0 on the first tick", () => {
    const zero: LectureCheckpoint[] = [{ checkpoint_id: "z", interaction_type: "short_answer", at_second: 0 }];
    expect(dueCheckpoint(zero, 0, 0.2, keep)?.checkpoint_id).toBe("z");
  });
});

describe("isExcluded", () => {
  it("skips speaking on a conversation lecture and questions on a TOPIK lecture", () => {
    expect(isExcluded("speaking_exercise", "track_conversation", true)).toBe(true);
    expect(isExcluded("multiple_choice", "track_conversation", true)).toBe(false);
    expect(isExcluded("multiple_choice", "track_topik", true)).toBe(true);
    expect(isExcluded("short_answer", "track_topik", true)).toBe(true);
    expect(isExcluded("speaking_exercise", "track_topik", true)).toBe(false);
    expect(isExcluded("speaking_exercise", "track_conversation", false)).toBe(false);
  });
});

describe("checkpointAtResume", () => {
  const at = (s: number) => [{ checkpoint_id: "c", interaction_type: "speaking_exercise" as const, at_second: s }];

  it("finds the checkpoint inside the second the saved position was rounded down from", () => {
    expect(checkpointAtResume(at(48.4), 48, keep)?.checkpoint_id).toBe("c");
    expect(checkpointAtResume(at(48), 48, keep)?.checkpoint_id).toBe("c");
  });

  it("ignores checkpoints a second or more away, a start from 0, and excluded ones", () => {
    expect(checkpointAtResume(at(49), 48, keep)).toBeNull();
    expect(checkpointAtResume(at(47.9), 48, keep)).toBeNull();
    expect(checkpointAtResume(at(0.4), 0, keep)).toBeNull();
    expect(checkpointAtResume(at(48.4), 48, () => true)).toBeNull();
  });
});
