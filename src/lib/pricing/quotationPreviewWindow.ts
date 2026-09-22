/** Browser window lifecycle adapter for IMP-MS14. */
export type OpenQuotationPreviewResult =
  | { ok: true }
  | { ok: false; reason: "POPUP_BLOCKED" | "DOCUMENT_WRITE_FAILED" };

export interface QuotationPreviewDocumentPort {
  open(): void;
  write(...content: string[]): void;
  close(): void;
  readonly readyState: DocumentReadyState;
  readonly fonts?: { readonly ready: PromiseLike<unknown> };
  readonly images: HTMLCollectionOf<HTMLImageElement>;
}

export interface QuotationPreviewWindowPort {
  opener: unknown;
  readonly document: QuotationPreviewDocumentPort;
  addEventListener(type: "load", listener: () => void, options?: AddEventListenerOptions): void;
  clearTimeout(handle: number): void;
  requestAnimationFrame(callback: FrameRequestCallback): number;
  setTimeout(handler: () => void, timeout: number): number;
  print(): void;
}

export type OpenPreviewWindow = () => QuotationPreviewWindowPort | null;

function waitForImage(image: HTMLImageElement): Promise<void> {
  if (typeof image.decode === "function") return image.decode().catch(() => undefined);
  if (image.complete) return Promise.resolve();
  return new Promise((resolve) => {
    image.addEventListener("load", () => resolve(), { once: true });
    image.addEventListener("error", () => resolve(), { once: true });
  });
}

function waitForDocument(preview: QuotationPreviewWindowPort): Promise<void> {
  if (preview.document.readyState === "complete") return Promise.resolve();
  return new Promise((resolve) => preview.addEventListener("load", resolve, { once: true }));
}

function waitForPaint(preview: QuotationPreviewWindowPort): Promise<void> {
  return new Promise((resolve) => {
    preview.requestAnimationFrame(() => preview.requestAnimationFrame(() => resolve()));
  });
}

async function printWhenReady(preview: QuotationPreviewWindowPort): Promise<void> {
  const documentReady = waitForDocument(preview);
  const fontsReady = preview.document.fonts?.ready ?? Promise.resolve();
  const imagesReady = Promise.all(Array.from(preview.document.images, waitForImage));
  let timeoutId: number | undefined;
  const timeout = new Promise<void>((resolve) => {
    timeoutId = preview.setTimeout(resolve, 5_000);
  });
  await Promise.race([
    Promise.all([documentReady, Promise.resolve(fontsReady), imagesReady]).then(() => undefined),
    timeout,
  ]);
  if (timeoutId !== undefined) preview.clearTimeout(timeoutId);
  await waitForPaint(preview);
  preview.print();
}

export function openQuotationPreview(
  html: string,
  options: { autoPrint: boolean },
  openWindow: OpenPreviewWindow = () => window.open("", "_blank") as QuotationPreviewWindowPort | null,
): OpenQuotationPreviewResult {
  const preview = openWindow();
  if (!preview) return { ok: false, reason: "POPUP_BLOCKED" };
  try {
    preview.opener = null;
    preview.document.open();
    preview.document.write(html);
    preview.document.close();
  } catch {
    return { ok: false, reason: "DOCUMENT_WRITE_FAILED" };
  }
  if (options.autoPrint) void printWhenReady(preview);
  return { ok: true };
}
