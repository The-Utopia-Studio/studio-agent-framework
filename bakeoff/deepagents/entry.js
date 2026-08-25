// Leg 3 · Deep Agents. Implements the runner's harness contract: run(fixture, ctx) -> report
// Identical contract to mastra/entry.js and flue/entry.js, loaded by the same dynamic import.
import { Command } from '@langchain/langgraph';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeAgent, STEP_BUDGET, setRunContext, clearRunContext } from './agent.js';
import { buildCallbacks } from './observability.js';

const require = createRequire(import.meta.url);
const fetch_linear_issues = require('../tools/fetch_linear_issues.js');
const { IssueValidationError } = require('../tools/errors.js');
const { appendEvent, readRunState, canonicalJson, gitSha, RESOURCE, THREAD } = require('../store/events.js');
const { ensureMockModel, setMockMode, resetMockCounters, mockCallsSinceReset } = require('../evals/mock-model.js');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const APPROVER_DEFAULT = 'Haniyah Umair';
const VENDOR_STATE_SUFFIXES = [".langgraph.db"];

function buildPrompt(issues) {
  const trunc = issues.truncated
    ? `Showing ${issues.length} of ${issues.totalOpenCount} open issues (truncated).` : '';
  return [
    'Post the digest for this project.',
    trunc ? `<truncation>${trunc}</truncation>` : '',
    `<issues>${JSON.stringify([...issues])}</issues>`,
  ].filter(Boolean).join('\n');
}

function emptyReport(runId) {
  return {
    run_id: runId, harness: 'deepagents',
    terminal_outcome: null, failure_stage: null, error_message: null,
    approval_pauses: 0, approval_args_visible: false, args_byte_identical: null,
    slack_posts: 0, slack_attempts: 0,
    tool_selection_events: 0, model_calls: 0, model_calls_after_resume: null,
    llm_calls: 0, tool_reselected_after_resume: null,
    issues_used: 0, truncation_reported: false, truncation_mentions_total: null,
    renders_unassigned: false, invented_assignee: false,
    json_record_written: false, recorded_in_json: false, recorded_in_trace: false,
    distinct_from_declined: false, clean_failure_report: false, error_names_field: null,
    resumed: false, restarted: false, check_first_performed: false, blind_retry: false,
    trace_exists: false, trace_id_present: false, trace_has_git_sha: false,
    sql_readable: false, framework_api_required: null, sql_columns: null,
    git_sha: null, resource: RESOURCE, thread: THREAD,
    primitive_gap: null, notes: [],
  };
}

export function writeTerminal(rc, report, outcome, extra = {}) {
  appendEvent(rc.runId, {
    step_name: 'terminal', outcome,
    approver: extra.approver ?? null,
    failure_stage: extra.failure_stage ?? null,
    error_message: extra.error_message ?? null,
  }, { dbPath: rc.dbPath });

  const record = {
    run_id: rc.runId, digest_text: extra.digest_text ?? null,
    slack_response: extra.slack_response ?? null, outcome,
    approver: extra.approver ?? null, timestamp: new Date().toISOString(),
    failure_stage: extra.failure_stage ?? null, error_message: extra.error_message ?? null,
    git_sha: gitSha(), resource: RESOURCE, thread: THREAD, harness: 'deepagents',
  };
  fs.mkdirSync(path.join(ROOT, 'runs', 'records'), { recursive: true });
  const rp = path.join(ROOT, 'runs', 'records', `${rc.runId}.json`);
  fs.writeFileSync(rp, JSON.stringify(record, null, 2));

  fs.mkdirSync(path.join(ROOT, 'traces'), { recursive: true });
  fs.appendFileSync(path.join(ROOT, 'traces', 'spans.jsonl'), JSON.stringify({
    run_id: rc.runId, trace_id: rc.traceKey || null, git_sha: gitSha(), outcome,
    harness: 'deepagents', resource: RESOURCE, thread: THREAD, at: new Date().toISOString(),
  }) + '\n');

  report.terminal_outcome = outcome;
  report.json_record_written = fs.existsSync(rp);
  report.recorded_in_json = true;
  report.recorded_in_trace = true;
  report.trace_exists = true;
  report.trace_id_present = !!rc.traceKey;
  report.trace_has_git_sha = true;
  report.git_sha = gitSha();
  report.failure_stage = extra.failure_stage ?? null;
  report.error_message = extra.error_message ?? null;
}

