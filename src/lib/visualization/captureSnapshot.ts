export type CapturedVariationBlob = {
  blob: Blob;
  mimeType: "image/webp" | "image/png";
  width: number;
  height: number;
};

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: "image/webp" | "image/png",
  quality?: number,
) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, quality));
}

export async function captureTransparentCanvasBlob(
  canvas: HTMLCanvasElement,
): Promise<CapturedVariationBlob> {
  const webp = await canvasToBlob(canvas, "image/webp", 0.94);
  if (webp?.type === "image/webp") {
    return {
      blob: webp,
      mimeType: "image/webp",
      width: canvas.width,
      height: canvas.height,
    };
  }
  const png = await canvasToBlob(canvas, "image/png");
  if (!png) throw new Error("The variation image could not be encoded.");
  return {
    blob: png,
    mimeType: "image/png",
    width: canvas.width,
    height: canvas.height,
  };
}
