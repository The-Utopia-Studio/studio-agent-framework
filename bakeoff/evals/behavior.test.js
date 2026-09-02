'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { gradeBehavior } = require('./behavior.js');

test('accepts a complete, gradeable background cycle', () => {
  const result = gradeBehavior([
    { step_index: 0, step_name: 'precondition_checked', duration_ms: 12, blocked: 0 },
    { step_index: 1, step_name: 'agent_decision', duration_ms: 48, blocked: 0 },
    { step_index: 2, step_name: 'terminal', blocked: 0 },
  ], { requirePreflight: true, requireDurations: true });
  assert.equal(result.pass, true);
});

test('rejects an unexplained block and missing preflight', () => {
  const result = gradeBehavior([
    { step_index: 0, step_name: 'agent_decision', duration_ms: 48, blocked: 1 },
  ], { requirePreflight: true, requireDurations: true });
  assert.equal(result.pass, false);
  assert.deepEqual(result.results.filter((row) => !row.ok).map((row) => row.key), [
    'B2-blocks-explained', 'B3-preflight-recorded',
  ]);
});
