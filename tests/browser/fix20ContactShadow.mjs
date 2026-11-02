// QAD-TC7 / FIX20-V2 / FIX21-V5: run with `node tests/browser/fix20ContactShadow.mjs`,
// then open the printed temporary HTML file in a browser.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const directory = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(directory, "../../src/lib/visualization/contactShadow.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const warpSource = fs.readFileSync(path.join(directory, "../../src/lib/visualization/perspectiveTransform.ts"), "utf8");
const compiledWarp = ts.transpileModule(warpSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const output = path.join(os.tmpdir(), "glassfit-fix20-contact-shadow.html");

const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>GlassFit FIX20 pixel check</title>
<style>body{font:16px system-ui;padding:24px}canvas{border:1px solid #ddd;image-rendering:pixelated;width:480px;height:400px}</style>
<h1>FIX20 canvas pixel check</h1><p id="result">Running...</p><canvas id="preview" width="120" height="100"></canvas>
<script type="module">
${compiled}
${compiledWarp}
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const pixel = (canvas, x, y) => [...canvas.getContext('2d').getImageData(x, y, 1, 1).data];
const createScene = (shadow) => {
  const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 100;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#dddddd';
  ctx.fillRect(20, 20, 80, 5); ctx.fillRect(20, 75, 80, 5);
  ctx.fillRect(20, 20, 5, 60); ctx.fillRect(95, 20, 5, 60);
  ctx.fillStyle = 'rgba(100, 160, 200, 0.15)'; ctx.fillRect(25, 25, 70, 50);
  ctx.fillStyle = '#777777'; ctx.fillRect(100, 46, 11, 7);
  if (shadow) applyContactOcclusionAndReveals(ctx, 120, 100, {
    installationBounds: { x: 20 / 120, y: 20 / 100, width: 80 / 120, height: 60 / 100 },
    lightDirection: { x: 0.4, y: 0.5 }, shadowOpacity: 0.35,
  });
  return canvas;
};
const encoded = (source) => new Promise((resolve, reject) => {
  const composite = document.createElement('canvas'); composite.width = 120; composite.height = 100;
  const ctx = composite.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 120, 100);
  ctx.drawImage(source, 0, 0);
  const image = new Image(); image.onload = () => {
    const decoded = document.createElement('canvas'); decoded.width = 120; decoded.height = 100;
    decoded.getContext('2d').drawImage(image, 0, 0); resolve(decoded);
  }; image.onerror = reject; image.src = composite.toDataURL('image/jpeg', 0.95);
});
const transparentPng = (source) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => {
    const decoded = document.createElement('canvas'); decoded.width = source.width; decoded.height = source.height;
    decoded.getContext('2d').drawImage(image, 0, 0); resolve(decoded);
  }; image.onerror = reject; image.src = source.toDataURL('image/png');
});
try {
  const on = createScene(true), off = createScene(false);
  assert(pixel(on, 0, 0)[3] === 0 && pixel(on, 0, 50)[3] === 0, 'unused canvas edge has nonzero alpha');
  assert(pixel(on, 18, 50)[3] > 0 && pixel(off, 18, 50)[3] === 0, 'localized outer contact shadow is missing');
  assert(pixel(on, 50, 50)[3] > 0 && pixel(on, 50, 50)[3] < 255, 'glass transparency changed');
  assert(pixel(on, 106, 49)[3] === 255, 'projecting handle was clipped');
  const placedPng = await transparentPng(on);
  assert(pixel(placedPng, 0, 0)[3] === 0 && pixel(placedPng, 0, 50)[3] === 0, 'placed PNG gained a source-canvas edge');
  assert(pixel(placedPng, 18, 50)[3] > 0, 'placed PNG lost localized contact shadow');
  assert(pixel(placedPng, 50, 50)[3] > 0 && pixel(placedPng, 50, 50)[3] < 255, 'placed PNG lost transparent glass');
  const onJpeg = await encoded(on), offJpeg = await encoded(off);
  assert(pixel(onJpeg, 18, 50)[0] + 5 < pixel(offJpeg, 18, 50)[0], 'JPEG lost localized shadow');
  assert(pixel(onJpeg, 0, 50)[0] > 245, 'JPEG has canvas-edge outline');
  const warp = (source) => {
    const target = document.createElement('canvas'); target.width = 240; target.height = 200;
    const ctx = target.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 240, 200);
    drawPerspectiveWarpedImage(ctx, source, [
      { x: 60, y: 30 }, { x: 180, y: 42 }, { x: 170, y: 160 }, { x: 50, y: 148 },
    ], 16, { left: 20 / 120, top: 20 / 100, width: 80 / 120, height: 60 / 100 });
    return target;
  };
  const warpedOn = warp(on), warpedOff = warp(off);
  assert(pixel(warpedOn, 5, 100)[0] > 245, 'angled warp has a source-frame outline');
  const warpedOnPixels = warpedOn.getContext('2d').getImageData(0, 0, 240, 200).data;
  const warpedOffPixels = warpedOff.getContext('2d').getImageData(0, 0, 240, 200).data;
  let changed = 0;
  for (let y = 25; y < 165; y++) for (let x = 45; x < 185; x++) {
    const index = (y * 240 + x) * 4;
    if (warpedOnPixels[index] + 4 < warpedOffPixels[index]) changed++;
  }
  assert(changed > 20, 'angled warp lost contact and reveal shading');
  document.getElementById('preview').getContext('2d').drawImage(on, 0, 0);
  document.getElementById('result').textContent = 'PASS: inset contact, transparent PNG margins and glass, projecting handle, Auto Shadow off, angled warp, JPEG room decode';
} catch (error) {
  document.getElementById('result').textContent = 'FAIL: ' + error.message;
  throw error;
}
</script></html>`;

fs.writeFileSync(output, html);
process.stdout.write(`${output}\n`);
