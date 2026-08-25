'use strict';
// WO-1 acceptance test. PRD §1 input contract, §6 validation, case 7 / 10a / 10b.
const assert = require('node:assert');
const fetch_linear_issues = require('../../tools/fetch_linear_issues.js');
const { IssueValidationError } = require('../../tools/errors.js');

const node = (id, title, statusName, statusType, assignee, updatedAt) => ({
  id: `uuid-${id}`, identifier: id, title, updatedAt,
  state: { name: statusName, type: statusType },
  assignee: assignee === null ? null : { name: assignee },
});

const mockLinear = (nodes) => async () => ({
  ok: true, status: 200,
  json: async () => ({ data: { project: { id: 'p1', name: 'Mock Project', issues: { nodes } } } }),
});

let pass = 0;
const check = (name, fn) => {
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); process.exitCode = 1; }
};

(async () => {
  console.log('WO-1 acceptance — tools/fetch_linear_issues.js\n');

  // 1. shape, exactly the five PRD §1 fields
  const five = await fetch_linear_issues('p1', { apiKey: 'k', fetchImpl: mockLinear([
    node('TUS-1', 'Alpha', 'Todo', 'unstarted', 'Ada', '2026-08-25T10:00:00.000Z'),
    node('TUS-2', 'Beta', 'In Progress', 'started', 'Bo', '2026-08-25T09:00:00.000Z'),
    node('TUS-3', 'Gamma', 'Todo', 'unstarted', 'Cy', '2026-08-25T08:00:00.000Z'),
    node('TUS-4', 'Delta', 'In Review', 'started', 'Di', '2026-08-25T07:00:00.000Z'),
    node('TUS-5', 'Epsilon', 'Todo', 'unstarted', 'Ed', '2026-08-25T06:00:00.000Z'),
  ])});
  check('returns an Array', () => assert.ok(Array.isArray(five)));
  check('returns 5 issues', () => assert.strictEqual(five.length, 5));
  check('each issue has exactly id,title,status,assignee,updatedAt', () => {
    for (const i of five) assert.deepStrictEqual(Object.keys(i).sort(),
      ['assignee', 'id', 'status', 'title', 'updatedAt']);
  });
  check('not truncated at exactly 5', () => assert.strictEqual(five.truncated, false));

  // 2. closed issues excluded
  const withClosed = await fetch_linear_issues('p1', { apiKey: 'k', fetchImpl: mockLinear([
    node('TUS-1', 'Open one', 'Todo', 'unstarted', 'Ada', '2026-08-25T10:00:00.000Z'),
    node('TUS-9', 'Done one', 'Done', 'completed', 'Ada', '2026-08-25T11:00:00.000Z'),
    node('TUS-8', 'Killed one', 'Canceled', 'canceled', 'Ada', '2026-08-25T12:00:00.000Z'),
  ])});
  check('excludes completed and canceled', () => {
    assert.strictEqual(withClosed.length, 1);
    assert.strictEqual(withClosed[0].id, 'TUS-1');
  });

  // 3. case 7 — oversized fetch truncates to 5 and reports it
  const many = Array.from({ length: 13 }, (_, i) =>
    node(`TUS-${100 + i}`, `Issue ${i}`, 'In Progress', 'started', 'Ada',
      `2026-08-${String(10 + i).padStart(2, '0')}T00:00:00.000Z`));
  const over = await fetch_linear_issues('p1', { apiKey: 'k', fetchImpl: mockLinear(many) });
  check('case 7: truncates to 5', () => assert.strictEqual(over.length, 5));
  check('case 7: truncated flag set', () => assert.strictEqual(over.truncated, true));
  check('case 7: totalOpenCount reports 13', () => assert.strictEqual(over.totalOpenCount, 13));

  // 4. case 10a — missing assignee renders deterministically
  const noAssignee = await fetch_linear_issues('p1', { apiKey: 'k', fetchImpl: mockLinear([
    node('TUS-1', 'Orphan', 'Todo', 'unstarted', null, '2026-08-25T10:00:00.000Z'),
  ])});
  check('case 10a: missing assignee -> "unassigned"', () =>
    assert.strictEqual(noAssignee[0].assignee, 'unassigned'));

  // 5. case 10b — missing title fails validation
  await (async () => {
    try {
      await fetch_linear_issues('p1', { apiKey: 'k', fetchImpl: mockLinear([
        node('TUS-1', '', 'Todo', 'unstarted', 'Ada', '2026-08-25T10:00:00.000Z'),
      ])});
      check('case 10b: missing title throws', () => { throw new Error('did not throw'); });
    } catch (e) {
      check('case 10b: missing title throws IssueValidationError', () => {
        assert.ok(e instanceof IssueValidationError, `got ${e.name}`);
        assert.strictEqual(e.failure_stage, 'validation');
        assert.match(e.message, /missing title/);
      });
    }
  })();

  // 6. deterministic ordering (byte-stable args across resume)
  const a = await fetch_linear_issues('p1', { apiKey: 'k', fetchImpl: mockLinear(many) });
  const b = await fetch_linear_issues('p1', { apiKey: 'k', fetchImpl: mockLinear([...many].reverse()) });
  check('deterministic order regardless of source order', () =>
    assert.strictEqual(JSON.stringify(a), JSON.stringify(b)));

  console.log(`\n${pass} checks passed`);
})();
