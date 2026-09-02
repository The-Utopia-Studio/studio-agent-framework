// Renders long-horizon/STANDARD.md to a designed A4 PDF.
//
// The point of this living in the repo: the PDF is REGENERABLE. A one-off design export drifts
// from the markdown the moment either changes, and then nobody knows which one is true.
//   node long-horizon/pdf/build.mjs
// Requires pandoc and Chrome. Both are checked before anything is written.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const SRC = path.join(HERE, '..', 'STANDARD.md');
const OUT = path.join(HERE, 'the-standard-harness.pdf');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// h2 text -> the SECTION marker printed above it. Keyed on a distinctive substring so a
// reworded heading does not silently lose its marker -- it throws instead.
const SECTIONS = [
  ['The shape',                         'SECTION 01 · ARCHITECTURE'],
  ['Orchestration',                     'SECTION 02 · ORCHESTRATION'],
  ['Memory — three rules',              'SECTION 03 · MEMORY'],
  ['Long-running background agents',    'SECTION 04 · RUNTIME'],
  ['BEHAVIOR.md',                       'SECTION 05 · GRADING'],
  ['Inngest',                           'SECTION 06 · DURABILITY'],
  ['Memory across the three module',    'SECTION 07 · MEMORY ARCHITECTURE'],
  ['The short version',                 'SECTION 08 · REFERENCE'],
];

for (const [bin, hint] of [['pandoc', 'brew install pandoc']]) {
  try { execFileSync('which', [bin], { stdio: 'ignore' }); }
  catch { console.error(`missing ${bin} — ${hint}`); process.exit(1); }
}
if (!fs.existsSync(CHROME)) { console.error(`Chrome not found at ${CHROME}`); process.exit(1); }

const md = fs.readFileSync(SRC, 'utf8');
// Drop the markdown H1 and lead paragraph; the cover block below replaces them.
const body = execFileSync('pandoc', ['-f', 'gfm', '-t', 'html5'], { input: md, encoding: 'utf8' });

let html = body;
// Attach the section marker to each h2, and fail loudly on an unmapped one rather than
// shipping a page with a missing label nobody notices.
const seen = new Set();
html = html.replace(/<h2([^>]*)>([\s\S]*?)<\/h2>/g, (m, attrs, inner) => {
  // Markdown wraps long headings, so the extracted text carries newlines. Collapse whitespace
  // before matching or a wrapped heading silently misses its marker.
  const plain = inner.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const hit = SECTIONS.find(([needle]) => plain.includes(needle));
  if (!hit) throw new Error(`no SECTION marker mapped for h2: "${plain.trim()}" — update SECTIONS in build.mjs`);
  seen.add(hit[1]);
  return `<h2${attrs} data-section="${hit[1]}">${inner}</h2>`;
});
const missing = SECTIONS.filter(([, label]) => !seen.has(label));
if (missing.length) console.warn(`warning: unused markers — ${missing.map((x) => x[1]).join(', ')}`);

// Strip the source H1 + its lead paragraph, which the cover restates with more context.
html = html.replace(/<h1[\s\S]*?<\/h1>/, '');
html = html.replace(/^\s*<p>How to build an agent[\s\S]*?<\/p>/m, '');

const cover = `
<p class="eyebrow">Agent Inventory · Engineering Standard &nbsp;/&nbsp; Asset · Standard Harness</p>
<h1>The Standard<br>Harness</h1>
<p>How to build an agent on this framework. The rest of the folder is evidence; this file is the recipe.</p>
<div class="stamp">Proven, or marked design. Never asserted.</div>
<div class="flow">trigger → preflight → workflow → agent → durable state → memory write → freshness check → grade</div>
`;

const css = fs.readFileSync(path.join(HERE, 'style.css'), 'utf8');
const page = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>The Standard Harness — Utopia Studio</title>
<style>\n${css}\n</style></head><body>\n${cover}\n${html}\n</body></html>`;

const tmp = path.join(HERE, '.build.html');
fs.writeFileSync(tmp, page);
execFileSync(CHROME, [
  '--headless', '--disable-gpu', '--no-sandbox', '--no-pdf-header-footer',
  '--virtual-time-budget=5000', `--print-to-pdf=${OUT}`, `file://${tmp}`,
], { stdio: 'ignore' });
fs.unlinkSync(tmp);

const bytes = fs.statSync(OUT).size;
const pages = (fs.readFileSync(OUT).toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
console.log(`${OUT}\n  ${pages} pages · ${Math.round(bytes / 1024)} KB · ${SECTIONS.length} sections`);
