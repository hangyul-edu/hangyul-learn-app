import type { CSSProperties } from "react";

/** The part of an image to show, as fractions (0–1) of the original's width
 * and height. Stored on a carousel card (Classes tab, COU-001); chosen in the
 * admin's crop editor, which owns the cropping math. */
export interface ImageCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

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
