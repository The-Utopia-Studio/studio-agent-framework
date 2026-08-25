'use strict';
// WO-1 acceptance: "zero imports from '@mastra/*' anywhere in the file".
// Checks real import/require statements, not prose in comments.
const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(__dirname, '..', '..', 'tools');
const IMPORT_RE = /(?:^|\n)\s*(?:import\s[^\n]*from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|(?:const|let|var)\s[^\n]*=\s*require\(\s*['"]([^'"]+)['"]\s*\))/g;

let bad = 0, files = 0;
for (const f of fs.readdirSync(DIR).filter((f) => f.endsWith('.js'))) {
  files++;
  const src = fs.readFileSync(path.join(DIR, f), 'utf8');
  const specs = [];
  let m;
  while ((m = IMPORT_RE.exec(src)) !== null) specs.push(m[1] || m[2] || m[3]);
  const harness = specs.filter((s) => /^@mastra\b|^mastra$|^@langchain|^ai$|^@ai-sdk/.test(s));
  console.log(`  ${f}`);
  console.log(`    resolved imports: ${specs.length ? specs.join(', ') : '(none)'}`);
  if (harness.length) { console.log(`    FAIL harness imports: ${harness.join(', ')}`); bad++; }
  else console.log('    PASS no harness/ai-sdk imports');
}
console.log(`\n${files} files scanned, ${bad} violations`);
process.exitCode = bad ? 1 : 0;
