import { describe, expect, it } from "vitest";
import { croppedImageStyle } from "./imageCrop";

describe("croppedImageStyle", () => {
  it("scales and shifts the image so the crop fills the card", () => {
    const style = croppedImageStyle({ x: 0.25, y: 0.1, width: 0.5, height: 0.8 });
    expect(style.width).toBe("200%");
    expect(style.left).toBe("-50%");
    expect(style.top).toBe("-12.5%");
    expect(style.position).toBe("absolute");
  });
});
