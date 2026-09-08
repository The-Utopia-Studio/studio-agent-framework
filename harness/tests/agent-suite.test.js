import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
const original = JSON.parse(fs.readFileSync('examples/manifests/approval-gated-module.agent.json'));
test('own-agent fixtures run independently of bakeoff and reject incorrect output', () => {
  const root = fs.mkdtempSync(path.join(tmpdir(), 'studio-own-agent-'));
  fs.mkdirSync(path.join(root, 'tests/fixtures'), { recursive: true });
  const manifest = structuredClone(original);
  manifest.evaluation.output_eval.fixture_refs = ['tests/fixtures/double.json'];
  manifest.evaluation.behavior_eval.enabled = false;
  fs.writeFileSync(path.join(root, 'agent-manifest.json'), JSON.stringify(manifest));
  fs.writeFileSync(
    path.join(root, 'tests/fixtures/double.json'),
    JSON.stringify({ case: 'double', input: 2, expect: { output: 4 } }),
  );
  const adapter = path.join(root, 'adapter.mjs');
  fs.writeFileSync(
    adapter,
    'export async function run(fixture) { return { output: fixture.input * 2 }; }',
  );
  const command = [
    'harness/run.js',
    `--manifest=${path.join(root, 'agent-manifest.json')}`,
    `--agent-adapter=${adapter}`,
    `--result=${path.join(root, 'result.json')}`,
  ];
  let run = spawnSync(process.execPath, command, { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  let result = JSON.parse(fs.readFileSync(path.join(root, 'result.json')));
  assert.equal(result.status, 'incomplete');
  assert.equal(
    result.observations.find((o) => o.id === 'golden-cases').scope,
    'actual-agent-adapter',
  );
  fs.writeFileSync(adapter, 'export async function run() { return { output: 5 }; }');
  run = spawnSync(process.execPath, command, { encoding: 'utf8' });
  assert.equal(run.status, 1, run.stdout + run.stderr);
});
test('proof results for another agent are rejected', () => {
  const root = fs.mkdtempSync(path.join(tmpdir(), 'studio-proof-'));
  const checks = path.join(root, 'checks.mjs');
  fs.writeFileSync(
    checks,
    `export const checks = {'audit-log': async ({manifestHash,runId})=>({status:'PASS',detail:'wrong identity',agent_id:'other',manifest_hash:manifestHash,run_id:runId})};`,
  );
  const run = spawnSync(
    process.execPath,
    [
      'harness/run.js',
      '--manifest=examples/manifests/approval-gated-module.agent.json',
      `--checks=${checks}`,
      `--result=${path.join(root, 'result.json')}`,
    ],
    { encoding: 'utf8' },
  );
  assert.equal(run.status, 1, run.stdout + run.stderr);
  const result = JSON.parse(fs.readFileSync(path.join(root, 'result.json')));
  assert.ok(result.failures.some((f) => f.check_id === 'audit-log'));
});