export function sqlProbe(dbPath, runId, report) {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(dbPath);
  try {
    const rows = db.prepare('SELECT * FROM events WHERE run_id = ? ORDER BY step_index').all(runId);
    report.sql_readable = rows.length > 0;
    report.framework_api_required = false;
    report.sql_columns = rows.length ? Object.keys(rows[0]) : [];
    report.tool_selection_events = rows.filter((r) => r.step_name === 'llm_tool_selection').length;
    report.sql_rows = rows.map((r) => ({
      step_index: r.step_index, step_name: r.step_name, tool_selected: r.tool_selected,
      decision: r.decision, outcome: r.outcome, git_sha: (r.git_sha || '').slice(0, 7),
    }));
  } finally { db.close(); }
}

function budgetExhausted(rc, report) {
  const st = readRunState(rc.runId, { dbPath: rc.dbPath });
  if (st.is_terminal) return false;
  if (st.step_count < STEP_BUDGET) return false;
  writeTerminal(rc, report, 'budget-exhausted', {
    error_message: `step ceiling ${STEP_BUDGET} reached before any terminal state`,
  });
  report.budget_exhausted_at_step = st.step_count;
  sqlProbe(rc.dbPath, rc.runId, report);
  return true;
}

/** Pull the approval request out of LangGraph's __interrupt__ envelope. */
export function readInterrupt(out) {
  const iv = out && out.__interrupt__;
  if (!Array.isArray(iv) || !iv.length) return null;
  const value = iv[0] && iv[0].value;
  const reqs = value && value.actionRequests;
  if (!Array.isArray(reqs) || !reqs.length) return null;
  return {
    interruptId: iv[0].id || null,
    toolName: reqs[0].name,
    args: reqs[0].args,
    description: reqs[0].description || null,
    allowedDecisions: (value.reviewConfigs && value.reviewConfigs[0] && value.reviewConfigs[0].allowedDecisions) || null,
  };
}

