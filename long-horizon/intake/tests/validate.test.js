import assert from 'node:assert/strict';
import test from 'node:test';
import { validateRouterOutput } from '../validate.js';

test('accepts a complete router OUT with agentId and typed input', () => {
  const result = validateRouterOutput({
    agentId: 'example-leads',
    input: {
      segment: 'fintech CFOs',
      leadCount: 20,
      deliverable: 'both',
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.mayStart, true);
  assert.deepEqual(result.issues, []);
});

test('rejects half-filled input — nothing starts', () => {
  const result = validateRouterOutput({
    agentId: 'example-leads',
    input: {
      segment: 'fintech CFOs',
      // leadCount and deliverable missing
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.mayStart, false);
  const paths = result.issues.map((item) => item.path);
  assert.ok(paths.includes('input.leadCount'));
  assert.ok(paths.includes('input.deliverable'));
});

test('rejects missing agentId', () => {
  const result = validateRouterOutput({
    input: { segment: 'x', leadCount: 1, deliverable: 'qualified-list' },
  });
  assert.equal(result.mayStart, false);
  assert.ok(result.issues.some((item) => item.path === 'agentId'));
});

test('rejects unknown agentId — no schema to check against', () => {
  const result = validateRouterOutput({
    agentId: 'not-registered',
    input: { anything: true },
  });
  assert.equal(result.mayStart, false);
  assert.ok(result.issues.some((item) => item.path === 'agentId'));
});

test('low confidence must not start even with a full payload', () => {
  const result = validateRouterOutput({
    agentId: 'example-leads',
    confidence: 'low',
    question: 'Which segment — fintech CFOs or fintech VPs?',
    input: {
      segment: 'fintech',
      leadCount: 20,
      deliverable: 'qualified-list',
    },
  });
  assert.equal(result.mayStart, false);
  assert.ok(result.issues.some((item) => item.path === 'confidence'));
});
