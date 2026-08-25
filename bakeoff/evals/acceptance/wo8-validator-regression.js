'use strict';
// WO-8 acceptance, second half: "Regression-test the validator itself: deliberately break
// one invariant (e.g. force a duplicate send) and confirm the validator catches it."
// A validator nobody has seen fail is not a gate, it is decoration.
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { openStore, appendEvent, canonicalJson } = require('../../store/events.js');
const { runAll } = require('../validators.js');

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', '1-happy-path.json'), 'utf8'));
const args = { digest_text: '*Todo*\n- TUS-1 Alpha (unassigned)' };

function seed(dbPath, runId, mutate = {}) {
  for (const s of ['', '-wal', '-shm']) fs.rmSync(dbPath + s, { force: true });
  const db = openStore(dbPath);
  appendEvent(runId, { step_name: 'run_start' }, { db });
  appendEvent(runId, { step_name: 'fetch_linear_issues_result' }, { db });
  if (!mutate.noSelection) {
    appendEvent(runId, { step_name: 'llm_tool_selection', tool_selected: 'post_to_slack', tool_args: args }, { db });
  }
  if (mutate.duplicateSelection) {
    appendEvent(runId, { step_name: 'llm_tool_selection', tool_selected: 'post_to_slack', tool_args: args }, { db });
  }
  appendEvent(runId, { step_name: 'approval_decision', decision: 'approved', approver: 'Haniyah Umair' }, { db });
  appendEvent(runId, { step_name: 'post_to_slack_result', slack_response: { ok: true, status: 200, body: 'ok' } }, { db });
  if (mutate.duplicateSend) {
    appendEvent(runId, { step_name: 'post_to_slack_result', slack_response: { ok: true, status: 200, body: 'ok-again' } }, { db });
  }
  if (mutate.offTenancy) {
    appendEvent(runId, { step_name: 'stray', resource: 'someone-else', thread: 'other' }, { db });
  }
  if (!mutate.noTerminal) appendEvent(runId, { step_name: 'terminal', outcome: 'posted' }, { db });
  db.close();
}

const scenarios = [
  { name: 'BASELINE: intact run', mutate: {}, argsPresented: args, expectFail: [] },
  { name: 'BREAK V1: presented args differ from persisted',
    mutate: {}, argsPresented: { digest_text: 'TAMPERED' }, expectFail: ['V1-args-match'] },
  { name: 'BREAK V2: forced duplicate send',
    mutate: { duplicateSend: true }, argsPresented: args, expectFail: ['V2-single-send'] },
  { name: 'BREAK V3: LLM re-fired (two selection events)',
    mutate: { duplicateSelection: true }, argsPresented: args, expectFail: ['V3-single-llm-selection'] },
  { name: 'BREAK V5: silent exit, no terminal state',
    mutate: { noTerminal: true }, argsPresented: args, expectFail: ['V5-terminal-state'] },
  { name: 'BREAK V6: event written outside the tenancy scope',
    mutate: { offTenancy: true }, argsPresented: args, expectFail: ['V6-tenancy-scoped'] },
];

let pass = 0, total = 0;
console.log('WO-8 acceptance — validator regression: each invariant is deliberately broken\n');
for (const sc of scenarios) {
  const runId = `wo8-${scenarios.indexOf(sc)}-${Date.now()}`;
  const dbPath = path.join(process.cwd(), 'runs', `wo8-${scenarios.indexOf(sc)}.db`);
  seed(dbPath, runId, sc.mutate);

  const report = { approval_payload: { toolName: 'post_to_slack', args: sc.argsPresented } };
  const results = runAll(report, fixture, { runId, dbPath });
  const failed = results.filter((r) => !r.ok).map((r) => r.key).sort();
  const expected = [...sc.expectFail].sort();

  total++;
  try {
    assert.deepStrictEqual(failed, expected);
    console.log(`  PASS  ${sc.name}`);
    console.log(`        validators that fired: ${failed.length ? failed.join(', ') : '(none, as expected)'}`);
    for (const r of results.filter((x) => !x.ok)) console.log(`        -> ${r.msg}`);
    pass++;
  } catch (e) {
    console.log(`  FAIL  ${sc.name}`);
    console.log(`        expected to fire: ${expected.join(', ') || '(none)'}`);
    console.log(`        actually fired  : ${failed.join(', ') || '(none)'}`);
    process.exitCode = 1;
  }
}
console.log(`\n${pass}/${total} regression scenarios behaved correctly`);
