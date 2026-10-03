/**
 * Client-side image downscaling before storage (see DATA_MODEL.md "ImageAsset"):
 * longest side at most 1600 px, re-encoded as JPEG.
 */
import type { NewImageAsset } from "@/lib/repositories";

export const MAX_IMAGE_SIDE = 1600;
const JPEG_QUALITY = 0.85;

export class ImageProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageProcessingError";
  }
}

/** Target size keeping the aspect ratio; images that already fit are not enlarged. */
export function fitWithin(
  width: number,
  height: number,
  maxSide: number = MAX_IMAGE_SIDE,
): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void };

async function decode(file: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // Fall back to <img>, which decodes more formats on some browsers (e.g. HEIC on Safari).
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => {} };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Decodes, downscales and re-encodes an image chosen by the user (browser only). */
export async function downscaleImage(file: Blob): Promise<NewImageAsset> {
  let decoded: Decoded;
  try {
    decoded = await decode(file);
  } catch {
    throw new ImageProcessingError("This image can't be read. Try a JPEG, PNG or WebP photo.");
  }
  try {
    const { width, height } = fitWithin(decoded.width, decoded.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new ImageProcessingError("Your browser couldn't process this image.");
    context.drawImage(decoded.source, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob) throw new ImageProcessingError("Your browser couldn't process this image.");
    return { mimeType: "image/jpeg", blob, width, height };
  } finally {
    decoded.release();
  }
}
