/**
 * The Friend League (LEG-010) values that live in global.css, as the frame
 * gives them (KO 1:4259 / EN 798:77164):
 *
 * - the podium blocks are flat colours: the darker right-hand strips of an
 *   earlier version are gone;
 * - the champion's avatar is shadowed 0/6.667/6.667 like its group (it had none);
 * - the viewer's row sits on a 60-tall band from 3px above to 7px below it
 *   (Rectangle 25848), not a 50-tall background its avatar filled edge to edge;
 * - the medal is a column of its own at x=286, 16.5px down each row;
 * - the no-picture glyph is inset 18.75% from the top, i.e. 1.93% of its own
 *   height above centre (it had been pushed 4% below).
 */
// @ts-expect-error - @types/node is not a dependency; the runner is Node.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CSS: string = readFileSync("src/styles/global.css", "utf8");

/** Declarations of the first rule whose selector is exactly `selector` (a whole selector list). */
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

describe("Friend League stylesheet (LEG-010)", () => {
  it("draws the podium blocks without the old strips", () => {
    expect(CSS).not.toContain(".fl__strip");
    expect(rule(".fl__block")["box-shadow"]).toBe("0 4px 4px rgba(0, 0, 0, 0.25)");
  });

  it("shadows the champion like its Figma group", () => {
    const shadow = rule(
      ".fl__podium-avatar--r1 > *,\n.fl__podium-avatar--r2 > .rank-avatar-char--none,\n.fl__podium-avatar--r3 > .rank-avatar-char--none",
    );
    expect(shadow["box-shadow"]).toBe("0 6.667px 6.667px rgba(0, 0, 0, 0.25)");
  });

  it("puts the viewer's row on a 60-tall band around it", () => {
    const band = rule(".fl__row.is-me::before");
    expect([band.top, band.bottom, band.left, band.right]).toEqual(["-3px", "-7px", "-6px", "-6px"]);
    expect(band.background).toBe("rgba(255, 103, 0, 0.2)");
    // The band is drawn behind the row, inside the list's own stacking context.
    expect(band["z-index"]).toBe("-1");
    expect(rule(".fl__ranks").isolation).toBe("isolate");
    expect(rule(".fl__row").position).toBe("relative");
  });

  it("keeps the medal in a column of its own", () => {
    expect(rule(".fl__row .rank-medal")).toMatchObject({ position: "absolute", right: "66px", top: "16.5px" });
  });

  it("insets the no-picture glyph as the component does", () => {
    expect(rule(".rank-avatar__placeholder").transform).toBe("translateY(-1.93%)");
  });
});
