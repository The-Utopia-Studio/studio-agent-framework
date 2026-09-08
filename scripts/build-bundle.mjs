import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { makeZip } from './zip.mjs';
import { checkSkills } from './check-skills.mjs';
const issues = checkSkills(process.cwd());
if (issues.length) throw new Error(issues.join('\n'));
const files = JSON.parse(fs.readFileSync('ui/agents-framework-ui/app/data/bundle-files.json'));
const encoder = new TextEncoder();
const readFile = (file) =>
  fs.readFileSync(
    fs.existsSync(file) ? file : file.replace(/\/SKILL\.md$/, '/INSTRUCTIONS.md'),
    'utf8',
  );
const entries = files.map((file) => ({
  name: `studio-agent-framework/${file.replace(/\/SKILL\.md$/, '/INSTRUCTIONS.md')}`,
  bytes: encoder.encode(
    file.endsWith('.md')
      ? readFile(file).replace(/\/SKILL\.md/g, '/INSTRUCTIONS.md')
      : readFile(file),
  ),
}));
entries.push({
  name: 'studio-agent-framework/SKILL.md',
  bytes: encoder.encode(fs.readFileSync('scripts/bundle-root.md', 'utf8')),
});
const hash = (b) => createHash('sha256').update(b).digest('hex');
const git = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
const dirty = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8' });
entries.push({
  name: 'studio-agent-framework/bundle-version.json',
  bytes: encoder.encode(
    JSON.stringify(
      {
        commit: git.status === 0 ? git.stdout.trim() : null,
        working_tree_dirty: !!dirty.stdout.trim(),
        files: entries.map((e) => ({ path: e.name, sha256: hash(e.bytes) })),
      },
      null,
      2,
    ),
  ),
});
const output =
  process.argv.find((a) => a.startsWith('--output='))?.slice(9) ||
  'dist/studio-agent-framework.zip';
fs.mkdirSync(path.dirname(output), { recursive: true });
const bytes = makeZip(entries);
fs.writeFileSync(output, bytes);
console.log(`${output}: ${entries.length} files; SHA256 ${hash(bytes)}`);
