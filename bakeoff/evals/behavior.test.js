'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { gradeBehavior } = require('./behavior.js');

test('accepts a complete, gradeable background cycle', () => {
  const result = gradeBehavior(
    [
      { step_index: 0, step_name: 'precondition_checked', duration_ms: 12, blocked: 0 },
      { step_index: 1, step_name: 'agent_decision', duration_ms: 48, blocked: 0 },
      { step_index: 2, step_name: 'terminal', blocked: 0 },
    ],
    { requirePreflight: true, requireDurations: true },
  );
  assert.equal(result.pass, true);
});

test('rejects an unexplained block and missing preflight', () => {
  const result = gradeBehavior(
    [{ step_index: 0, step_name: 'agent_decision', duration_ms: 48, blocked: 1 }],
    { requirePreflight: true, requireDurations: true },
  );
  assert.equal(result.pass, false);
  assert.deepEqual(
    result.results.filter((row) => !row.ok).map((row) => row.key),
    ['B2-blocks-explained', 'B3-preflight-recorded'],
  );
});

test('preflight after an effect is not a passing preflight', () => {
  assert.equal(
    gradeBehavior(
      [
        { step_name: 'external_action', step_index: 0 },
        { step_name: 'precondition_checked', step_index: 1 },
      ],
      { requirePreflight: true },
    ).pass,
    false,
  );
});
test('approval must precede and match the tenant, action and payload', () => {
  const approval = {
    step_name: 'approval_granted',
    step_index: 0,
    action_id: 'a',
    tenant_id: 't',
    payload_hash: 'h',
    approved: true,
    principal: 'owner',
    authorized_principal: 'service',
    scope: 'send',
  };
  const effect = {
    step_name: 'send',
    step_index: 1,
    effect: 'external-write',
    principal: 'service',
    scope: 'send',
    action_id: 'a',
    tenant_id: 't',
    payload_hash: 'h',
  };
  assert.equal(gradeBehavior([approval, effect], { requireApproval: true }).pass, true);
  for (const change of [
    { tenant_id: 'other' },
    { payload_hash: 'changed' },
    { step_index: 2 },
    { authorized_principal: 'other' },
    { scope: 'admin' },
  ])
    assert.equal(
      gradeBehavior([{ ...approval, ...change }, effect], { requireApproval: true }).pass,
      false,
    );
});
