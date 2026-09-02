import assert from 'node:assert/strict';
import test from 'node:test';
import { loadManifest, validateManifest, verifyPins } from '../manifest.js';

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
