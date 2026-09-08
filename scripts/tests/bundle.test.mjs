import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { checkSkills } from '../check-skills.mjs';
import { validateStructure } from '../../harness/structure.js';
test('built ZIP is installable and contains manifest and implementation resources', () => {
  const dir = fs.mkdtempSync(path.join(tmpdir(), 'studio-bundle-'));
  const zip = path.join(dir, 'bundle.zip');
  const build = spawnSync(process.execPath, ['scripts/build-bundle.mjs', `--output=${zip}`], {
    encoding: 'utf8',
  });
  assert.equal(build.status, 0, build.stderr);
  const unpack = spawnSync('python3', ['-m', 'zipfile', '-e', zip, dir], { encoding: 'utf8' });
  assert.equal(unpack.status, 0, unpack.stderr);
  const root = path.join(dir, 'studio-agent-framework');
  assert.deepEqual(validateStructure(root, 'skill'), []);
  assert.deepEqual(checkSkills(root), []);
  const installedPackage = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
  for (const file of [
    'scripts/build-bundle.mjs',
    'scripts/zip.mjs',
    'scripts/bundle-root.md',
    'scripts/tests/bundle.test.mjs',
    'ui/agents-framework-ui/app/data/bundle-files.json',
  ])
    assert.ok(fs.existsSync(path.join(root, file)), file);
  assert.ok(installedPackage.scripts.bundle);
  // Exercise installed build/check commands without a second dependency download.
  fs.symlinkSync(path.resolve('node_modules'), path.join(root, 'node_modules'), 'dir');
  const rebuilt = spawnSync(
    process.execPath,
    ['scripts/build-bundle.mjs', `--output=${path.join(dir, 'rebuilt.zip')}`],
    { cwd: root, encoding: 'utf8' },
  );
  assert.equal(rebuilt.status, 0, rebuilt.stderr);
  for (const file of [
    'schemas/agent-manifest.schema.json',
    'harness/run.js',
    'harness/agent-suite.js',
    'harness/pipeline.js',
    'agent-structure/INSTRUCTIONS.md',
    'agent-prd/assets/prd-template.md',
    'package-lock.json',
  ])
    assert.ok(fs.existsSync(path.join(root, file)), file);
  assert.equal(fs.readFileSync(path.join(root, 'SKILL.md'), 'utf8'), fs.readFileSync('scripts/bundle-root.md', 'utf8'));
});
