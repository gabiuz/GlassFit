import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const workspaceDir = '/Users/gab/Developer/glassfit';
const skillDir = '/Users/gab/.codex/plugins/cache/openai-primary-runtime/presentations/26.1011.11113/skills/presentations';
const runtimePython = '/Users/gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const finalPath = path.join(workspaceDir, 'output', 'pptx', 'GlassFit_Part2_Pareto_Analysis_v2.pptx');
const stagingDir = path.join(workspaceDir, '.pareto-finalizer');
const buildDir = path.join(workspaceDir, '.pareto-build');
const rows = [
  ['UI Defects', 36],
  ['Mobile Responsiveness', 9],
  ['Calculation Logic', 7],
  ['Broken link', 5],
  ['Broken button', 3],
  ['Database error', 2],
  ['Input validation', 2],
];
const total = rows.reduce((sum, row) => sum + row[1], 0);
let running = 0;
const tableRows = rows.map(([name, count]) => {
  running += count;
  return [name, String(count), `${(count / total * 100).toFixed(1)}%`, `${(running / total * 100).toFixed(1)}%`];
});

const ppt = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const colors = {
  ink: '#18323A',
  muted: '#5B7075',
  teal: '#147D78',
  mint: '#CFE9E3',
  coral: '#D66A53',
  paper: '#F7FAF9',
  white: '#FFFFFF',
  grid: '#D8E3E1',
};
const font = 'Aptos';

function addText(slide, text, x, y, w, h, size, color = colors.ink, bold = false) {
  const shape = slide.shapes.add({
    geometry: 'textbox',
    position: { left: x, top: y, width: w, height: h },
    fill: 'none',
    line: { style: 'solid', fill: 'none', width: 0 },
  });
  shape.text = text;
  shape.text.style = { fontFamily: font, fontSize: size, color, bold, verticalAlignment: 'middle' };
  return shape;
}

function addHeader(slide, title, number) {
  slide.background.fill = colors.paper;
  addText(slide, 'LAB 3  /  QUALITY ASSURANCE TOOLS', 64, 34, 650, 24, 14, colors.teal, true);
  addText(slide, title, 64, 72, 1040, 60, 34, colors.ink, true);
  addText(slide, `PART 2  |  ${number}`, 1080, 38, 136, 24, 13, colors.muted, true);
  const rule = slide.shapes.add({
    geometry: 'rect',
    position: { left: 64, top: 144, width: 1152, height: 2 },
    fill: colors.grid,
    line: { style: 'solid', fill: 'none', width: 0 },
  });
}

// Slide 1: complete frequency ranking and percentage calculations.
{
  const slide = ppt.slides.add();
  addHeader(slide, 'Pareto Analysis | Defect Ranking', '01');
  addText(slide, 'Testing check sheet totals by defect type', 64, 162, 740, 30, 19, colors.muted);
  addText(slide, `${total} TOTAL ISSUES`, 941, 164, 275, 27, 15, colors.teal, true);
  const table = slide.tables.add({
    rows: 9,
    columns: 4,
    left: 64,
    top: 210,
    width: 1152,
    height: 382,
    columnWidths: [520, 180, 210, 242],
    values: [['Defect type', 'Frequency', '% of total', 'Cumulative %'], ...tableRows, ['Total', String(total), '100.0%', '100.0%']],
  });
  table.borders.assign({ style: 'solid', fill: colors.grid, width: 1 });
  table.styleOptions = { headerRow: true, bandedRows: true };
  for (let col = 0; col < 4; col += 1) {
    const cell = table.getCell(0, col);
    cell.fill = colors.ink;
    cell.text.style = { fontFamily: font, fontSize: 17, color: colors.white, bold: true };
  }
  for (let row = 1; row < 9; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const cell = table.getCell(row, col);
      cell.fill = row === 8 ? colors.mint : row <= 3 ? '#E7F3F0' : colors.white;
      cell.text.style = { fontFamily: font, fontSize: 17, color: colors.ink, bold: row === 8 || (row <= 3 && col === 0) };
    }
  }
  addText(slide, 'Share = defect frequency / 64 × 100. Values are rounded to one decimal place.', 64, 610, 850, 28, 14, colors.muted);
  addText(slide, 'Source: Group 2 Check Sheet (Weeks 1-2)', 64, 660, 700, 22, 13, colors.muted);
  slide.speakerNotes.text = 'Source data: Lab3_Group2.pdf, the attached Part 1 check sheet. The frequencies are the supplied Total column. Total issues = 64. Percent = frequency / 64 × 100; cumulative percent is computed from the ranked counts before display rounding.';
}

