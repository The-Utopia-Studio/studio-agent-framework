// Leg 4 · the Flue agent and its one gated tool.
//
// Same shape as leg 1 (mastra/agent.js): the orchestrator owns the fetch (PRD §1B steps
// 2-3, LOOP-1) so a failed or empty fetch can never reach the approval gate (cases 3/8/10b),
// and post_to_slack is the single registered tool (TOOL-1).
import { defineTool, useModel, useTool } from '@flue/runtime';
import * as v from 'valibot';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const post_to_slack = require('../tools/post_to_slack.js');
const { appendEvent, readRunState } = require('../store/events.js');

export const STEP_BUDGET = Number(process.env.DIGEST_STEP_BUDGET || 10);

// Per-process run context. Same rationale as leg 1: one run per process in the runner.
let RC = null;
export function setRunContext(c) { RC = c; }
export function getRunContext() {
  if (!RC) throw new Error('flue run context not set');
  return RC;
}
export function clearRunContext() { RC = null; }

export const postToSlackTool = defineTool({
  name: 'post_to_slack',
  description: 'Post the finished digest to the #agent-test Slack channel.',
  input: v.object({ digest_text: v.string() }),
  // durable:true so a crash mid-call is RE-EXECUTED on recovery instead of being settled
  // with an unknown-outcome marker. Without it, Flue tells the model the call's outcome is
  // unknown and the model may re-select the tool -- which would break PRD §9's
  // "exactly 1 tool-selection event". See FINDINGS.md.
  durable: true,
  async run({ data, step, toolCallId }) {
    const rc = getRunContext();

    // ---- CHECK-FIRST (PRD §5, case 11, LOOP-6) ----------------------------------------
    // Our event log is the authority, not Flue's stream.
    const prior = readRunState(rc.runId, { dbPath: rc.dbPath });
    rc.observed.checkFirstPerformed = true;
    if (prior.has_persisted_send) {
      rc.observed.skippedExistingSend = true;
      const persisted = JSON.parse(prior.slack_response_json);
      return { output: {
        ok: !!persisted.ok, status: persisted.status ?? null,
        body: persisted.body ?? null, skipped_existing_send: true,
      }, terminate: true };
    }

    // step.do records its value durably before resolving, so a re-execution of this call
    // replays the send instead of repeating it (Flue's own idempotency primitive).
    const response = await step.do(`slack-send:${toolCallId}`, async () => {
      const r = await post_to_slack(data.digest_text, {
        webhookUrl: rc.slackWebhookUrl, fetchImpl: rc.slackFetchImpl,
      });
      rc.observed.slackSendAttempts++;
      return r;
    });

    // Second save point (PRD §5): persist the Slack response on receipt.
    if (!readRunState(rc.runId, { dbPath: rc.dbPath }).has_persisted_send) {
      appendEvent(rc.runId, {
        step_name: 'post_to_slack_result',
        slack_response: response,
        failure_stage: response.ok ? null : 'post',
        error_message: response.ok ? null : `slack ${response.status ?? 'network'}: ${response.error ?? response.body ?? ''}`,
      }, { dbPath: rc.dbPath });
    }

    // `terminate: true` ends the agent's turn once this tool batch settles -- the
    // documented loop-ending contract. This is what makes PRD case 4's "LLM not
    // re-invoked" reachable: without it Flue makes a concluding model call after the
    // tool result. Mastra needed an UNdocumented `stopWhen` predicate for the same thing.
    return { output: {
      ok: response.ok, status: response.status,
      body: response.body, skipped_existing_send: false,
    }, terminate: true };
  },
});

export const INSTRUCTIONS = `You write a status digest of open Linear issues and post it to Slack.

You are given the open issues in the user message. Do exactly this, once:
1. Draft one digest grouped by issue status, 2-3 lines per status group.
2. Call post_to_slack exactly once with the drafted digest as digest_text.

Rules:
- Use only the issues given. Never invent an issue, a title, or an assignee.
- If an issue's assignee is "unassigned", write "unassigned". Never guess a name.
- If a truncation notice is present, repeat it explicitly in the digest. Never present a
  truncated list as the complete set.
- Do not ask the user questions. Do not call any tool more than once.`;

/** The agent function. Flue's durable identity is the function name. */
export function LinearDigest() {
  useModel(process.env.FLUE_MODEL || 'mock/digest-mock');
  useTool(postToSlackTool);
  return INSTRUCTIONS;
}
