'use strict';
const assert = require('node:assert');
const { openStore, appendEvent, readRunState, canonicalJson } = require('../../store/events.js');

const DB = process.env.WO2_DB || '/tmp/wo2test.db';
const db = openStore(DB);
let pass = 0;
const check = (n, f) => { try { f(); console.log(`  PASS  ${n}`); pass++; }
  catch (e) { console.log(`  FAIL  ${n}\n        ${e.message}`); process.exitCode = 1; } };

console.log('WO-2 acceptance — store/events.js + store/schema.sql\n');

const RUN = 'test-1';
const args = { digest_text: 'In Progress\n- TUS-1 Alpha (Ada)', channel: '#agent-test' };

appendEvent(RUN, { step_name: 'run_start' }, { db });
appendEvent(RUN, { step_name: 'fetch_linear_issues_result' }, { db });
appendEvent(RUN, { step_name: 'llm_tool_selection', tool_selected: 'post_to_slack', tool_args: args }, { db });
appendEvent(RUN, { step_name: 'approval_decision', decision: 'approved', approver: 'Haniyah Umair' }, { db });
appendEvent(RUN, { step_name: 'post_to_slack_result', slack_response: { ok: true, status: 200, body: 'ok' } }, { db });
appendEvent(RUN, { step_name: 'terminal', outcome: 'posted' }, { db });

const st = readRunState(RUN, { db });
check('6 events appended', () => assert.strictEqual(st.step_count, 6));
check('step_index is 0..5 contiguous', () =>
  assert.deepStrictEqual(st.events.map((e) => e.step_index), [0, 1, 2, 3, 4, 5]));
check('selected tool readable', () => assert.strictEqual(st.selected_tool, 'post_to_slack'));
check('tool_args stored as canonical JSON', () =>
  assert.strictEqual(st.selected_args_json, canonicalJson(args)));
check('canonical JSON is key-order independent', () =>
  assert.strictEqual(canonicalJson({ b: 1, a: 2 }), canonicalJson({ a: 2, b: 1 })));
check('decision + approver readable', () => {
  assert.strictEqual(st.decision, 'approved');
  assert.strictEqual(st.approver, 'Haniyah Umair');
});
check('case 11: has_persisted_send true', () => assert.strictEqual(st.has_persisted_send, true));
check('terminal outcome readable', () => assert.strictEqual(st.outcome, 'posted'));
check('llm_call_count == 1', () => assert.strictEqual(st.llm_call_count, 1));
check('slack_post_count == 1', () => assert.strictEqual(st.slack_post_count, 1));
check('MEM-7 tenancy scoped', () => {
  assert.strictEqual(st.resource, 'utopia-studio');
  assert.strictEqual(st.thread, 'digest-test');
});
check('every row carries a git sha', () =>
  assert.ok(st.events.every((e) => e.git_sha && e.git_sha.length >= 7)));

// append-only enforcement
check('UPDATE is refused by the database', () => {
  assert.throws(() => db.exec(`UPDATE events SET outcome='declined' WHERE run_id='${RUN}'`),
    /append-only/);
});
check('DELETE is refused by the database', () => {
  assert.throws(() => db.exec(`DELETE FROM events WHERE run_id='${RUN}'`), /append-only/);
});
check('duplicate (run_id, step_index) is refused', () => {
  assert.throws(() => appendEvent(RUN, { step_name: 'dupe', step_index: 0 }, { db }), /UNIQUE|constraint/i);
});
check('unknown terminal outcome is refused', () => {
  assert.throws(() => appendEvent(RUN, { step_name: 'x', outcome: 'whatever' }, { db }), /unknown terminal outcome/);
});
check('readRunState on unknown run is empty, not an error', () => {
  const none = readRunState('no-such-run', { db });
  assert.strictEqual(none.exists, false);
  assert.strictEqual(none.step_count, 0);
});

db.close();
console.log(`\n${pass} checks passed`);
