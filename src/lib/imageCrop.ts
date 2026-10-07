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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function round(value: number) {
  return Math.round(value * 1e5) / 1e5;
}
