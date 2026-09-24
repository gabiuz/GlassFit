import { describe, it } from "node:test";
import assert from "node:assert";
import { calculateStandardSeries798 } from "../../src/lib/pricing/pricingEngine.js";
import { escapeHtml, generateQuotationPdfHtml, sanitizeImageSource, type QuotationPdfMetadata } from "../../src/lib/pricing/quotationPdfGenerator.js";
import { openQuotationPreview, type QuotationPreviewWindowPort } from "../../src/lib/pricing/quotationPreviewWindow.js";

const bom = calculateStandardSeries798({ widthMm: 1200, heightMm: 1200, panelCount: 2 });
const base: QuotationPdfMetadata = { quotationNumber: "DRAFT", customerName: "A & B <script>alert('x')</script>", createdAtFormatted: "September 22, 2026", projectName: "Window <Prototype>", snapshotImageUrl: null, brandLogoUrl: "https://glassfit.test/Logo.svg", allowedImageOrigins: ["https://glassfit.test"], hasSill: true, structuralWaiver: false, bomResult: bom };

describe("IMP-MS14 quotation preview", () => {
  it("escapes text and sanitizes image sources", () => {
    assert.strictEqual(escapeHtml(`&<>"'`), "&amp;&lt;&gt;&quot;&#39;");
    assert.ok(sanitizeImageSource("data:image/png;base64,AAAA", [])?.startsWith("data:image/png"));
    assert.strictEqual(sanitizeImageSource("data:image/svg+xml,<svg/>", []), null);
    assert.strictEqual(sanitizeImageSource("javascript:alert(1)", []), null);
    assert.strictEqual(sanitizeImageSource("https://evil.test/a.png", ["https://glassfit.test"]), null);
    assert.strictEqual(sanitizeImageSource("https://glassfit.test/a.png", ["https://glassfit.test"]), "https://glassfit.test/a.png");
    const html = generateQuotationPdfHtml(base);
    assert.ok(html.includes("A &amp; B &lt;script&gt;"));
    assert.ok(!html.includes("<script>alert"));
  });

  it("isolates the narrow screen layout and restores print-safe A4 geometry", () => {
    const html = generateQuotationPdfHtml(base);
    for (const text of [
      "width:min(210mm, 100%)",
      "@media screen and (max-width:640px)",
      "@page { size: A4 portrait; margin: 15mm; }",
      ".document-header { display:flex; flex-direction:row;",
      ".meta-grid,.fixture-specs,.signature-grid { grid-template-columns:repeat(2,minmax(0,1fr));",
      ".brand-logo { width:40mm; max-width:none; height:15mm;",
      ".items-table { font-size:9pt;",
      ".items-table th,.items-table td { padding:2mm;",
      ".no-print { display:none !important; }",
      "thead { display:table-header-group; }",
      "https://glassfit.test/Logo.svg",
      "Visualization preview not available",
      "Ocular inspection checklist",
      "Preliminary Estimate and Consumer Notice",
    ]) assert.ok(html.includes(text), text);
    assert.ok(!html.includes("@media (max-width:640px)"));
    assert.ok(!html.includes("undefined"));
    assert.ok(!html.includes("null"));
    assert.ok(!html.includes("Metro Manila, Philippines"));
    assert.ok(!html.includes("certified code-compliant"));
  });

  it("uses bounded fragmentation rules without clipping long fixture cards", () => {
    const html = generateQuotationPdfHtml(base);
    for (const text of [
      ".item-card { overflow:visible;",
      ".document-header,.meta-grid,.summary-card,.fixture-specs,.ocular-card,.consumer-notice",
      ".item-card>header { break-after:avoid; page-break-after:avoid;",
      ".snapshot { break-inside:avoid; page-break-inside:avoid;",
      ".snapshot img { width:100%; height:auto; max-height:82mm; object-fit:contain;",
      "tr { break-inside:avoid; page-break-inside:avoid; }",
      "p,li { orphans:3; widows:3; }",
    ]) assert.ok(html.includes(text), text);
    assert.ok(!html.includes(".item-card { break-inside:avoid"));
  });

  it("renders a preliminary terms and accessory warranty appendix without payment content", () => {
    for (const metadata of [base, { ...base, quotationNumber: "GF-2026-001", referenceCode: "GF-2026-001" }]) {
      const html = generateQuotationPdfHtml(metadata);
      for (const text of [
        'class="terms-appendix"',
        "TERMS AND CONDITIONS",
        "does not by itself create a binding contract",
        "final written quotation or agreement accepted by both parties",
        "WARRANTY",
        "six (6)-month warranty on defective accessories",
        "subject to inspection and repair",
        "normal wear and tear",
        ".terms-appendix { break-before:page; page-break-before:always;",
        ".terms-section { break-inside:avoid; page-break-inside:avoid;",
      ]) assert.ok(html.includes(text), text);
      for (const prohibited of ["BANK DETAILS", "GCash", "BDO Account", "Checking Account", "payment instruction"]) {
        assert.ok(!html.includes(prohibited), prohibited);
      }
    }
  });

  it("handles popup failure and keeps preview mode print-free", () => {
    assert.deepStrictEqual(openQuotationPreview("<p>x</p>", { autoPrint: false }, () => null), { ok: false, reason: "POPUP_BLOCKED" });
    let prints = 0;
    const preview = { opener: {}, document: { open() {}, write() {}, close() {}, readyState: "complete", images: [] as unknown as HTMLCollectionOf<HTMLImageElement> }, addEventListener() {}, clearTimeout() {}, requestAnimationFrame(callback: FrameRequestCallback) { callback(0); return 0; }, setTimeout() { return 1; }, print() { prints += 1; } } satisfies QuotationPreviewWindowPort;
    assert.deepStrictEqual(openQuotationPreview("<p>x</p>", { autoPrint: false }, () => preview), { ok: true });
    assert.strictEqual(preview.opener, null);
    assert.strictEqual(prints, 0);
  });

  it("waits for document, fonts, complete-image decode, and two paint frames", async () => {
    let releaseLoad: (() => void) | undefined;
    let release: (() => void) | undefined;
    let prints = 0;
    let frames = 0;
    const image = { complete: true, decode: () => new Promise<void>((resolve) => { release = resolve; }) } as HTMLImageElement;
    const preview = {
      opener: {},
      document: { open() {}, write() {}, close() {}, readyState: "loading", fonts: { ready: Promise.resolve() }, images: [image] as unknown as HTMLCollectionOf<HTMLImageElement> },
      addEventListener(type: "load", listener: () => void) { assert.strictEqual(type, "load"); releaseLoad = listener; },
      clearTimeout() {},
      requestAnimationFrame(callback: FrameRequestCallback) { frames += 1; callback(frames); return frames; },
      setTimeout() { return 1; },
      print() { prints += 1; },
    } satisfies QuotationPreviewWindowPort;
    assert.deepStrictEqual(openQuotationPreview("<p>x</p>", { autoPrint: true }, () => preview), { ok: true });
    await Promise.resolve(); assert.strictEqual(prints, 0); releaseLoad?.();
    await Promise.resolve(); assert.strictEqual(prints, 0); release?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(frames, 2);
    assert.strictEqual(prints, 1);
  });

  it("treats image decode rejection as settled", async () => {
    let prints = 0;
    let frames = 0;
    const image = { complete: true, decode: () => Promise.reject(new Error("decode failed")) } as HTMLImageElement;
    const preview = {
      opener: {},
      document: { open() {}, write() {}, close() {}, readyState: "complete", images: [image] as unknown as HTMLCollectionOf<HTMLImageElement> },
      addEventListener() {},
      clearTimeout() {},
      requestAnimationFrame(callback: FrameRequestCallback) { frames += 1; callback(frames); return frames; },
      setTimeout() { return 1; },
      print() { prints += 1; },
    } satisfies QuotationPreviewWindowPort;
    openQuotationPreview("<p>x</p>", { autoPrint: true }, () => preview);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(frames, 2);
    assert.strictEqual(prints, 1);
  });

  it("uses the bounded five-second fallback when readiness never settles", async () => {
    let prints = 0;
    let requestedTimeout = 0;
    let releaseTimeout: (() => void) | undefined;
    const preview = {
      opener: {},
      document: { open() {}, write() {}, close() {}, readyState: "loading", fonts: { ready: new Promise(() => undefined) }, images: [] as unknown as HTMLCollectionOf<HTMLImageElement> },
      addEventListener() {},
      clearTimeout() {},
      requestAnimationFrame(callback: FrameRequestCallback) { callback(0); return 0; },
      setTimeout(handler: () => void, timeout: number) { requestedTimeout = timeout; releaseTimeout = handler; return 1; },
      print() { prints += 1; },
    } satisfies QuotationPreviewWindowPort;
    openQuotationPreview("<p>x</p>", { autoPrint: true }, () => preview);
    assert.strictEqual(requestedTimeout, 5_000);
    assert.strictEqual(prints, 0);
    releaseTimeout?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(prints, 1);
  });
});
