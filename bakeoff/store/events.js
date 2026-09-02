'use strict';
// WO-2 · read/write helpers over the canonical event log. PRD §5, §7.
// No harness imports: legs 2 and 3 reuse this file verbatim.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
const DEFAULT_DB = process.env.DIGEST_DB || path.join(process.cwd(), 'runs', 'events.db');

// PRD §7 tenancy: one fixed scope for the bake-off.
const RESOURCE = 'utopia-studio';
const THREAD = 'digest-test';

const TERMINAL_OUTCOMES = Object.freeze([
  'posted', 'declined', 'nothing-to-digest', 'budget-exhausted', 'failed',
]);

let _sha = null;
/** git sha for trace attribution (case 6). Never fabricated: throws if unavailable. */
function gitSha() {
  if (_sha) return _sha;
  if (process.env.GIT_SHA) return (_sha = process.env.GIT_SHA);
  try {
    _sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch (err) {
    throw new Error(`cannot resolve git sha for trace attribution: ${err.message}`);
  }
  return _sha;
}

/**
 * Canonical JSON: object keys sorted recursively, so tool_args persisted before the
 * approval pause byte-compares equal to the args presented on resume (PRD §9).
 */
function canonicalJson(value) {
  const norm = (v) => {
    if (Array.isArray(v)) return v.map(norm);
    if (v && typeof v === 'object') {
      return Object.keys(v).sort().reduce((acc, k) => { acc[k] = norm(v[k]); return acc; }, {});
    }
    return v;
  };
  return value === undefined || value === null ? null : JSON.stringify(norm(value));
}

function openStore(dbPath = DEFAULT_DB) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  return db;
}

const COLUMNS = [
  'run_id', 'step_index', 'step_name', 'timestamp', 'tool_selected', 'tool_args',
  'approver', 'decision', 'slack_response', 'outcome', 'git_sha',
  'resource', 'thread', 'failure_stage', 'error_message', 'harness_run_id',
  'duration_ms', 'blocked', 'blocked_by',
];

/**
 * Append one event. Append-only: never updates a prior row (MEM-3, LOOP-6).
 * step_index is assigned by the store, not the caller, so ordering cannot be forged.
 */
function appendEvent(runId, event, opts = {}) {
  const db = opts.db || openStore(opts.dbPath);
  const owns = !opts.db;
  try {
    if (!runId) throw new Error('appendEvent requires a run_id');
    if (!event || !event.step_name) throw new Error('appendEvent requires step_name');

    const next = db.prepare(
      'SELECT COALESCE(MAX(step_index), -1) + 1 AS n FROM events WHERE run_id = ?'
    ).get(runId).n;

    const row = {
      run_id: runId,
      step_index: Number.isInteger(event.step_index) ? event.step_index : next,
      step_name: event.step_name,
      timestamp: event.timestamp || new Date().toISOString(),
      tool_selected: event.tool_selected ?? null,
      tool_args: event.tool_args === undefined ? null
        : (typeof event.tool_args === 'string' ? event.tool_args : canonicalJson(event.tool_args)),
      approver: event.approver ?? null,
      decision: event.decision ?? null,
      slack_response: event.slack_response === undefined ? null
        : (typeof event.slack_response === 'string' ? event.slack_response : canonicalJson(event.slack_response)),
      outcome: event.outcome ?? null,
      git_sha: event.git_sha || gitSha(),
      resource: event.resource || RESOURCE,
      thread: event.thread || THREAD,
      failure_stage: event.failure_stage ?? null,
      error_message: event.error_message ?? null,
      harness_run_id: event.harness_run_id ?? null,
      duration_ms: event.duration_ms ?? null,
      blocked: event.blocked ? 1 : 0,
      blocked_by: event.blocked_by ?? null,
    };

    if (row.outcome !== null && !TERMINAL_OUTCOMES.includes(row.outcome)) {
      throw new Error(`unknown terminal outcome "${row.outcome}"`);
    }
    if (row.duration_ms !== null && (!Number.isInteger(row.duration_ms) || row.duration_ms < 0)) {
      throw new Error('duration_ms must be a non-negative integer when recorded');
    }
    if (row.blocked_by !== null && row.blocked !== 1) {
      throw new Error('blocked_by requires blocked=true');
    }

    db.prepare(
      `INSERT INTO events (${COLUMNS.join(', ')}) VALUES (${COLUMNS.map((c) => '@' + c).join(', ')})`
    ).run(row);

    return row;
  } finally {
    if (owns) db.close();
  }
}

/**
 * Positional read used by resume (PRD §5 recovery table). Returns the raw append-only
 * event list plus the derived facts resume needs — no rewriting, no interpretation
 * beyond "what is already on the log".
 */
function readRunState(runId, opts = {}) {
  const db = opts.db || openStore(opts.dbPath);
  const owns = !opts.db;
  try {
    const events = db.prepare(
      'SELECT * FROM events WHERE run_id = ? ORDER BY step_index ASC'
    ).all(runId);

    const selection = events.find((e) => e.tool_selected !== null && e.tool_args !== null) || null;
    const harnessRun = events.find((e) => e.harness_run_id !== null) || null;
    const decisionEvent = events.find((e) => e.decision !== null) || null;
    const sendEvent = events.find((e) => e.slack_response !== null) || null;
    const terminal = events.find((e) => e.outcome !== null) || null;

    return {
      run_id: runId,
      exists: events.length > 0,
      events,
      step_count: events.length,
      next_step_index: events.length ? events[events.length - 1].step_index + 1 : 0,

      // resume inputs
      selected_tool: selection ? selection.tool_selected : null,
      selected_args_json: selection ? selection.tool_args : null,   // byte-compared, never re-derived
      selection_step_index: selection ? selection.step_index : null,
      harness_run_id: harnessRun ? harnessRun.harness_run_id : null,
      decision: decisionEvent ? decisionEvent.decision : null,
      approver: decisionEvent ? decisionEvent.approver : null,

      // check-first idempotency (case 11): has a send already been persisted?
      has_persisted_send: sendEvent !== null,
      slack_response_json: sendEvent ? sendEvent.slack_response : null,

      outcome: terminal ? terminal.outcome : null,
      failure_stage: terminal ? terminal.failure_stage : null,
      is_terminal: terminal !== null,

      // counted for the §9 "LLM invoked exactly once" validator
      llm_call_count: events.filter((e) => e.step_name === 'llm_tool_selection').length,
      slack_post_count: events.filter((e) => e.step_name === 'post_to_slack_result').length,
      git_sha: events.length ? events[0].git_sha : null,
      resource: events.length ? events[0].resource : RESOURCE,
      thread: events.length ? events[0].thread : THREAD,
    };
  } finally {
    if (owns) db.close();
  }
}

module.exports = {
  openStore, appendEvent, readRunState, gitSha, canonicalJson,
  RESOURCE, THREAD, TERMINAL_OUTCOMES, DEFAULT_DB, SCHEMA_PATH,
};
