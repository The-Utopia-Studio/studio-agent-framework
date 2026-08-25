'use strict';
// WO-7 acceptance: the half of check-first that actually prevents a duplicate.
// Case 11's crash point lands BEFORE the send, so it only proves "found nothing, sent once".
// This asserts the inverse: when a send record IS on the log, resume must NOT call Slack.
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { openStore, appendEvent, canonicalJson } = require('../../store/events.js');

(async () => {
  const dbPath = path.join(process.cwd(), 'runs', 'wo7-checkfirst.db');
  for (const s of ['', '-wal', '-shm', '.mastra.db']) fs.rmSync(dbPath + s, { force: true });

  const runId = `wo7-checkfirst-${Date.now()}`;
  const args = { digest_text: '*Todo*\n- TUS-1 Alpha (unassigned)' };
  const priorResponse = { ok: true, status: 200, body: 'ok', error: null, postedAt: '2026-08-25T08:00:00.000Z' };

  const db = openStore(dbPath);
  appendEvent(runId, { step_name: 'run_start' }, { db });
  appendEvent(runId, { step_name: 'fetch_linear_issues_result' }, { db });
  appendEvent(runId, { step_name: 'llm_tool_selection', tool_selected: 'post_to_slack',
    tool_args: args, harness_run_id: 'mastra-run-does-not-matter' }, { db });
  appendEvent(runId, { step_name: 'approval_decision', decision: 'approved', approver: 'Haniyah Umair' }, { db });
  // The send already happened AND was persisted before the crash.
  appendEvent(runId, { step_name: 'post_to_slack_result', slack_response: priorResponse }, { db });
  db.close();

  // A Slack impl that must never be called. If check-first is broken, this fires.
  let slackCalls = 0;
  const slackFetchImpl = async () => { slackCalls++; return { status: 200, text: async () => 'DUPLICATE' }; };

  const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', '11-post-crash-duplicate-check.json'), 'utf8'));
  const { resumeRun } = await import('../../mastra/resume.js');

  const report = {
    notes: [], terminal_outcome: null, slack_posts: 0, slack_attempts: 0,
    check_first_performed: false, blind_retry: false,
  };
  const out = await resumeRun(fixture,
    { runId, dbPath, live: false, approvalDecision: 'approve', slackFetchImpl },
    report,
    { mastraRunId: 'mastra-run-does-not-matter', toolCallId: 'toolu_x',
      presentedArgs: args, argsJson: canonicalJson(args) });

  const checks = [
    ['check-first ran', () => assert.strictEqual(out.check_first_performed, true)],
    ['existing send record was found', () => assert.strictEqual(out.persisted_send_found_on_resume, true)],
    ['send was SKIPPED', () => assert.strictEqual(out.skipped_send_due_to_existing_record, true)],
    ['Slack was never called again', () => assert.strictEqual(slackCalls, 0)],
    ['no blind retry', () => assert.strictEqual(out.blind_retry, false)],
    ['still exactly 1 recorded post', () => assert.strictEqual(out.slack_posts, 1)],
    ['terminal written from persisted response', () => assert.strictEqual(out.terminal_outcome, 'posted')],
  ];
  let pass = 0;
  console.log('WO-7 acceptance — check-first SKIPS the send when a record already exists\n');
  for (const [n, f] of checks) {
    try { f(); console.log(`  PASS  ${n}`); pass++; }
    catch (e) { console.log(`  FAIL  ${n}\n        ${e.message}`); process.exitCode = 1; }
  }
  console.log(`\n${pass}/${checks.length} checks passed`);
  console.log(`slack fetch impl invocations on resume: ${slackCalls}  (must be 0)`);
  process.exit(process.exitCode || 0);
})();
