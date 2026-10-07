import { describe, expect, it } from "vitest";
import { CARD_ASPECT, cropAt, croppedImageStyle, resizeCropFromCorner, zoomAndCenterOf } from "./imageCrop";

describe("cropAt", () => {
  it("at zoom 1 takes the largest 15:8 area, centred — the old cover crop", () => {
    // 3:2 photo (taller than the card): full width, a band of its height.
    const crop = cropAt({ width: 1200, height: 800 }, 1, { x: 0.5, y: 0.5 });
    expect(crop.width).toBe(1);
    expect(crop.height).toBeCloseTo((1200 / CARD_ASPECT) / 800, 4);
    expect(crop.y).toBeCloseTo((1 - crop.height) / 2, 4);
    // In pixels the area is exactly 15:8.
    expect((crop.width * 1200) / (crop.height * 800)).toBeCloseTo(CARD_ASPECT, 3);
  });

  it("for a wider image takes its full height and a slice of its width", () => {
    const crop = cropAt({ width: 3000, height: 1000 }, 1, { x: 0.5, y: 0.5 });
    expect(crop.height).toBe(1);
    expect((crop.width * 3000) / 1000).toBeCloseTo(CARD_ASPECT, 3);
  });

  it("zooms in around the chosen centre and never leaves the image", () => {
    const natural = { width: 1600, height: 900 };
    const zoomed = cropAt(natural, 2, { x: 0.9, y: 0.9 });
    expect(zoomed.x + zoomed.width).toBeLessThanOrEqual(1);
    expect(zoomed.y + zoomed.height).toBeLessThanOrEqual(1);
    expect(zoomed.width).toBeCloseTo(cropAt(natural, 1, { x: 0.5, y: 0.5 }).width / 2, 4);
    const corner = cropAt(natural, 3, { x: -5, y: -5 });
    expect(corner.x).toBe(0);
    expect(corner.y).toBe(0);
  });

  it("an exact 15:8 upload at zoom 1 is the whole image", () => {
    expect(cropAt({ width: 1005, height: 536 }, 1, { x: 0.5, y: 0.5 })).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });
});

describe("zoomAndCenterOf", () => {
  it("reproduces the crop it was given", () => {
    const natural = { width: 1200, height: 900 };
    const crop = cropAt(natural, 2.5, { x: 0.3, y: 0.6 });
    const { zoom, center } = zoomAndCenterOf(natural, crop);
    expect(cropAt(natural, zoom, center)).toEqual(crop);
  });
});

describe("croppedImageStyle", () => {
  it("scales and shifts the image so the crop fills the card", () => {
    const style = croppedImageStyle({ x: 0.25, y: 0.1, width: 0.5, height: 0.8 });
    expect(style.width).toBe("200%");
    expect(style.left).toBe("-50%");
    expect(style.top).toBe("-12.5%");
    expect(style.position).toBe("absolute");
  });
});

describe("resizeCropFromCorner", () => {
  const natural = { width: 1600, height: 900 };
  const pxRatio = (c: { width: number; height: number }) => (c.width * natural.width) / (c.height * natural.height);

  it("keeps the opposite corner fixed and the area 15:8", () => {
    const start = cropAt(natural, 2, { x: 0.5, y: 0.5 });
    const grown = resizeCropFromCorner(natural, start, "se", { x: start.x + start.width + 0.1, y: start.y + start.height }, 4);
    expect(grown.x).toBeCloseTo(start.x, 4);
    expect(grown.y).toBeCloseTo(start.y, 4);
    expect(grown.width).toBeCloseTo(start.width + 0.1, 4);
    expect(pxRatio(grown)).toBeCloseTo(CARD_ASPECT, 3);

    const shrunk = resizeCropFromCorner(natural, start, "nw", { x: start.x + 0.05, y: start.y }, 4);
    expect(shrunk.x + shrunk.width).toBeCloseTo(start.x + start.width, 4);
    expect(shrunk.y + shrunk.height).toBeCloseTo(start.y + start.height, 4);
    expect(shrunk.width).toBeCloseTo(start.width - 0.05, 4);
  });

  it("stops at the image's edge, at the zoom-1 size and at the largest zoom", () => {
    const start = cropAt(natural, 2, { x: 0.5, y: 0.5 });
    const big = resizeCropFromCorner(natural, start, "se", { x: 5, y: 5 }, 4);
    expect(big.x + big.width).toBeLessThanOrEqual(1.0001);
    expect(big.y + big.height).toBeLessThanOrEqual(1.0001);
    expect(big.width).toBeLessThanOrEqual(cropAt(natural, 1, { x: 0.5, y: 0.5 }).width + 1e-4);
    const tiny = resizeCropFromCorner(natural, start, "se", { x: start.x, y: start.y }, 4);
    expect(tiny.width).toBeCloseTo(cropAt(natural, 1, { x: 0.5, y: 0.5 }).width / 4, 4);
  });
});
