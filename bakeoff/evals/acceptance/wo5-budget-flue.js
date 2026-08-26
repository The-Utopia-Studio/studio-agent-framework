'use strict';
// Leg 4 acceptance: the budget-exhausted terminal state. No golden case covers it
// (the PRD task bank has none), so it is asserted directly here.
// LOOP-3: proves the ceiling is a runaway guard that still produces a REPORTED terminal
// state -- never a silent exit.
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  process.env.DIGEST_STEP_BUDGET = '2';   // fetch + run_start alone will trip it
  const dbPath = path.join(process.cwd(), 'runs', 'wo5-budget-flue.db');
  for (const s of ['', '-wal', '-shm']) fs.rmSync(dbPath + s, { force: true });

  const { run } = await import('../../flue/entry.js');
  const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', '1-happy-path.json'), 'utf8'));
  const runId = `wo5-budget-${Date.now()}`;

  const report = await run(fixture, {
    runId, dbPath, live: false,
    linearFetchImpl: async () => ({ ok: true, status: 200,
      json: async () => ({ data: { project: { id: 'p', name: 'P', issues: { nodes: fixture.linear.nodes } } } }) }),
    slackFetchImpl: async () => ({ status: 200, text: async () => 'ok' }),
    approvalDecision: 'approve', crash: null,
  });

  const checks = [
    ['terminal state is budget-exhausted', () => assert.strictEqual(report.terminal_outcome, 'budget-exhausted')],
    ['run was reported, not silent', () => assert.strictEqual(report.json_record_written, true)],
    ['no Slack post occurred', () => assert.strictEqual(report.slack_posts, 0)],
    ['state left SQL-readable', () => assert.strictEqual(report.sql_readable, true)],
    ['ceiling recorded', () => assert.ok(report.budget_exhausted_at_step >= 2)],
  ];
  let pass = 0;
  console.log('Leg 4 acceptance — budget-exhausted terminal state (DIGEST_STEP_BUDGET=2)\n');
  for (const [n, f] of checks) {
    try { f(); console.log(`  PASS  ${n}`); pass++; }
    catch (e) { console.log(`  FAIL  ${n}\n        ${e.message}`); process.exitCode = 1; }
  }
  console.log(`\n${pass}/${checks.length} checks passed`);
  console.log(`terminal_outcome=${report.terminal_outcome} at step ${report.budget_exhausted_at_step}`);
  process.exit(process.exitCode || 0);
})();