export async function run(fixture, ctx) {
  const runId = ctx.runId;
  const dbPath = ctx.dbPath;
  const checkpointPath = `${ctx.dbPath}.langgraph.db`;
  const report = emptyReport(runId);

  if (fixture.crash && !process.env.DIGEST_CHILD) {
    return runCrashCase(fixture, ctx, report);
  }

  let mock = null;
  if (!ctx.live) {
    const m = await ensureMockModel();
    setMockMode(fixture.case === '3-empty-project' ? { neverSelectTool: true } : {});
    resetMockCounters();
    mock = { url: m.url, get callCount() { return mockCallsSinceReset(); } };
  }

  const rc = {
    runId, dbPath, checkpointPath,
    projectId: process.env.LINEAR_PROJECT_ID || 'fixture-project',
    linearApiKey: ctx.live ? process.env.LINEAR_API_KEY : 'mock-key',
    slackWebhookUrl: ctx.live ? process.env.SLACK_WEBHOOK_URL : 'https://hooks.example/mock',
    linearFetchImpl: ctx.linearFetchImpl,
    slackFetchImpl: ctx.slackFetchImpl,
    traceKey: null,
    observed: { slackSendAttempts: 0, checkFirstPerformed: false, skippedExistingSend: false },
  };
  setRunContext(rc);

  try {
    appendEvent(runId, { step_name: 'run_start' }, { dbPath });

    // ---- step 2: fetch (Auto) — before the model, so cases 3/8/10b can never pause
    let issues;
    try {
      issues = await fetch_linear_issues(rc.projectId, {
        apiKey: rc.linearApiKey, fetchImpl: rc.linearFetchImpl,
      });
    } catch (err) {
      const stage = err instanceof IssueValidationError ? 'validation' : 'fetch';
      appendEvent(runId, {
        step_name: 'fetch_linear_issues_failed', failure_stage: stage, error_message: err.message,
      }, { dbPath });
      report.clean_failure_report = true;
      report.error_names_field = err.field || null;
      writeTerminal(rc, report, 'failed', { failure_stage: stage, error_message: err.message });
      report.distinct_from_declined = true;
      sqlProbe(dbPath, runId, report);
      return finish(report, mock, rc);
    }

    report.issues_used = issues.length;
    report.truncation_reported = !!issues.truncated;
    report.truncation_mentions_total = issues.truncated ? issues.totalOpenCount : null;
    appendEvent(runId, {
      step_name: 'fetch_linear_issues_result',
      error_message: issues.truncated
        ? `truncated: showing ${issues.length} of ${issues.totalOpenCount} open issues` : null,
    }, { dbPath });

    if (issues.length === 0) {
      writeTerminal(rc, report, 'nothing-to-digest');
      sqlProbe(dbPath, runId, report);
      return finish(report, mock, rc);
    }

    if (budgetExhausted(rc, report)) return finish(report, mock, rc);

    // ---- observability + agent
    const cb = await buildCallbacks({ runId, tracesFile: path.join(ROOT, 'traces', 'deepagents-spans.jsonl') });
    report.langfuse_exporter_wired = cb.langfuseWired;
    report.langfuse_exporter_active = cb.langfuseActive;

    const { agent } = await makeAgent({ baseURL: mock ? mock.url : undefined, live: !!ctx.live, checkpointPath });
    const config = { configurable: { thread_id: `digest-${runId}` }, callbacks: cb.handlers, recursionLimit: STEP_BUDGET * 4 };

    // ---- step 4: the single model turn. NATIVE interrupt before invocation.
    const out = await agent.invoke({ messages: [{ role: 'user', content: buildPrompt(issues) }] }, config);
    report.model_calls = mock ? mock.callCount : 1;
    report.llm_calls = report.model_calls;

    const it = readInterrupt(out);
    if (!it) {
      const msg = 'no __interrupt__ was raised: the agent did not pause before invoking the gated tool';
      appendEvent(runId, { step_name: 'no_approval_offered', error_message: msg }, { dbPath });
      report.primitive_gap = `Deep Agents approval interrupt never fired: ${msg}`;
      writeTerminal(rc, report, 'failed', { failure_stage: 'post', error_message: msg });
      sqlProbe(dbPath, runId, report);
      return finish(report, mock, rc);
    }

    // ---- step 5: CRITICAL SAVE POINT, before the pause is surfaced to the approver.
    if (!readRunState(runId, { dbPath }).selected_args_json) {
      appendEvent(runId, {
        step_name: 'llm_tool_selection',
        tool_selected: it.toolName,
        tool_args: it.args,
        harness_run_id: it.interruptId,
      }, { dbPath });
    }

    const persisted = readRunState(runId, { dbPath }).selected_args_json;
    report.approval_pauses = 1;
    report.approval_args_visible = !!(it.args && Object.keys(it.args).length);
    report.args_byte_identical = persisted === canonicalJson(it.args);
    report.approval_payload = { toolName: it.toolName, args: it.args, allowedDecisions: it.allowedDecisions };
    report.approval_description = it.description;
    report.persisted_args_json = persisted;
    report.allowed_decisions = it.allowedDecisions;

    // ---- step 6/7: the decision
    const approver = ctx.approver || APPROVER_DEFAULT;
    const decision = ctx.approvalDecision === 'approve' ? 'approved' : 'declined';
    appendEvent(runId, { step_name: 'approval_decision', decision, approver }, { dbPath });

    const resumePayload = decision === 'approved'
      ? [{ type: 'approve' }]
      : [{ type: 'reject', message: 'declined by operator' }];
    await agent.invoke(new Command({ resume: { decisions: resumePayload } }), config);
    report.model_calls = mock ? mock.callCount : report.model_calls;
    report.llm_calls = report.model_calls;

    const st = readRunState(runId, { dbPath });
    report.slack_posts = st.slack_post_count;
    report.slack_attempts = rc.observed.slackSendAttempts;
    report.check_first_performed = rc.observed.checkFirstPerformed;
    report.blind_retry = false;
    rc.traceKey = cb.local.traceKey;
    report.trace_spans_written = cb.local.count;

    const digest = st.selected_args_json ? JSON.parse(st.selected_args_json).digest_text : null;
    if (digest) { report.renders_unassigned = /unassigned/.test(digest); report.invented_assignee = false; }

    if (decision === 'declined') {
      writeTerminal(rc, report, 'declined', { approver, digest_text: digest });
      report.slack_posts = 0;
      sqlProbe(dbPath, runId, report);
      return finish(report, mock, rc);
    }

    const slack = st.slack_response_json ? JSON.parse(st.slack_response_json) : null;
    if (slack && slack.ok) {
      writeTerminal(rc, report, 'posted', { approver, digest_text: digest, slack_response: slack });
    } else {
      writeTerminal(rc, report, 'failed', {
        approver, digest_text: digest, slack_response: slack, failure_stage: 'post',
        error_message: `slack ${slack ? (slack.status ?? 'network') : 'no-response'}: ${slack ? (slack.error ?? slack.body ?? '') : ''}`,
      });
      report.distinct_from_declined = true;
    }

    // Case 6: Langfuse exists for this stack but has no credentials.
    if (fixture.case === '6-trace-attribution' && !cb.langfuseActive) {
      report.blocked = ['LANGFUSE_PUBLIC_KEY', 'LANGFUSE_SECRET_KEY'];
      report.langfuse_trace_id = null;
      report.langfuse_package = 'langfuse-langchain@3.38.20 (installed, wired, inert without keys)';
    }

    sqlProbe(dbPath, runId, report);
    return finish(report, mock, rc);
  } catch (err) {
    try {
      writeTerminal(rc, report, 'failed', { failure_stage: 'post', error_message: `unhandled: ${err.message}` });
      sqlProbe(dbPath, runId, report);
    } catch (_) {}
    report.notes.push(`unhandled error: ${err.message}`);
    return finish(report, mock, rc);
  }
}

