import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { loadManifest, resolveFixtureCases, validateManifest, verifyPins } from '../manifest.js';

const approval = loadManifest('examples/manifests/approval-gated-module.agent.json');
const techNews = loadManifest('examples/manifests/tech-news-reference.agent.json');

test('both reference manifests satisfy executable contract rules', () => {
  assert.deepEqual(validateManifest(approval), []);
  assert.deepEqual(validateManifest(techNews), []);
});

test('rejects a range pin, missing scheduled preflight, and unsafe external write', () => {
  const bad = structuredClone(approval);
  bad.runtime.packages[0].version = '^1.63.2';
  bad.lifecycle.trigger = 'schedule';
  bad.operations.preflight.required = false;
  bad.tools[1].idempotency = 'not-needed';
  const issues = validateManifest(bad).map((failure) => failure.path);
  assert.ok(issues.includes('runtime.packages[0].version'));
  assert.ok(issues.includes('operations.preflight.required'));
  assert.ok(issues.includes('tools[1].idempotency'));
});

test('rejects verified claims backed by an unenforced check', () => {
  const bad = structuredClone(approval);
  bad.conformance[0].status = 'verified';
  bad.conformance[0].check.enforcement = 'none';
  delete bad.conformance[0].check.command;
  assert.ok(validateManifest(bad).some((failure) => failure.path === 'conformance[0]'));
});

test('compares pins against both package manifest and lockfile', () => {
  assert.deepEqual(verifyPins(approval, 'bakeoff/mastra/package.json', 'bakeoff/mastra/package-lock.json'), []);
  const bad = structuredClone(approval);
  bad.runtime.packages[0].version = '1.61.0';
  assert.ok(verifyPins(bad, 'bakeoff/mastra/package.json', 'bakeoff/mastra/package-lock.json').length > 0);
});

test('resolves only repository-owned fixture references', () => {
  assert.deepEqual(resolveFixtureCases(approval).cases, ['4-crash-resume', '11-post-crash-duplicate-check']);
  const bad = structuredClone(approval);
  bad.evaluation.output_eval.fixture_refs = ['../../package.json'];
  assert.equal(resolveFixtureCases(bad).issues.length, 1);
});

test('runner executes manifest-selected cases through an explicit adapter and writes a result', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agent-manifest-runner-'));
  const adapterPath = join(dir, 'adapter.cjs');
  const resultPath = join(dir, 'result.json');
  // This adapter only exercises runner plumbing. The real Mastra adapter is exercised in CI.
  writeFileSync(adapterPath, `
    const { DatabaseSync } = require('node:sqlite');
    const fs = require('node:fs');
    const path = require('node:path');
    module.exports = {
      name: 'fixture-echo',
      run: async (fixture, ctx) => {
        fs.mkdirSync(path.dirname(ctx.dbPath), { recursive: true });
        const db = new DatabaseSync(ctx.dbPath);
        db.exec('CREATE TABLE events (run_id TEXT, step_index INTEGER, step_name TEXT, tool_selected TEXT, tool_args TEXT, outcome TEXT, failure_stage TEXT, error_message TEXT, resource TEXT, thread TEXT)');
        const add = db.prepare('INSERT INTO events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        add.run(ctx.runId, 0, 'llm_tool_selection', null, null, null, null, null, 'utopia-studio', 'digest-test');
        add.run(ctx.runId, 1, 'terminal', null, null, 'posted', null, null, 'utopia-studio', 'digest-test');
        db.close();
        return { ...fixture.expect, slack_posts: 0 };
      },
    };
  `);
  const run = spawnSync(process.execPath, [
    'harness/run.js',
    '--manifest=examples/manifests/approval-gated-module.agent.json',
    `--adapter=${adapterPath}`,
    `--result=${resultPath}`,
  ], { encoding: 'utf8' });
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  assert.match(run.stdout, /2 manifest-selected fixture\(s\) passed/);
  const result = JSON.parse(readFileSync(resultPath, 'utf8'));
  assert.equal(result.status, 'passed');
  assert.deepEqual(result.observations.find((item) => item.id === 'golden-cases').cases, ['4-crash-resume', '11-post-crash-duplicate-check']);
});

test('runner fails when the shared evaluator reports a non-passing verdict', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agent-manifest-runner-'));
  const adapterPath = join(dir, 'adapter.cjs');
  const resultPath = join(dir, 'result.json');
  writeFileSync(adapterPath, "module.exports = { run: async (fixture) => ({ ...fixture.expect, slack_posts: 0 }) };\n");
  const run = spawnSync(process.execPath, [
    'harness/run.js',
    '--manifest=examples/manifests/approval-gated-module.agent.json',
    `--adapter=${adapterPath}`,
    `--result=${resultPath}`,
  ], { encoding: 'utf8' });
  assert.equal(run.status, 1);
  assert.match(run.stdout, /FAIL\s+golden-cases/);
  const result = JSON.parse(readFileSync(resultPath, 'utf8'));
  assert.equal(result.status, 'failed');
  assert.equal(result.failures[0].id, 'golden-cases');
});