// Slide 2: Pareto chart and action priority.
{
  const slide = ppt.slides.add();
  addHeader(slide, 'Pareto Chart | Priority Defects', '02');
  addText(slide, 'Bars show issue frequency; the line shows cumulative share.', 64, 162, 800, 30, 18, colors.muted);
  slide.charts.add('bar', {
    position: { left: 64, top: 205, width: 770, height: 420 },
    categories: rows.map(([name]) => name),
    series: [{ name: 'Defect frequency', values: rows.map(([, count]) => count), fill: colors.teal }],
    titlePlacement: 'none',
    hasLegend: false,
    chartFill: 'none',
    chartLine: { style: 'solid', fill: 'none', width: 0 },
    plotAreaFill: 'none',
    plotAreaLine: { style: 'solid', fill: 'none', width: 0 },
    barOptions: { direction: 'column', grouping: 'clustered', gapWidth: 65 },
    xAxis: { textStyle: { fontSize: 12, fill: colors.muted }, line: { style: 'solid', fill: colors.grid, width: 1 } },
    yAxis: { min: 0, max: 40, majorUnit: 10, textStyle: { fontSize: 12, fill: colors.muted }, majorGridlines: { style: 'solid', fill: colors.grid, width: 1 } },
    dataLabels: { showValue: true, position: 'outEnd', textStyle: { fontSize: 12, fill: colors.ink, bold: true } },
  });
  const plot = { left: 128, right: 812, top: 248, bottom: 566 };
  const cumulative = rows.map(([, count], index) => rows.slice(0, index + 1).reduce((sum, row) => sum + row[1], 0) / total);
  const points = cumulative.map((value, index) => ({
    x: plot.left + (plot.right - plot.left) * index / (cumulative.length - 1),
    y: plot.bottom - value * (plot.bottom - plot.top),
  }));
  const thresholdY = plot.bottom - 0.8 * (plot.bottom - plot.top);
  slide.shapes.add({ geometry: 'line', position: { left: plot.left, top: thresholdY, width: plot.right - plot.left, height: 0 }, fill: 'none', line: { style: 'dashed', fill: colors.coral, width: 2 } });
  points.forEach((point, index) => {
    if (index > 0) {
      const prior = points[index - 1];
      const top = Math.min(prior.y, point.y);
      const height = Math.abs(prior.y - point.y);
      slide.shapes.add({ geometry: 'line', position: { left: prior.x, top, width: point.x - prior.x, height, verticalFlip: point.y < prior.y }, fill: 'none', line: { style: 'solid', fill: colors.coral, width: 3 } });
    }
    slide.shapes.add({ geometry: 'ellipse', position: { left: point.x - 6, top: point.y - 6, width: 12, height: 12 }, fill: colors.coral, line: { style: 'solid', fill: colors.white, width: 2 } });
    addText(slide, `${(cumulative[index] * 100).toFixed(1)}%`, point.x - 37, point.y - 30, 74, 20, 10, colors.coral, true);
  });
  const divider = slide.shapes.add({
    geometry: 'rect',
    position: { left: 862, top: 212, width: 2, height: 400 },
    fill: colors.grid,
    line: { style: 'solid', fill: 'none', width: 0 },
  });
  addText(slide, '80% threshold', 898, 220, 300, 32, 20, colors.coral, true);
  addText(slide, 'The first 3 categories reach 81.3% of all recorded issues.', 898, 265, 300, 84, 22, colors.ink, true);
  addText(slide, 'Teal bars: issue count\nCoral line: cumulative %', 898, 357, 300, 50, 14, colors.muted);
  addText(slide, 'Prioritize', 898, 424, 300, 26, 14, colors.teal, true);
  addText(slide, '1. UI defects  |  36 issues\n2. Mobile responsiveness  |  9\n3. Calculation logic  |  7', 898, 460, 310, 126, 17, colors.ink);
  addText(slide, 'Together: 52 of 64 issues', 898, 602, 300, 26, 16, colors.muted, true);
  addText(slide, 'Source: Group 2 Check Sheet (Weeks 1-2)', 64, 660, 700, 22, 13, colors.muted);
  slide.speakerNotes.text = 'Source data: Lab3_Group2.pdf, the attached Part 1 check sheet. Categories are sorted highest to lowest. Top three sum to 52 / 64 = 81.25%, displayed as 81.3%. Prioritization follows the requested Pareto rule: address the smallest ranked set that accounts for at least 80% of issues.';
}

await fs.mkdir(buildDir, { recursive: true });
await fs.mkdir(path.dirname(finalPath), { recursive: true });
await fs.mkdir(stagingDir, { recursive: true });
await fs.writeFile(path.join(buildDir, 'slide-01.png'), new Uint8Array(await ppt.export({ slide: ppt.slides.items[0], format: 'png', scale: 1 })));
await fs.writeFile(path.join(buildDir, 'slide-02.png'), new Uint8Array(await ppt.export({ slide: ppt.slides.items[1], format: 'png', scale: 1 })));
const { finalizePresentation } = await import(pathToFileURL(path.join(skillDir, 'container_tools/artifact_tool_utils.mjs')).href);
const candidatePath = path.join(stagingDir, 'candidate.pptx');
await (await PresentationFile.exportPptx(ppt)).save(candidatePath);
const result = await finalizePresentation({
  explicitTotalSlideCount: 2,
  requiredNativeTableOwnerSlides: [1],
  requiredNativeChartOwnerSlides: [2],
  materializeLiteralChartWorkbooks: true,
  tableArithmeticContracts: [{ slide: 1, table: 1, label_column: 0, total_row: 8, value_columns: [1], component_rows: [1, 2, 3, 4, 5, 6, 7] }],
  workspaceDir,
  candidatePath,
  finalPath,
  pythonExecutable: runtimePython,
  integrityValidatorPath: path.join(skillDir, 'container_tools/inspect_presentation_package_integrity.py'),
  layoutValidatorPath: path.join(skillDir, 'container_tools/inspect_presentation_layout_geometry.py'),
  layoutArgs: ['--expected-slide-size-emu', '12192000,6858000', '--validate-heading-fit', '--require-native-table-slide', '1'],
  fontPolicy: { basis: 'design', families: [font] },
  verifyArtifactToolImport: true,
  receiptPath: path.join(stagingDir, 'validation-v2.json'),
});
console.log(JSON.stringify(result, null, 2));
