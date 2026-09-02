import { describe, it, expect } from "vitest";
import { cleanSvg } from "./clean-figma-svg.mjs";

const wrap = (box, body) =>
  `<svg width="${box[0]}" height="${box[1]}" viewBox="0 0 ${box[0]} ${box[1]}" fill="none" xmlns="http://www.w3.org/2000/svg">\n${body}\n</svg>`;

describe("cleanSvg", () => {
  it("drops the Figma canvas fill and the parent screen background", () => {
    const svg = wrap(
      [58, 58],
      [
        '<rect width="58" height="58" fill="#F5F5F5"/>',
        '<rect width="375" height="812" fill="#FFF8F1"/>',
        '<circle id="Ellipse 959" cx="29" cy="29" r="12" fill="#FF6700"/>',
      ].join("\n"),
    );
    const { svg: out, removed } = cleanSvg(svg);
    expect(removed).toBe(2);
    expect(out).not.toContain("#F5F5F5");
    expect(out).not.toContain("#FFF8F1");
    expect(out).toContain("Ellipse 959");
  });

  it("drops the giant Section frame outline", () => {
    const svg = wrap(
      [58, 58],
      '<path d="M-1240 11694L-9051 11734L11694 -1240Z" fill="#fff"/>\n<path id="Subtract_2" d="M4 4L54 54Z" fill="#FFCFA3"/>',
    );
    const { svg: out, removed } = cleanSvg(svg);
    expect(removed).toBe(1);
    expect(out).toContain("Subtract_2");
  });

  it("keeps a frame-filling card that carries a layer id", () => {
    // The lecture tile's yellow card is 64.46x50.26 inside a 65x51 frame (99%)
    // and is real artwork — "covers the frame" alone must not condemn a rect.
    const svg = wrap(
      [65, 51],
      '<rect id="Rectangle 25747" width="64.4592" height="50.2563" rx="6" fill="#FFD04A"/>',
    );
    const { removed } = cleanSvg(svg);
    expect(removed).toBe(0);
  });

  it("keeps artwork whose layer name contains a large number", () => {
    // Regression: an unanchored `d="` lookup matches inside `id="Vector 1195"`,
    // so the layer counter was read as a coordinate and the path deleted.
    const svg = wrap(
      [52.4532, 51.583],
      '<path id="Vector 1195" d="M51.75 38.77L32.32 22.56Z" stroke="#FF5000"/>',
    );
    const { svg: out, removed } = cleanSvg(svg);
    expect(removed).toBe(0);
    expect(out).toContain("Vector 1195");
  });

  it("does not read stroke-width as the rect's width", () => {
    // Regression: an unanchored `width="` lookup matches inside `stroke-width="`.
    const svg = wrap(
      [100, 100],
      '<rect stroke-width="200" stroke-height="200" width="20" height="20" fill="#FF6700"/>',
    );
    const { removed } = cleanSvg(svg);
    expect(removed).toBe(0);
  });

  it("drops an ancestor's drop shadow but keeps the artwork's own", () => {
    // Figma bakes a filter for every shadowed ancestor. The streak sun exports
    // with the CARD's 343x80 filter around a 58x58 icon, which paints a dark
    // halo behind the artwork.
    const svg = wrap(
      [58, 58],
      '<g filter="url(#card)"><g filter="url(#own)">' +
        '<circle id="Ellipse 960" r="12" fill="#FFD93B"/></g></g>' +
        '<defs>' +
        '<filter id="card" x="-24" y="-11" width="343" height="80"><feOffset dy="4"/></filter>' +
        '<filter id="own" x="0" y="0" width="58" height="58"><feOffset dy="4"/></filter>' +
        "</defs>",
    );
    const { svg: out, removed } = cleanSvg(svg);
    expect(removed).toBe(1);
    expect(out).not.toContain('url(#card)');
    expect(out).not.toContain('<filter id="card"');
    expect(out).toContain('url(#own)');
    expect(out).toContain('<filter id="own"');
    expect(out).toContain("Ellipse 960");
  });

  it("never empties a clipPath body", () => {
    // A clip path is a frame-sized white rect — exactly what the background
    // rule targets. Deleting it empties the clip and hides everything.
    const svg = wrap(
      [16, 16],
      '<g clip-path="url(#c)"><path id="Vector" d="M1 1L8 8Z" fill="#FFCD00"/></g>' +
        '<defs><clipPath id="c"><rect width="16" height="16" fill="white"/></clipPath></defs>',
    );
    const { svg: out, removed } = cleanSvg(svg);
    expect(removed).toBe(0);
    expect(out).toContain('<rect width="16" height="16" fill="white"/>');
    expect(out).toContain("Vector");
  });

  it("is idempotent", () => {
    const svg = wrap([58, 58], '<rect width="58" height="58" fill="#F5F5F5"/>\n<circle r="4"/>');
    const once = cleanSvg(svg).svg;
    expect(cleanSvg(once).removed).toBe(0);
  });
});
