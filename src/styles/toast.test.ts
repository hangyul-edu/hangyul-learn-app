/**
 * The bottom notice (Figma cp_G_03_toast) as global.css draws it:
 *
 * - the one-line variant (784:51628) is 335x37 with 8/50/9 padding — the
 *   two-line one (300 wide, at least 57 tall) is unchanged;
 * - on a screen with the bottom tab bar it sits 12px above the bar, not over it.
 */
// @ts-expect-error - @types/node is not a dependency; the runner is Node.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CSS: string = readFileSync("src/styles/global.css", "utf8");

/** Declarations of the first rule whose selector is exactly `selector`. */
function rule(selector: string): Record<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`\\n${escaped}\\s*\\{([^}]*)\\}`).exec(CSS);
  if (!match) throw new Error(`no rule for ${selector}`);
  const body = match[1].replace(/\/\*[\s\S]*?\*\//g, "");
  return Object.fromEntries(
    body
      .split(";")
      .map((d: string) => d.trim())
      .filter(Boolean)
      .map((d: string) => {
        const i = d.indexOf(":");
        return [d.slice(0, i).trim(), d.slice(i + 1).trim()];
      }),
  );
}

describe("friend-management rows (LEG-013 / 015 / 016)", () => {
  it("keeps the chip outline inside its 15px padding, as Figma draws it", () => {
    const pill = rule(".fm__pill");
    expect(pill.padding).toBe("0 15px");
    expect(pill.border).toBe("none");
    expect(pill["box-shadow"]).toBe("inset 0 0 0 1.5px #f4f4f5");
  });

  it("rings the no-picture avatar in Gray 3", () => {
    expect(rule(".fm__row-avatar .rank-avatar-char--none")["box-shadow"]).toBe("inset 0 0 0 1px #dbdddf");
  });
});

describe("bottom notice (cp_G_03_toast)", () => {
  it("draws the one-line variant at its Figma size", () => {
    expect(rule(".hg-toast--notice.hg-toast--line")).toMatchObject({
      width: "335px",
      "min-height": "37px",
      padding: "8px 50px 9px",
    });
    // The two-line notice keeps its own size.
    expect(rule(".hg-toast--notice")).toMatchObject({ width: "300px", "min-height": "57px" });
  });

  it("sits above the bottom tab bar instead of over it", () => {
    expect(rule(":root:has(.bottomnav) .hg-toast-wrap").bottom).toBe("calc(var(--nav-total) + 12px)");
  });
});
