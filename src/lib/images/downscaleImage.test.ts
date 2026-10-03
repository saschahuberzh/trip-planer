import { describe, expect, it } from "vitest";
import { MAX_IMAGE_SIDE, fitWithin } from "./downscaleImage";

describe("fitWithin", () => {
  it("scales the longest side down to the maximum, keeping the aspect ratio", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: MAX_IMAGE_SIDE, height: 1200 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1200, height: MAX_IMAGE_SIDE });
  });

  it("never enlarges small images", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1600, 1600)).toEqual({ width: 1600, height: 1600 });
  });

  it("keeps extreme panoramas at least 1px high", () => {
    expect(fitWithin(100_000, 10)).toEqual({ width: 1600, height: 1 });
  });
});
