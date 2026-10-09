/**
 * Two chevrons whose placement lives in global.css:
 *
 * - Sign-up's back chevron is absolutely positioned. Its containing block must
 *   be the scrolling content (.signup__inner), not the screen, or it stays
 *   pinned at the top while the form scrolls under it.
 * - League History's season chevron rides inline after the season name, so it
 *   keeps the same 6px gap however long the name is or however it wraps. It
 *   used to hang off the title box's right edge, which a wrapped name left far
 *   from the last line.
 */
// @ts-expect-error - @types/node is not a dependency; the runner is Node.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CSS: string = readFileSync("src/styles/global.css", "utf8");

/** Declarations of the first rule whose selector list is exactly `selector`. */
function rule(selector: string): Record<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Skip a selector that ends a comma-separated list (`a,\nb {`): that is a
  // shared rule, not this selector's own.
  const match = [...CSS.matchAll(new RegExp(`\\n${escaped}\\s*\\{([^}]*)\\}`, "g"))].find(
    (m) => !/,\s*$/.test(CSS.slice(0, m.index)),
  );
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

describe("sign-up back chevron", () => {
  it("is positioned inside the scrolling content, so it scrolls with the form", () => {
    expect(rule(".signup__inner").position).toBe("relative");
    expect(rule(".signup__scroll")["overflow-y"]).toBe("auto");
  });
});

describe("League History season chevron", () => {
  it("rides inline after the name instead of hanging off the title box", () => {
    const chevron = rule(".lh__chevron");
    expect(chevron.position).toBeUndefined();
    expect(chevron.display).toBe("inline-block");
    expect(chevron.left).toBeUndefined();
  });

  it("keeps a fixed 6px gap and adds no width to the centred line", () => {
    // margin: top right bottom left — the -29 cancels the 6px gap + 23px glyph.
    expect(rule(".lh__chevron").margin).toBe("0 -29px 0 6px");
    expect(rule(".lh__chevron").width).toBe("23px");
    expect(rule(".lh__season-name")["text-align"]).toBe("center");
  });
});
