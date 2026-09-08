import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { validateStructure } from '../../harness/structure.js';
import { checkSkills } from '../check-skills.mjs';
test('all framework skills have valid metadata and resolvable direct references', () => {
  assert.deepEqual(checkSkills(process.cwd()), []);
});
test('skill profile needs no runtime, but rejects mismatched folder names', () => {
  const root = fs.mkdtempSync(path.join(tmpdir(), 'studio-structure-'));
  const dir = path.join(root, 'news-digest');
  fs.mkdirSync(dir);
  fs.writeFileSync(
    path.join(dir, 'SKILL.md'),
    '---\nname: news-digest\ndescription: Draft a digest.\n---\nUse provided sources.',
  );
  assert.deepEqual(validateStructure(dir, 'skill'), []);
  fs.renameSync(dir, path.join(root, 'wrong'));
  assert.ok(validateStructure(path.join(root, 'wrong'), 'skill').length);
  assert.ok(validateStructure(path.join(root, 'wrong'), 'coded').length);
});
