import { describe, expect, it } from "vitest";
import {
  CONVERSATION_LEVELS,
  CONVERSATION_LEVEL_MAX,
  CONVERSATION_LEVEL_MIN,
  TOPIK_GRADES,
  TOPIK_GRADE_MAX,
  TOPIK_GRADE_MIN,
} from "./levels";

describe("learning level scales", () => {
  it("keeps conversation on 1..10 and TOPIK on 1..6", () => {
    expect([CONVERSATION_LEVEL_MIN, CONVERSATION_LEVEL_MAX]).toEqual([1, 10]);
    expect([TOPIK_GRADE_MIN, TOPIK_GRADE_MAX]).toEqual([1, 6]);
    expect(CONVERSATION_LEVELS).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(TOPIK_GRADES).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("does not let TOPIK expose conversation-only levels", () => {
    for (const level of [7, 8, 9, 10]) {
      expect(CONVERSATION_LEVELS).toContain(level);
      expect(TOPIK_GRADES).not.toContain(level);
    }
  });
});