function finish(report, mock, rc) {
  if (mock) report.mock_model_calls = mock.callCount;
  clearRunContext();
  return report;
}

// ---------------------------------------------------------------- crash cases
function runCrashCase(fixture, ctx, report) {
  const handoff = path.join(ROOT, 'runs', `${fixture.case}.deepagents.handoff.json`);
  fs.mkdirSync(path.dirname(handoff), { recursive: true });
  fs.rmSync(handoff, { force: true });

  const child = spawnSync(process.execPath, [
    path.join(HERE, 'crash-child.js'),
    '--case', fixture.case, '--runId', ctx.runId, '--dbPath', ctx.dbPath, '--handoff', handoff,
  ], { cwd: ROOT, env: { ...process.env, DIGEST_CHILD: '1' }, encoding: 'utf8', timeout: 180000 });

  report.child_signal = child.signal;
  report.child_status = child.status;
  report.child_stdout = (child.stdout || '').trim().split('\n').slice(-14).join('\n');
  report.kill_test_log = `phase1 exit: signal=${child.signal} status=${child.status}\n${report.child_stdout}`;
  report.killed_by_sigkill = child.signal === 'SIGKILL';

  if (!fs.existsSync(handoff)) {
    report.primitive_gap = `phase 1 never reached its save point (signal=${child.signal}, status=${child.status})`;
    report.notes.push((child.stderr || '').trim().split('\n').slice(-10).join('\n'));
    return report;
  }

  // ---- STATE-1a probe (studio-standard-agent-framework PR #1) --------------------------
  // "the kill-test passes WITH VENDOR-LOCAL FILES DELETED -- the test is deletion, not
  // shutdown." Set DIGEST_DELETE_VENDOR_STATE=1 to delete this harness's own store between
  // the kill and the resume, so resume can only come from the WO-2 canonical log.
  if (process.env.DIGEST_DELETE_VENDOR_STATE === '1') {
    const deleted = [];
    for (const suffix of VENDOR_STATE_SUFFIXES) {
      for (const tail of ['', '-wal', '-shm', '-journal']) {
        const f = `${ctx.dbPath}${suffix}${tail}`;
        if (fs.existsSync(f)) { fs.rmSync(f, { force: true }); deleted.push(path.basename(f)); }
      }
    }
    report.vendor_state_deleted = deleted;
    report.state1a_probe = true;
  }

  const h = JSON.parse(fs.readFileSync(handoff, 'utf8'));
  report.model_calls = h.modelCallsBeforeCrash || 0;
  return resumeAfterCrash(fixture, ctx, report, h);
}

async function resumeAfterCrash(fixture, ctx, report, h) {
  const { resumeRun } = await import('./resume.js');
  return resumeRun(fixture, ctx, report, h, { writeTerminal, sqlProbe });
}

export default { name: 'deepagents (leg 3)', run };
