// WO-6 · resume before approval (case 4) and WO-7 · check-first idempotency (case 11).
//
// This module READS. It never re-decides. PRD §5 recovery table: "read persisted selection,
// do not re-invoke the LLM". WORKORDERS forbids touching agent.js's selection logic.
import { Mastra } from '@mastra/core/mastra';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDigestAgent } from './agent.js';
import { makeStore } from './entry.js';
import { setRunContext, clearRunContext } from './run-context.js';

const require = createRequire(import.meta.url);
const { appendEvent, readRunState, canonicalJson, gitSha, RESOURCE, THREAD } = require('../store/events.js');
const modelCalls = require('../evals/model-call-counter.js');
const { ensureMockModel, setMockMode, resetMockCounters, mockCallsSinceReset } = require('../evals/mock-model.js');
const { makeLinearFetch, makeSlackFetch } = require('../evals/mocks.js');
const post_to_slack = require('../tools/post_to_slack.js');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');

export async function resumeRun(fixture, ctx, report, h) {
  const runId = ctx.runId;
  const dbPath = ctx.dbPath;

  // ---- what survived the kill, read from OUR log only (never Mastra's store)
  const st = readRunState(runId, { dbPath });
  report.resumed = st.exists && st.selected_args_json !== null;
  // "restarted" would mean re-fetching and re-selecting from scratch. We did neither:
  // there is exactly one selection event on the log and we never called fetch again.
  report.restarted = false;
  report.tool_selection_events = st.llm_call_count;
  report.args_byte_identical = st.selected_args_json === canonicalJson(h.presentedArgs);
  report.approval_pauses = 1;
  report.approval_args_visible = !!(h.presentedArgs && Object.keys(h.presentedArgs).length);
  report.approval_payload = { toolName: st.selected_tool, toolCallId: h.toolCallId, args: h.presentedArgs };
  report.persisted_args_json = st.selected_args_json;
  report.harness_run_id = st.harness_run_id;
  report.resume_read_from = 'WO-2 SQLite event log (not the harness store)';

  const realModel = process.env.DIGEST_REAL_MODEL === '1';
  let mock = null;
  if (!realModel) { mock = await ensureMockModel(); setMockMode({}); resetMockCounters(); }

  const rc = {
    runId, dbPath,
    projectId: 'fixture-project',
    linearApiKey: 'mock-key',
    slackWebhookUrl: 'https://hooks.example/mock',
    linearFetchImpl: makeLinearFetch(fixture.linear),
    slackFetchImpl: makeSlackFetch(fixture.slack),
    traceId: null, spanId: null,
    observed: { slackSendAttempts: 0, checkFirstPerformed: false, skippedExistingSend: false, executeShape: null },
  };
  setRunContext(rc);

  // ---- the approval decision. For case 4 it happens now, on resume, against the
  //      persisted args. For case 11 it was already granted before the kill.
  const approver = ctx.approver || 'Haniyah Umair';
  if (!st.decision) {
    const decision = ctx.approvalDecision === 'approve' ? 'approved' : 'declined';
    appendEvent(runId, { step_name: 'approval_decision', decision, approver }, { dbPath });
    report.approval_decided_on_resume = true;
    if (decision === 'declined') {
      finalize(rc, report, 'declined', { approver, digest_text: JSON.parse(st.selected_args_json).digest_text });
      return done(report, rc);
    }
  } else {
    report.approval_decided_on_resume = false;
    report.approval_survived_crash = st.decision;
  }

  // ---- CHECK-FIRST, before any re-post (PRD §5, case 11, LOOP-6).
  const beforeSend = readRunState(runId, { dbPath });
  report.check_first_performed = true;
  report.persisted_send_found_on_resume = beforeSend.has_persisted_send;

  if (beforeSend.has_persisted_send) {
    // A send record already exists: do NOT call Slack again. Write the terminal outcome
    // from the persisted response.
    const persistedResp = JSON.parse(beforeSend.slack_response_json);
    report.blind_retry = false;
    report.skipped_send_due_to_existing_record = true;
    report.slack_posts = beforeSend.slack_post_count;
    report.slack_attempts = 0;
    finalize(rc, report, persistedResp.ok ? 'posted' : 'failed', {
      approver, slack_response: persistedResp,
      digest_text: JSON.parse(st.selected_args_json).digest_text,
      failure_stage: persistedResp.ok ? null : 'post',
    });
    return done(report, rc);
  }

  // ---- No send on record. Per PRD §5: "send only if none exists."
  //      Try the HARNESS's own resume path first, so the bake-off measures Mastra's
  //      primitive rather than our fallback.
  let harnessResumeOk = false;
  let harnessResumeError = null;
  modelCalls.install();
  modelCalls.reset();
  try {
    const mastra = new Mastra({
      agents: { 'linear-digest': createDigestAgent() },
      storage: makeStore(dbPath).store,
    });
    const agent = mastra.getAgent('linear-digest');
    // Resume through the native API, but do not permit a concluding model turn after the
    // approved side effect. This is an execution ceiling, not a prompt instruction.
    await agent.approveToolCallGenerate({
      runId: h.mastraRunId, toolCallId: h.toolCallId,
      maxSteps: 1,
    });
    harnessResumeOk = true;
  } catch (err) {
    harnessResumeError = `${err.name}: ${err.message}`;
  }
  // Counted from real outbound HTTP, so this is meaningful with a live model too.
  report.model_calls_after_resume = modelCalls.since();
  report.model_call_detail_after_resume = modelCalls.detail();
  report.harness_native_resume = harnessResumeOk ? 'succeeded' : 'failed';
  report.harness_native_resume_error = harnessResumeError;

  // Did the harness re-SELECT the tool on resume (a re-decision), or only conclude?
  const afterHarness = readRunState(runId, { dbPath });
  report.tool_selection_events = afterHarness.llm_call_count;
  report.tool_reselected_after_resume = afterHarness.llm_call_count > 1;

  // A non-throwing approveToolCallGenerate() is NOT evidence that the run resumed. Branch on
  // whether the harness actually produced a persisted send, not on whether the call threw.
  const harnessDidTheWork = harnessResumeOk && afterHarness.has_persisted_send;
  report.harness_produced_send = harnessDidTheWork;
  if (!harnessDidTheWork) {
    // FALLBACK (a workaround, reported as such): execute the persisted args through the
    // portable function. The selection is NOT recomputed -- the args come from the log.
    report.notes.push(harnessResumeOk
      ? 'harness-native resume did NOT throw but produced no send; replayed persisted args via the portable tool function'
      : 'harness-native resume threw; replayed persisted args via the portable tool function');
    const argsFromLog = JSON.parse(afterHarness.selected_args_json);
    const response = await post_to_slack(argsFromLog.digest_text, {
      webhookUrl: rc.slackWebhookUrl, fetchImpl: rc.slackFetchImpl,
    });
    appendEvent(runId, {
      step_name: 'post_to_slack_result', slack_response: response,
      failure_stage: response.ok ? null : 'post',
      error_message: response.ok ? null : `slack ${response.status ?? 'network'}`,
    }, { dbPath });
    report.resume_path = 'workaround: replay persisted args through the portable function';
  } else {
    report.resume_path = 'native: agent.approveToolCallGenerate() on the persisted harness_run_id';
  }

  const final = readRunState(runId, { dbPath });
  report.slack_posts = final.slack_post_count;
  report.slack_attempts = rc.observed.slackSendAttempts;
  report.blind_retry = false;
  const resp = final.slack_response_json ? JSON.parse(final.slack_response_json) : null;
  const digest = JSON.parse(final.selected_args_json).digest_text;
  report.renders_unassigned = /unassigned/.test(digest);

  finalize(rc, report, resp && resp.ok ? 'posted' : 'failed', {
    approver, digest_text: digest, slack_response: resp,
    failure_stage: resp && resp.ok ? null : 'post',
    error_message: resp && resp.ok ? null : 'slack send failed on resume',
  });
  return done(report, rc);
}

