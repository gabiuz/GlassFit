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

  it("renders responsive A4 styles, official logo, fallback, checklist, and notice", () => {
    const html = generateQuotationPdfHtml(base);
    for (const text of ["width:min(210mm, 100%)", "@media (max-width:640px)", "@page { size: A4 portrait; margin: 15mm; }", ".no-print { display:none !important; }", "thead { display:table-header-group; }", "https://glassfit.test/Logo.svg", "Visualization preview not available", "Ocular inspection checklist", "Preliminary Estimate and Consumer Notice"]) assert.ok(html.includes(text), text);
    assert.ok(!html.includes("undefined"));
    assert.ok(!html.includes("null"));
    assert.ok(!html.includes("Metro Manila, Philippines"));
    assert.ok(!html.includes("certified code-compliant"));
  });

  it("handles popup failure and keeps preview mode print-free", () => {
    assert.deepStrictEqual(openQuotationPreview("<p>x</p>", { autoPrint: false }, () => null), { ok: false, reason: "POPUP_BLOCKED" });
    let prints = 0;
    const preview = { opener: {}, document: { open() {}, write() {}, close() {}, images: [] as unknown as HTMLCollectionOf<HTMLImageElement> }, print() { prints += 1; } } satisfies QuotationPreviewWindowPort;
    assert.deepStrictEqual(openQuotationPreview("<p>x</p>", { autoPrint: false }, () => preview), { ok: true });
    assert.strictEqual(preview.opener, null);
    assert.strictEqual(prints, 0);
  });

  it("waits for image readiness before auto-printing", async () => {
    let release: (() => void) | undefined;
    let prints = 0;
    const image = { complete: false, decode: () => new Promise<void>((resolve) => { release = resolve; }) } as HTMLImageElement;
    const preview = { opener: {}, document: { open() {}, write() {}, close() {}, fonts: { ready: Promise.resolve() }, images: [image] as unknown as HTMLCollectionOf<HTMLImageElement> }, print() { prints += 1; } } satisfies QuotationPreviewWindowPort;
    assert.deepStrictEqual(openQuotationPreview("<p>x</p>", { autoPrint: true }, () => preview), { ok: true });
    await Promise.resolve(); assert.strictEqual(prints, 0); release?.();
    await new Promise((resolve) => setTimeout(resolve, 0)); assert.strictEqual(prints, 1);
  });
});
