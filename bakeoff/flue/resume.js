// Leg 4 · resume before approval (case 4) and check-first idempotency (case 11).
// This module READS. It never re-decides. PRD §5: "read persisted selection, do not
// re-invoke the LLM."
import { start, sqlite } from '@flue/runtime/node';
import { init } from '@flue/runtime';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LinearDigest, setRunContext, clearRunContext } from './agent.js';
import { installApprovalGate } from './approval-gate.js';
import { mockProvider, MOCK_MODEL } from './provider.js';

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
  const flueDb = `${dbPath}.flue.db`;

  // ---- what survived the kill, read from OUR log only (never Flue's stream)
  const st = readRunState(runId, { dbPath });
  report.resumed = st.exists && st.selected_args_json !== null;
  report.restarted = false;
  report.tool_selection_events = st.llm_call_count;
  report.args_byte_identical = st.selected_args_json === canonicalJson(h.presentedArgs);
  report.approval_pauses = 1;
  report.approval_args_visible = !!(h.presentedArgs && Object.keys(h.presentedArgs).length);
  report.approval_payload = { toolName: st.selected_tool, args: h.presentedArgs };
  report.persisted_args_json = st.selected_args_json;
  report.harness_run_id = st.harness_run_id;
  report.flue_submission_id = h.submissionId;
  report.resume_read_from = 'WO-2 SQLite event log (not the harness stream)';

  const mockSrv = await ensureMockModel();
  setMockMode({});
  resetMockCounters();
  process.env.FLUE_MODEL = MOCK_MODEL;

  const rc = {
    runId, dbPath, flueDb,
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

  // ---- attempt the HARNESS's own recovery: a fresh runtime over the same durable
  //      stream should reconcile the interrupted submission on startup.
  const gate = installApprovalGate({
    gatedTool: 'post_to_slack',
    onSelected: async (args, toolCallId) => {
      // Must not append a second selection event on resume (PRD §9 / V3).
      if (readRunState(runId, { dbPath }).selected_args_json) return;
      appendEvent(runId, {
        step_name: 'llm_tool_selection', tool_selected: 'post_to_slack',
        tool_args: args, harness_run_id: toolCallId,
      }, { dbPath });
    },
    decide: async () => (ctx.approvalDecision === 'approve' ? 'approved' : 'declined'),
    onDecision: async (decision) => {
      const s = readRunState(runId, { dbPath });
      if (!s.decision) {
        appendEvent(runId, { step_name: 'approval_decision', decision, approver }, { dbPath });
        report.approval_decided_on_resume = true;
      } else {
        report.approval_decided_on_resume = false;
        report.approval_survived_crash = s.decision;
      }
    },
    declinedResult: () => ({ output: { ok: false, status: null, body: null, skipped_existing_send: false } }),
  });

  const callsBefore = mockCallsSinceReset();
  let nativeResume = 'failed', nativeErr = null;
  let flue = null;
  try {
    flue = await start({
      agents: [{ agent: LinearDigest, name: 'LinearDigest' }],
      db: sqlite(flueDb),
      providers: [mockProvider(mockSrv.url)],
      env: { ...process.env, OPENAI_API_KEY: 'sk-mock' },
    });
    const handle = init(LinearDigest, { id: h.instanceId });
    // Re-attachable read: "a read works from any process at any later time".
    await handle.read(h.submissionId);
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
  report.approval_pauses = Math.max(1, gate.state.pauses);

  if (!afterNative.has_persisted_send && ctx.approvalDecision === 'approve') {
    // FALLBACK, reported as such: replay the PERSISTED args through the portable function.
    // The selection is never recomputed.
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
    report.resume_path = 'native: fresh Flue runtime reconciled the interrupted submission on startup';
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

  try { await gate.dispose(); } catch (_) {}
  if (flue) { try { await flue.stop(); } catch (_) {} }
  clearRunContext();
  return report;
}
