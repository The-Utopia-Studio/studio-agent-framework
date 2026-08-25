// Leg 3 · resume before approval (case 4) and check-first idempotency (case 11).
// This module READS. It never re-decides (PRD §5).
import { Command } from '@langchain/langgraph';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeAgent, setRunContext, clearRunContext } from './agent.js';
import { buildCallbacks } from './observability.js';

const require = createRequire(import.meta.url);
const { appendEvent, readRunState, canonicalJson } = require('../store/events.js');
const { ensureMockModel, setMockMode, resetMockCounters, mockCallsSinceReset } = require('../evals/mock-model.js');
const { makeLinearFetch, makeSlackFetch } = require('../evals/mocks.js');
const post_to_slack = require('../tools/post_to_slack.js');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');

export async function resumeRun(fixture, ctx, report, h, helpers) {
  const runId = ctx.runId;
  const dbPath = ctx.dbPath;

  const st = readRunState(runId, { dbPath });
  report.resumed = st.exists && st.selected_args_json !== null;
  report.restarted = false;
  report.tool_selection_events = st.llm_call_count;
  report.args_byte_identical = st.selected_args_json === canonicalJson(h.presentedArgs);
  report.approval_pauses = 1;
  report.approval_args_visible = !!(h.presentedArgs && Object.keys(h.presentedArgs).length);
  report.approval_payload = { toolName: st.selected_tool, args: h.presentedArgs, allowedDecisions: h.allowedDecisions };
  report.persisted_args_json = st.selected_args_json;
  report.harness_run_id = st.harness_run_id;
  report.langgraph_thread_id = h.threadId;
  report.resume_read_from = 'WO-2 SQLite event log (not the harness checkpoint store)';

  const mockSrv = await ensureMockModel();
  setMockMode({});
  resetMockCounters();

  const rc = {
    runId, dbPath, checkpointPath: h.checkpointPath,
    projectId: 'fixture-project', linearApiKey: 'mock-key',
    slackWebhookUrl: 'https://hooks.example/mock',
    linearFetchImpl: makeLinearFetch(fixture.linear),
    slackFetchImpl: makeSlackFetch(fixture.slack),
    traceKey: null,
    observed: { slackSendAttempts: 0, checkFirstPerformed: false, skippedExistingSend: false },
  };
  setRunContext(rc);

  const approver = ctx.approver || 'Haniyah Umair';

  // ---- CHECK-FIRST, before anything is re-invoked (PRD §5, case 11, LOOP-6)
  const beforeSend = readRunState(runId, { dbPath });
  report.check_first_performed = true;
  report.persisted_send_found_on_resume = beforeSend.has_persisted_send;

  if (beforeSend.has_persisted_send) {
    const persisted = JSON.parse(beforeSend.slack_response_json);
    report.blind_retry = false;
    report.skipped_send_due_to_existing_record = true;
    report.slack_posts = beforeSend.slack_post_count;
    report.slack_attempts = 0;
    helpers.writeTerminal(rc, report, persisted.ok ? 'posted' : 'failed', {
      approver, slack_response: persisted,
      digest_text: JSON.parse(beforeSend.selected_args_json).digest_text,
      failure_stage: persisted.ok ? null : 'post',
    });
    helpers.sqlProbe(dbPath, runId, report);
    clearRunContext();
    return report;
  }

  // ---- the approval decision. Case 4 decides now; case 11's survived the crash.
  if (!beforeSend.decision) {
    const decision = ctx.approvalDecision === 'approve' ? 'approved' : 'declined';
    appendEvent(runId, { step_name: 'approval_decision', decision, approver }, { dbPath });
    report.approval_decided_on_resume = true;
  } else {
    report.approval_decided_on_resume = false;
    report.approval_survived_crash = beforeSend.decision;
  }

  // ---- attempt the HARNESS's own resume: a fresh process, same checkpoint file and
  //      thread id, resumed with a Command. Nothing in memory carries over.
  const callsBefore = mockCallsSinceReset();
  let nativeResume = 'failed', nativeErr = null;
  try {
    const cb = await buildCallbacks({ runId, tracesFile: path.join(ROOT, 'traces', 'deepagents-spans.jsonl') });
    const { agent } = await makeAgent({ baseURL: mockSrv.url, live: false, checkpointPath: h.checkpointPath });
    const config = { configurable: { thread_id: h.threadId }, callbacks: cb.handlers };
    const resumePayload = ctx.approvalDecision === 'approve'
      ? [{ type: 'approve' }]
      : [{ type: 'reject', message: 'declined by operator' }];
    await agent.invoke(new Command({ resume: { decisions: resumePayload } }), config);
    rc.traceKey = cb.local.traceKey;
    nativeResume = 'succeeded';
  } catch (err) {
    nativeErr = `${err.name}: ${err.message}`;
  }
  report.model_calls_after_resume = mockCallsSinceReset() - callsBefore;
  report.harness_native_resume = nativeResume;
  report.harness_native_resume_error = nativeErr;

  const afterNative = readRunState(runId, { dbPath });
  report.tool_selection_events = afterNative.llm_call_count;
  report.tool_reselected_after_resume = afterNative.llm_call_count > 1;

  if (!afterNative.has_persisted_send && ctx.approvalDecision === 'approve') {
    report.notes.push('harness-native resume did not reach the send; replayed persisted args via the portable tool function');
    const argsFromLog = JSON.parse(afterNative.selected_args_json);
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
    report.resume_path = 'native: fresh process resumed the checkpointed thread with Command({resume})';
  }

  const final = readRunState(runId, { dbPath });
  report.slack_posts = final.slack_post_count;
  report.slack_attempts = rc.observed.slackSendAttempts;
  report.blind_retry = false;
  const resp = final.slack_response_json ? JSON.parse(final.slack_response_json) : null;
  const digest = final.selected_args_json ? JSON.parse(final.selected_args_json).digest_text : null;
  if (digest) report.renders_unassigned = /unassigned/.test(digest);

  if (ctx.approvalDecision !== 'approve') {
    helpers.writeTerminal(rc, report, 'declined', { approver, digest_text: digest });
  } else {
    helpers.writeTerminal(rc, report, resp && resp.ok ? 'posted' : 'failed', {
      approver, digest_text: digest, slack_response: resp,
      failure_stage: resp && resp.ok ? null : 'post',
      error_message: resp && resp.ok ? null : 'slack send failed on resume',
    });
  }
  helpers.sqlProbe(dbPath, runId, report);
  clearRunContext();
  return report;
}
