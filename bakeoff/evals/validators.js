'use strict';
// WO-8 · PRD §9 validator checklist as an AUTOMATED gate.
// The runner calls runAll() on EVERY case, not just the happy path. Each validator reads
// the WO-2 event log with raw SQL -- never a framework API (MEM-8) -- and carries the exact
// THROW string the PRD specifies, so a failure message is actionable (EVAL-5: "validator
// error messages say exactly what to fix").
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');

const RESOURCE = 'utopia-studio';   // PRD §7 tenancy
const THREAD = 'digest-test';

// PRD §2 names four terminal states. Cases 8 / 9 / 10b each require a failure recorded
// DISTINCTLY from `declined`, and none of the four fits -- so a fifth, `failed`, exists.
// Recorded as a PRD inconsistency in FINDINGS.md, not silently absorbed.
const TERMINAL = ['posted', 'declined', 'nothing-to-digest', 'budget-exhausted', 'failed'];

function rowsFor(dbPath, runId) {
  if (!dbPath || !fs.existsSync(dbPath)) return null;
  const db = new DatabaseSync(dbPath);
  try {
    return db.prepare('SELECT * FROM events WHERE run_id = ? ORDER BY step_index').all(runId);
  } finally { db.close(); }
}

function runAll(report, fixture, ctx) {
  const out = [];
  const add = (key, ok, msg, detail) => out.push({ key, ok, msg: ok ? '' : msg, actual: detail });

  const runId = ctx.runId;
  const rows = rowsFor(ctx.dbPath, runId);

  if (!rows) {
    add('V0-event-log-exists', false,
      `no event log found at ${ctx.dbPath} for run ${runId} - a run that writes no events cannot be graded`);
    return out;
  }
  add('V0-event-log-exists', rows.length > 0,
    `event log for run ${runId} is empty - silent exit is a hard failure`);

  // --- V1 · args-match, byte-for-byte -------------------------------------------------
  const selection = rows.find((r) => r.tool_selected !== null && r.tool_args !== null) || null;
  if (!selection) {
    // Legitimately absent: no selection ever happened (empty project, fetch failure).
    add('V1-args-match', true, '', 'n/a - no tool selection in this run');
  } else {
    const presented = report.approval_payload ? report.approval_payload.args : undefined;
    if (presented === undefined) {
      add('V1-args-match', false,
        `Approval payload drift: presented args do not match persisted tool_args for run ${runId} (harness reported no approval payload)`);
    } else {
      const norm = (v) => {
        const n = (x) => Array.isArray(x) ? x.map(n)
          : (x && typeof x === 'object'
            ? Object.keys(x).sort().reduce((a, k) => (a[k] = n(x[k]), a), {})
            : x);
        return JSON.stringify(n(v));
      };
      const ok = selection.tool_args === norm(presented);
      add('V1-args-match', ok,
        `Approval payload drift: presented args do not match persisted tool_args for run ${runId}`,
        ok ? 'byte-identical' : { persisted: selection.tool_args, presented: norm(presented) });
    }
  }

  // --- V2 · exactly one Slack send per run -------------------------------------------
  const posts = rows.filter((r) => r.step_name === 'post_to_slack_result').length;
  add('V2-single-send', posts <= 1,
    `Duplicate send detected for run ${runId}: found ${posts} Slack POSTs, expected <=1`, posts);

  // --- V3 · exactly one tool-selection event, never re-fired on resume ---------------
  const selections = rows.filter((r) => r.step_name === 'llm_tool_selection').length;
  if (selections === 0) {
    add('V3-single-llm-selection', true, '', 'n/a - no selection expected in this run');
  } else {
    add('V3-single-llm-selection', selections === 1,
      `LLM re-invoked on resume for run ${runId}: expected exactly 1 tool-selection event`, selections);
  }

  // --- V4 · malformed-issue rejection ------------------------------------------------
  // The fetch validator must have rejected a malformed issue rather than digesting it.
  const validationFailure = rows.find((r) => r.failure_stage === 'validation') || null;
  const expectsValidationFailure = fixture.expect && fixture.expect.failure_stage === 'validation';
  if (expectsValidationFailure) {
    const ok = !!validationFailure && /missing \w+ - failing run per Gate 6 validation/.test(validationFailure.error_message || '');
    add('V4-malformed-issue-rejected', ok,
      `Malformed issue in fetch response: expected a validation-stage rejection for run ${runId} with the Gate 6 message`,
      validationFailure ? validationFailure.error_message : null);
  } else {
    add('V4-malformed-issue-rejected', !validationFailure,
      `unexpected validation failure for run ${runId}: ${validationFailure && validationFailure.error_message}`,
      'n/a');
  }

  // --- V5 · exactly one terminal state, never a silent exit ---------------------------
  const terminals = rows.filter((r) => r.outcome !== null);
  if (terminals.length === 0) {
    add('V5-terminal-state', false,
      `Run ${runId} ended without a recorded terminal state - silent exit is a hard failure`, 0);
  } else if (terminals.length > 1) {
    add('V5-terminal-state', false,
      `Run ${runId} recorded ${terminals.length} terminal states, expected exactly 1`,
      terminals.map((t) => t.outcome));
  } else {
    const o = terminals[0].outcome;
    add('V5-terminal-state', TERMINAL.includes(o),
      `Run ${runId} recorded an unknown terminal state "${o}"`, o);
  }

  // --- V8 · a `failed` outcome must name its stage (PRD §9, ratified 2026-08-25) -----
  const failedTerminal = rows.find((r) => r.outcome === 'failed') || null;
  if (failedTerminal) {
    const ok = ['fetch', 'validation', 'post'].includes(failedTerminal.failure_stage);
    add('V8-failure-stage-named', ok,
      `Run ${runId} recorded outcome=failed with no failure_stage - a failure must be distinguishable from a decline and from the other failure stages`,
      failedTerminal.failure_stage);
  } else {
    add('V8-failure-stage-named', true, '', 'n/a - no failed outcome');
  }

  // --- V6 · tenancy (WO-8 scope, MEM-7) ----------------------------------------------
  const offScope = rows.filter((r) => r.resource !== RESOURCE || r.thread !== THREAD);
  add('V6-tenancy-scoped', offScope.length === 0,
    `${offScope.length} event(s) for run ${runId} are outside resource=${RESOURCE}/thread=${THREAD}`,
    offScope.length ? offScope.map((r) => `${r.step_name}:${r.resource}/${r.thread}`) : `${rows.length} rows all in scope`);

  // --- V7 · append-only (MEM-3, LOOP-6) ----------------------------------------------
  const idx = rows.map((r) => r.step_index);
  const contiguous = idx.every((v, i) => v === i);
  add('V7-append-only-contiguous', contiguous,
    `step_index sequence for run ${runId} is not contiguous from 0: ${idx.join(',')}`, idx.join(','));

  return out;
}

module.exports = { runAll, TERMINAL, RESOURCE, THREAD };