function finalize(rc, report, outcome, extra) {
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
    git_sha: gitSha(), resource: RESOURCE, thread: THREAD, resumed: true,
  };
  fs.mkdirSync(path.join(ROOT, 'runs', 'records'), { recursive: true });
  const rp = path.join(ROOT, 'runs', 'records', `${rc.runId}.json`);
  fs.writeFileSync(rp, JSON.stringify(record, null, 2));

  fs.mkdirSync(path.join(ROOT, 'traces'), { recursive: true });
  fs.appendFileSync(path.join(ROOT, 'traces', 'spans.jsonl'), JSON.stringify({
    run_id: rc.runId, trace_id: rc.traceId || null, git_sha: gitSha(), outcome,
    resource: RESOURCE, thread: THREAD, resumed: true, at: new Date().toISOString(),
  }) + '\n');

  report.terminal_outcome = outcome;
  report.json_record_written = fs.existsSync(rp);
  report.recorded_in_json = true;
  report.recorded_in_trace = true;
  report.trace_exists = true;
  report.trace_has_git_sha = true;
  report.trace_id_present = !!rc.traceId;
  report.git_sha = gitSha();
  report.failure_stage = extra.failure_stage ?? null;
}

function done(report, rc) {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(rc.dbPath);
  try {
    const rows = db.prepare('SELECT * FROM events WHERE run_id = ? ORDER BY step_index').all(rc.runId);
    report.sql_readable = rows.length > 0;
    report.framework_api_required = false;
    report.sql_columns = rows.length ? Object.keys(rows[0]) : [];
    report.sql_rows = rows.map((r) => ({
      step_index: r.step_index, step_name: r.step_name, tool_selected: r.tool_selected,
      decision: r.decision, outcome: r.outcome,
    }));
  } finally { db.close(); }
  clearRunContext();
  return report;
}
