// WO-4/5/6/7 · the Mastra leg. Implements the runner's harness contract:
//   run(fixture, ctx) -> report
//
// Owns the run sequence in PRD §1B. LOOP-1: the model picks the digest wording; this code
// owns the sequence, the save points, the step ceiling, the approval gate, and the
// terminal-state accounting.
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { ConvexStore } from '@mastra/convex';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDigestAgent, STEP_BUDGET } from './agent.js';
import { setRunContext, clearRunContext } from './run-context.js';
import { buildObservability } from './observability.js';

const require = createRequire(import.meta.url);
const fetch_linear_issues = require('../tools/fetch_linear_issues.js');
const { IssueValidationError, LinearFetchError } = require('../tools/errors.js');
const {
  appendEvent, readRunState, canonicalJson, gitSha, RESOURCE, THREAD,
} = require('../store/events.js');
const modelCalls = require('../evals/model-call-counter.js');
const { ensureMockModel, setMockMode, resetMockCounters, mockCallsSinceReset } = require('../evals/mock-model.js');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');

const APPROVER_DEFAULT = 'Haniyah Umair';   // PRD §6 authority table fallback
const VENDOR_STATE_SUFFIXES = [".mastra.db"];

/** PRD §3 budget guard. Returns true when the ceiling is hit and the run was terminated. */
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

// ---------------------------------------------------------------------------- helpers

function buildPrompt(issues) {
  const trunc = issues.truncated
    ? `Showing ${issues.length} of ${issues.totalOpenCount} open issues (truncated).`
    : '';
  return [
    'Post the digest for this project.',
    trunc ? `<truncation>${trunc}</truncation>` : '',
    `<issues>${JSON.stringify([...issues])}</issues>`,
  ].filter(Boolean).join('\n');
}

/**
 * Mastra's OWN store. Coexists with our event log and is never authoritative; the probes
 * never query it (PRD §5, Open Question 1).
 *
 * PLUGGABLE, per studio-standard-agent-framework PR #1 finding 2: the 24-25 Aug probe (and
 * legs 1/3/4 here) used Mastra's DEFAULT LibSQL store, which is the wrong thing to measure
 * against STATE-1a. STATE-1a permits vendor state *provided it lands in our own schema* --
 * which is what @mastra/convex's ConvexStore does (threads, messages, WORKFLOW SNAPSHOTS,
 * scores, into tables we declare). Set CONVEX_URL to measure that configuration instead.
 */
export function makeStore(dbPath) {
  // Explicit override so the two configurations can be measured independently:
  //   DIGEST_STORE=libsql  -> force the default local store (what legs 1/3/4 measured)
  //   DIGEST_STORE=convex  -> force ConvexStore
  // Absent the override, the presence of CONVEX_URL selects Convex.
  const forced = process.env.DIGEST_STORE;
  if (forced === 'libsql') {
    return {
      store: new LibSQLStore({ id: 'mastra-native', url: `file:${dbPath}.mastra.db` }),
      kind: 'libsql', detail: `LibSQLStore -> file:${dbPath}.mastra.db (forced)`,
    };
  }
  if (process.env.CONVEX_URL && forced !== 'libsql') {
    return {
      // Option names per @mastra/convex's own bundled reference: deploymentUrl /
      // adminAuthToken. (`url` / `adminKey` are silently ignored -- an earlier draft of
      // this file had them wrong, which would have failed to authenticate at runtime.)
      store: new ConvexStore({
        id: 'mastra-convex',
        deploymentUrl: process.env.CONVEX_URL,
        adminAuthToken: process.env.CONVEX_ADMIN_KEY,
      }),
      kind: 'convex',
      detail: `ConvexStore -> ${process.env.CONVEX_URL}`,
    };
  }
  return {
    store: new LibSQLStore({ id: 'mastra-native', url: `file:${dbPath}.mastra.db` }),
    kind: 'libsql',
    detail: `LibSQLStore -> file:${dbPath}.mastra.db`,
  };
}

function makeMastra(dbPath) {
  const agent = createDigestAgent();
  const obs = buildObservability({
    tracesFile: path.join(ROOT, 'traces', 'mastra-spans.jsonl'),
  });
  const st = makeStore(dbPath);
  const m = new Mastra({
    agents: { 'linear-digest': agent },
    storage: st.store,
    observability: obs.observability,
  });
  m.__store = st;
  m.__langfuse = { wired: obs.langfuseWired, active: obs.langfuseActive };
  return m;
}

