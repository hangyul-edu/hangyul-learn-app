import type { CSSProperties } from "react";

/** The part of an image to show, as fractions (0–1) of the original's width
 * and height. Stored on a carousel card (Classes tab, COU-001). */
export interface ImageCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** COU-001's card: 335 x 178.667 pt, 15:8. */
export const CARD_ASPECT = 15 / 8;
export const CARD_ASPECT_LABEL = "15:8";
/** The card at 3x — an upload this size fits whole and stays sharp. */
export const CARD_RECOMMENDED_PX = { width: 1005, height: 536 } as const;
/** The card at 2x: below this the image is upscaled on most phones. */
export const CARD_MIN_SHARP_PX = { width: 670, height: 357 } as const;

/**
 * Style for an <img> inside an `overflow: hidden`, position-relative box of
 * the card's shape, so that exactly `crop` fills the box. Percentages of the
 * box: the image is 1/width of the box wide (its height follows its own
 * aspect), shifted left by x/width and up by y/height of the box.
 */
export function croppedImageStyle(crop: ImageCrop): CSSProperties {
  return {
    position: "absolute",
    maxWidth: "none",
    width: `${100 / crop.width}%`,
    height: "auto",
    left: `${(-crop.x / crop.width) * 100}%`,
    top: `${(-crop.y / crop.height) * 100}%`,
    objectFit: "fill",
  };
}

/**
 * The largest card-shaped crop of an image (`zoom` 1) — what the old centred
 * cover crop showed — and smaller ones as `zoom` grows, centred on (cx, cy)
 * and kept inside the image.
 */
export function cropAt(
  natural: { width: number; height: number },
  zoom: number,
  center: { x: number; y: number },
): ImageCrop {
  const imageAspect = natural.width / natural.height;
  // Fractions of the image the zoom-1 crop covers.
  const fullW = imageAspect > CARD_ASPECT ? CARD_ASPECT / imageAspect : 1;
  const fullH = imageAspect > CARD_ASPECT ? 1 : imageAspect / CARD_ASPECT;
  const width = fullW / zoom;
  const height = fullH / zoom;
  const x = clamp(center.x - width / 2, 0, 1 - width);
  const y = clamp(center.y - height / 2, 0, 1 - height);
  return { x: round(x), y: round(y), width: round(width), height: round(height) };
}

/** The zoom and centre that reproduce `crop` (inverse of cropAt). */
export function zoomAndCenterOf(natural: { width: number; height: number }, crop: ImageCrop) {
  const imageAspect = natural.width / natural.height;
  const fullW = imageAspect > CARD_ASPECT ? CARD_ASPECT / imageAspect : 1;
  return {
    zoom: Math.max(1, fullW / crop.width),
    center: { x: crop.x + crop.width / 2, y: crop.y + crop.height / 2 },
  };
}

export type CropCorner = "nw" | "ne" | "sw" | "se";

/**
 * `crop` with one corner dragged to `pointer` (fractions of the image): the
 * opposite corner stays put, the area stays 15:8, inside the image, and
 * between the zoom-1 size and `maxZoom`.
 */
export function resizeCropFromCorner(
  natural: { width: number; height: number },
  crop: ImageCrop,
  corner: CropCorner,
  pointer: { x: number; y: number },
  maxZoom: number,
): ImageCrop {
  // Height (a fraction of the image's height) per unit of width, for 15:8 in pixels.
  const heightPerWidth = natural.width / natural.height / CARD_ASPECT;
  const east = corner === "ne" || corner === "se";
  const south = corner === "sw" || corner === "se";
  const anchorX = east ? crop.x : crop.x + crop.width;
  const anchorY = south ? crop.y : crop.y + crop.height;
  const fullW = cropAt(natural, 1, { x: 0.5, y: 0.5 }).width;
  const roomW = east ? 1 - anchorX : anchorX;
  const roomH = south ? 1 - anchorY : anchorY;
  const maxW = Math.min(fullW, roomW, roomH / heightPerWidth);
  const minW = Math.min(fullW / maxZoom, maxW);
  // Follow whichever way the pointer moved the corner more.
  const byX = east ? pointer.x - anchorX : anchorX - pointer.x;
  const byY = (south ? pointer.y - anchorY : anchorY - pointer.y) / heightPerWidth;
  const wanted = Math.abs(byX - crop.width) >= Math.abs(byY - crop.width) ? byX : byY;
  const width = clamp(wanted, minW, maxW);
  const height = width * heightPerWidth;
  return {
    x: round(east ? anchorX : anchorX - width),
    y: round(south ? anchorY : anchorY - height),
    width: round(width),
    height: round(height),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function round(value: number) {
  return Math.round(value * 1e5) / 1e5;
}
