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
const OUT = process.env.STANDARD_HARNESS_OUT
  ? path.resolve(process.env.STANDARD_HARNESS_OUT)
  : path.join(HERE, 'the-standard-harness.pdf');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// h2 slug prefix -> the SECTION marker printed above it.
//
// Keyed on the `id` pandoc generates ("## 4. Long-running background agents" becomes
// id="4-long-running-background-agents"), not on the heading text. Three reasons, and the
// first two were both bugs in earlier versions of this script:
//
//   - heading TEXT arrives wrapped across newlines, so a substring match silently missed
//   - matching text meant stripping tags with a regex, which is incomplete by nature
//     (`<scr<script>ipt>` survives one pass) and reads as sanitisation when it is only a
//     lookup key -- CodeQL flagged it, correctly, as a pattern worth not having
//   - the leading number makes the slug prefix unambiguous, so a reworded heading keeps its
//     marker as long as its number is unchanged
//
// A section number that IS changed throws below rather than shipping an unlabelled page.
const SECTIONS = [
  ['1-', 'SECTION 01 · ARCHITECTURE'],
  ['2-', 'SECTION 02 · ORCHESTRATION'],
  ['3-', 'SECTION 03 · MEMORY'],
  ['4-', 'SECTION 04 · RUNTIME'],
  ['5-', 'SECTION 05 · GRADING'],
  ['6-', 'SECTION 06 · DURABILITY'],
  ['7-', 'SECTION 07 · MEMORY ARCHITECTURE'],
  ['8-', 'SECTION 08 · REFERENCE'],
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
  const id = (/\bid="([^"]*)"/.exec(attrs) || [, ''])[1];
  const hit = SECTIONS.find(([slug]) => id.startsWith(slug));
  if (!hit) throw new Error(`no SECTION marker mapped for h2 id="${id}" — update SECTIONS in build.mjs`);
  seen.add(hit[1]);
  // The marker is a literal from SECTIONS, never anything derived from the document, so
  // nothing document-controlled reaches an attribute here. `inner` is passed through
  // untouched -- this step only ADDS an attribute, it does not sanitise or rewrite content.
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
fs.mkdirSync(path.dirname(OUT), { recursive: true });
execFileSync(CHROME, [
  '--headless', '--disable-gpu', '--no-sandbox', '--no-pdf-header-footer',
  '--virtual-time-budget=5000', `--print-to-pdf=${OUT}`, `file://${tmp}`,
], { stdio: 'ignore' });
fs.unlinkSync(tmp);

const bytes = fs.statSync(OUT).size;
const pages = (fs.readFileSync(OUT).toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
console.log(`${OUT}\n  ${pages} pages · ${Math.round(bytes / 1024)} KB · ${SECTIONS.length} sections`);