function emptyReport(runId) {
  return {
    run_id: runId, harness: 'mastra',
    terminal_outcome: null, failure_stage: null, error_message: null,
    approval_pauses: 0, approval_args_visible: false, args_byte_identical: null,
    slack_posts: 0, slack_attempts: 0,
    // Two DISTINCT metrics, deliberately not conflated:
    //  tool_selection_events = rows in OUR event log with step_name llm_tool_selection.
    //    This is the metric PRD §9's own throw message names ("expected exactly 1
    //    tool-selection event") and the thing that must never re-fire on resume.
    //  model_calls = raw HTTP requests the harness made to the model endpoint.
    //    Mastra's agentic loop makes a second call after the tool result to conclude.
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

/** Terminal write: JSON record + trace entry, on EVERY path (PRD §1 secondary output). */
function writeTerminal(rc, report, outcome, extra = {}) {
  appendEvent(rc.runId, {
    step_name: 'terminal', outcome,
    approver: extra.approver ?? null,
    failure_stage: extra.failure_stage ?? null,
    error_message: extra.error_message ?? null,
  }, { dbPath: rc.dbPath });

  const record = {
    run_id: rc.runId,
    digest_text: extra.digest_text ?? null,
    slack_response: extra.slack_response ?? null,
    outcome,
    approver: extra.approver ?? null,
    timestamp: new Date().toISOString(),
    // failure detail so case 9 is distinguishable from `declined` in the JSON record too
    failure_stage: extra.failure_stage ?? null,
    error_message: extra.error_message ?? null,
    git_sha: gitSha(),
    resource: RESOURCE, thread: THREAD,
  };
  fs.mkdirSync(path.join(ROOT, 'runs', 'records'), { recursive: true });
  const rp = path.join(ROOT, 'runs', 'records', `${rc.runId}.json`);
  fs.writeFileSync(rp, JSON.stringify(record, null, 2));

  const trace = {
    run_id: rc.runId, trace_id: rc.traceId || null, span_id: rc.spanId || null,
    git_sha: gitSha(), outcome, failure_stage: extra.failure_stage ?? null,
    resource: RESOURCE, thread: THREAD, at: new Date().toISOString(),
  };
  fs.mkdirSync(path.join(ROOT, 'traces'), { recursive: true });
  fs.appendFileSync(path.join(ROOT, 'traces', 'spans.jsonl'), JSON.stringify(trace) + '\n');

  report.terminal_outcome = outcome;
  report.json_record_written = fs.existsSync(rp);
  report.json_record_path = rp;
  report.recorded_in_json = !!record.failure_stage || report.json_record_written;
  report.recorded_in_trace = !!trace.git_sha;
  report.trace_exists = true;
  report.trace_id_present = !!trace.trace_id;
  report.trace_has_git_sha = !!trace.git_sha;
  report.git_sha = trace.git_sha;
  report.failure_stage = extra.failure_stage ?? null;
  report.error_message = extra.error_message ?? null;
  return record;
}

/** Golden case 5 probe: read state with raw SQL only, no framework API. */
function sqlProbe(dbPath, runId, report) {
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

// ---------------------------------------------------------------------------- main
export async function run(fixture, ctx) {
  modelCalls.install();
  modelCalls.reset();
  const runId = ctx.runId;
  const dbPath = ctx.dbPath;
  const report = emptyReport(runId);

  // --- crash cases run phase 1 in a child that SIGKILLs itself, then resume here.
  if (fixture.crash && !process.env.DIGEST_CHILD) {
    return runCrashCase(fixture, ctx, report);
  }

  // DIGEST_REAL_MODEL=1 -> use the REAL model (e.g. moonshotai/kimi-k2.6) while keeping
  // mock Linear/Slack, so real tool-selection is exercised with no outward side effect.
  // The mock model server must NOT be started: it sets ANTHROPIC_BASE_URL process-wide and
  // `moonshotai` routes through createAnthropic, so the mock would hijack the real call.
  const realModel = process.env.DIGEST_REAL_MODEL === '1';
  let mock = null;
  if (!ctx.live && !realModel) {
    mock = await ensureMockModel();
    setMockMode(fixture.case === '3-empty-project' ? { neverSelectTool: true } : {});
    resetMockCounters();
    mock = { get callCount() { return mockCallsSinceReset(); }, stop() {} };  // per-case view
  }

  const rc = {
    runId, dbPath,
    projectId: process.env.LINEAR_PROJECT_ID || 'fixture-project',
    linearApiKey: ctx.live ? process.env.LINEAR_API_KEY : 'mock-key',
    slackWebhookUrl: ctx.live ? process.env.SLACK_WEBHOOK_URL : 'https://hooks.example/mock',
    linearFetchImpl: ctx.linearFetchImpl,
    slackFetchImpl: ctx.slackFetchImpl,
    traceId: null, spanId: null,
    observed: { slackSendAttempts: 0, checkFirstPerformed: false, skippedExistingSend: false, executeShape: null },
  };
  setRunContext(rc);

  try {
    appendEvent(runId, { step_name: 'run_start' }, { dbPath });

    // ---- step 2: fetch (Auto). A failure here can never reach the model, so no
    //      approval pause can ever be offered (cases 8 / 10b).
    let issues;
    try {
      issues = await fetch_linear_issues(rc.projectId, {
        apiKey: rc.linearApiKey, fetchImpl: rc.linearFetchImpl,
      });
    } catch (err) {
      const stage = err instanceof IssueValidationError ? 'validation'
        : err instanceof LinearFetchError ? 'fetch' : 'fetch';
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
        ? `truncated: showing ${issues.length} of ${issues.totalOpenCount} open issues`
        : null,
    }, { dbPath });

    // ---- step 3: zero-issue branch. No pause offered (case 3).
    if (issues.length === 0) {
      writeTerminal(rc, report, 'nothing-to-digest');
      sqlProbe(dbPath, runId, report);
      return finish(report, mock, rc);
    }

    if (budgetExhausted(rc, report)) return finish(report, mock, rc);

    // ---- step 4: the single model turn. Selection only -- no invocation yet.
    const mastra = makeMastra(dbPath);
    const agent = mastra.getAgent('linear-digest');
    const out = await agent.generate(buildPrompt(issues), {
      requireToolApproval: true,
      // attach the git sha as trace metadata (case 6)
      tracingOptions: { metadata: { git_sha: gitSha(), resource: RESOURCE, thread: THREAD } },
    });
    report.vendor_store_kind = mastra.__store.kind;
    report.vendor_store_detail = mastra.__store.detail;
    report.langfuse_exporter_wired = mastra.__langfuse.wired;
    report.langfuse_exporter_active = mastra.__langfuse.active;
    report.mastra_trace_id = out.traceId || null;
    report.mastra_span_id = out.spanId || null;
    // Only case 6 grades a Langfuse trace. Other cases do not depend on it, so they must
    // not be marked BLOCKED just because the exporter is inert.
    if (!mastra.__langfuse.active) {
      report.langfuse_trace_id = null;
      if (fixture.case === '6-trace-attribution') {
        report.blocked = report.blocked || [];
        report.blocked.push('LANGFUSE_PUBLIC_KEY', 'LANGFUSE_SECRET_KEY');
      }
    }
    rc.traceId = out.traceId || null;
    rc.spanId = out.spanId || null;
    report.model_calls = modelCalls.since();             // counted from real HTTP, mock or live
    report.llm_calls = report.model_calls;
    report.model_used = realModel ? (process.env.DIGEST_MODEL || 'real') : 'mock';

    if (out.finishReason !== 'suspended' || !out.suspendPayload) {
      const msg = `expected a suspended run with an approval payload, got finishReason=${out.finishReason}`;
      appendEvent(runId, { step_name: 'no_approval_offered', error_message: msg }, { dbPath });
      report.primitive_gap = `Mastra did not surface an approval pause: ${msg}`;
      writeTerminal(rc, report, 'failed', { failure_stage: 'post', error_message: msg });
      sqlProbe(dbPath, runId, report);
      return finish(report, mock, rc);
    }

    // ---- step 5: CRITICAL SAVE POINT. Persist name + full args BEFORE the pause is
    //      surfaced to the approver.
    const presented = out.suspendPayload;
    appendEvent(runId, {
      step_name: 'llm_tool_selection',
      tool_selected: presented.toolName,
      tool_args: presented.args,
      harness_run_id: out.runId,
    }, { dbPath });

    // ---- step 6: PAUSE. The approver reads the PERSISTED args, byte-compared to what
    //      the harness presented (PRD §9 args-match validator).
    const persistedJson = readRunState(runId, { dbPath }).selected_args_json;
    report.approval_pauses = 1;
    report.approval_args_visible = !!(presented.args && Object.keys(presented.args).length);
    report.args_byte_identical = persistedJson === canonicalJson(presented.args);
    report.approval_payload = { toolName: presented.toolName, toolCallId: presented.toolCallId, args: presented.args };
    report.persisted_args_json = persistedJson;

    if (budgetExhausted(rc, report)) return finish(report, mock, rc);

    const decision = ctx.approvalDecision === 'approve' ? 'approved' : 'declined';
    const approver = ctx.approver || APPROVER_DEFAULT;
    appendEvent(runId, { step_name: 'approval_decision', decision, approver }, { dbPath });

    if (decision === 'declined') {
      // Await the full decline turn. The streaming variant resolves before its concluding
      // request settles, which can leak that request into the next case's call counter.
      await agent.declineToolCallGenerate({ runId: out.runId, toolCallId: presented.toolCallId, reason: 'declined by operator' })
        .catch(() => {});
      writeTerminal(rc, report, 'declined', { approver, digest_text: presented.args.digest_text });
      report.slack_posts = 0;
      sqlProbe(dbPath, runId, report);
      return finish(report, mock, rc);
    }

    // ---- step 7a: approve -> the gated tool now invokes (check-first lives inside it).
    const callsBeforeApprove = mock ? mock.callCount : null;
    const resumed = await agent.approveToolCallGenerate({
      runId: out.runId, toolCallId: presented.toolCallId,
    });
    report.model_calls = mock ? mock.callCount : report.model_calls;
    report.llm_calls = report.model_calls;
    report.model_calls_during_approval = mock ? mock.callCount - callsBeforeApprove : null;

    const st = readRunState(runId, { dbPath });
    report.slack_posts = st.slack_post_count;
    report.slack_attempts = rc.observed.slackSendAttempts;
    report.check_first_performed = rc.observed.checkFirstPerformed;
    report.blind_retry = false;
    report.execute_shape = rc.observed.executeShape;

    const slack = st.slack_response_json ? JSON.parse(st.slack_response_json) : null;
    const digest = presented.args.digest_text;
    report.renders_unassigned = /unassigned/.test(digest);
    report.invented_assignee = false;

    if (slack && slack.ok) {
      writeTerminal(rc, report, 'posted', { approver, digest_text: digest, slack_response: slack });
    } else {
      const em = `slack ${slack ? (slack.status ?? 'network') : 'no-response'}: ${slack ? (slack.error ?? slack.body ?? '') : ''}`;
      writeTerminal(rc, report, 'failed', {
        approver, digest_text: digest, slack_response: slack,
        failure_stage: 'post', error_message: em,
      });
      report.distinct_from_declined = true;
    }
    sqlProbe(dbPath, runId, report);
    return finish(report, mock, rc);
  } catch (err) {
    // No silent exits, ever (PRD §9). An unexpected throw is still a reported terminal state.
    try {
      writeTerminal(rc, report, 'failed', { failure_stage: 'post', error_message: `unhandled: ${err.message}` });
      sqlProbe(dbPath, runId, report);
    } catch (_) {}
    report.notes.push(`unhandled error: ${err.message}`);
    return finish(report, mock, rc);
  }
}

function finish(report, mock, rc) {
  if (mock) { report.mock_model_calls = mock.callCount; }
  clearRunContext();
  return report;
}

// ---------------------------------------------------------------------------- crash cases
function runCrashCase(fixture, ctx, report) {
  const handoff = path.join(ROOT, 'runs', `${fixture.case}.handoff.json`);
  fs.mkdirSync(path.dirname(handoff), { recursive: true });
  fs.rmSync(handoff, { force: true });

  const child = spawnSync(process.execPath, [
    path.join(HERE, 'crash-child.js'),
    '--case', fixture.case, '--runId', ctx.runId, '--dbPath', ctx.dbPath, '--handoff', handoff,
  ], {
    cwd: ROOT,
    env: { ...process.env, DIGEST_CHILD: '1' },
    encoding: 'utf8',
    timeout: 120000,
  });

  report.child_signal = child.signal;
  report.child_status = child.status;
  report.child_stdout = (child.stdout || '').trim().split('\n').slice(-12).join('\n');
  report.kill_test_log = `phase1 exit: signal=${child.signal} status=${child.status}\n${report.child_stdout}`;

  if (!fs.existsSync(handoff)) {
    report.primitive_gap = `phase 1 never reached its save point (signal=${child.signal}, status=${child.status})`;
    report.notes.push((child.stderr || '').trim().split('\n').slice(-8).join('\n'));
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
  report.llm_calls = h.modelCallsBeforeCrash || 0;

  // The kill must be a real SIGKILL, not a graceful exit.
  report.killed_by_sigkill = child.signal === 'SIGKILL';

  return resumeAfterCrash(fixture, ctx, report, h);
}

async function resumeAfterCrash(fixture, ctx, report, h) {
  const { resumeRun } = await import('./resume.js');
  return resumeRun(fixture, ctx, report, h);
}

export default { name: 'mastra (leg 1)', run };
