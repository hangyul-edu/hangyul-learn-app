import { describe, expect, it } from "vitest";
import { passwordProblem } from "./validation";

// The server (src/modules/auth/application/password_policy.py) uses Python's
// Unicode-aware str.isalnum and counts code points. Anything accepted here must
// also pass there, or the learner gets the server's untranslated error.
describe("passwordProblem", () => {
  it("accepts letters + digits + a special character within 8–64", () => {
    expect(passwordProblem("abcd123!")).toBeNull();
  });

  it("rejects the wrong length or a missing class", () => {
    expect(passwordProblem("ab12!")).toBe("validation.passwordLength");
    expect(passwordProblem("a1!" + "x".repeat(62))).toBe("validation.passwordLength");
    expect(passwordProblem("abcdefgh!")).toBe("validation.passwordComposition");
    expect(passwordProblem("abcd1234")).toBe("validation.passwordComposition");
  });

  it("does not count Hangul as the special character", () => {
    // The server's isalnum() is true for Hangul, so this has no special char.
    expect(passwordProblem("abcd1234한")).toBe("validation.passwordComposition");
  });

  it("measures length in characters, not UTF-16 units", () => {
    // 62 code points; each emoji is two UTF-16 units, so .length would be 64+.
    const p = "a1" + "😀".repeat(60);
    expect(passwordProblem(p)).toBeNull();
  });
});
