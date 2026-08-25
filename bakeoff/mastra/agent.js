import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { createRequire } from 'node:module';
import { getRunContext } from './run-context.js';

// WO-1's plain portable functions, imported verbatim. Legs 2 and 3 import these same files.
const require = createRequire(import.meta.url);
const fetch_linear_issues = require('../tools/fetch_linear_issues.js');
const post_to_slack = require('../tools/post_to_slack.js');
const { appendEvent, readRunState, canonicalJson } = require('../store/events.js');

// PRD §3: hard ceiling, enforced in code, never in a prompt (LOOP-8).
// LOOP-3: a step cap is a runaway guard, NOT a definition of done -- the verifiable exit is
// reaching one of the terminal states; this is the budget guard that sits alongside it.
export const STEP_BUDGET = Number(process.env.DIGEST_STEP_BUDGET || 10);

// NOTE (recorded in FINDINGS.md): PRD §8 lists fetch_linear_issues as a tool, but §1B
// makes it step 2 (Auto) with the zero-issue decision at step 3 -- BEFORE the model turn at
// step 4. Cases 3 / 8 / 10b all require that no approval pause can ever be offered when the
// fetch is empty or fails, which is only guaranteeable if the fetch precedes the model.
// So the orchestrator calls WO-1's plain function directly (LOOP-1: our code owns the loop)
// and post_to_slack is the single registered Mastra tool (TOOL-1: fewer tools, no dead ones).

/** Mastra tool #2 — the gated write. requireApproval puts the pause between
 *  tool SELECTION and tool INVOCATION (PRD §8, LOOP-5). */
export const postToSlackTool = createTool({
  id: 'post_to_slack',
  description: 'Post the finished digest to the #agent-test Slack channel. Requires human approval.',
  inputSchema: z.object({ digest_text: z.string().min(1) }),
  outputSchema: z.object({
    ok: z.boolean(), status: z.number().nullable(),
    body: z.string().nullable(), skipped_existing_send: z.boolean(),
  }),
  requireApproval: true,
  execute: async (input, execOpts) => {
    const rc = getRunContext();
    // Mastra's execute shape is not documented for this version; record it once, then
    // read the payload defensively so a shape change fails loudly rather than silently.
    if (!rc.observed.executeShape) {
      rc.observed.executeShape = {
        arg0Keys: input && typeof input === 'object' ? Object.keys(input) : typeof input,
        arg1Keys: execOpts && typeof execOpts === 'object' ? Object.keys(execOpts).slice(0, 12) : typeof execOpts,
      };
    }
    const payload = (input && input.context) ? input.context : input;
    const digest_text = payload && payload.digest_text;
    if (typeof digest_text !== 'string' || !digest_text) {
      throw new Error(`post_to_slack received no digest_text (shape: ${JSON.stringify(rc.observed.executeShape)})`);
    }

    // ---- CHECK-FIRST (PRD §5 idempotency, case 11, LOOP-6) --------------------
    // Query OUR event log for an already-persisted send before calling Slack again.
    // Mastra warns it cannot de-duplicate concurrent resumes, so this cannot be
    // delegated to the harness. See evidence/mastra-concurrent-resume-warning.txt.
    const prior = readRunState(rc.runId, { dbPath: rc.dbPath });
    if (prior.has_persisted_send) {
      rc.observed.checkFirstPerformed = true;
      rc.observed.skippedExistingSend = true;
      const persisted = JSON.parse(prior.slack_response_json);
      return {
        ok: !!persisted.ok, status: persisted.status ?? null,
        body: persisted.body ?? null, skipped_existing_send: true,
      };
    }
    rc.observed.checkFirstPerformed = true;

    const response = await post_to_slack(digest_text, {
      webhookUrl: rc.slackWebhookUrl,
      fetchImpl: rc.slackFetchImpl,
    });
    rc.observed.slackSendAttempts++;

    // Second save point (PRD §5): persist the Slack response immediately on receipt,
    // before any further processing.
    appendEvent(rc.runId, {
      step_name: 'post_to_slack_result',
      slack_response: response,
      failure_stage: response.ok ? null : 'post',
      error_message: response.ok ? null : `slack ${response.status ?? 'network'}: ${response.error ?? response.body ?? ''}`,
    }, { dbPath: rc.dbPath });

    return {
      ok: response.ok, status: response.status, body: response.body,
      skipped_existing_send: false,
    };
  },
});

export const INSTRUCTIONS = `You write a status digest of open Linear issues and post it to Slack.

You are given the open issues in the user message. Do exactly this, once:
1. Draft one digest grouped by issue status, 2-3 lines per status group.
2. Call post_to_slack exactly once with the drafted digest as digest_text.

Rules:
- Use only the issues returned by the tool. Never invent an issue, a title, or an assignee.
- If an issue's assignee is "unassigned", write "unassigned". Never guess a name.
- If a truncation notice is present, repeat it explicitly in the digest. Never present a
  truncated list as the complete set.
- Do not ask the user questions. Do not call any tool more than once.`;

export function createDigestAgent({ model } = {}) {
  return new Agent({
    id: 'linear-digest',
    name: 'linear-digest',
    instructions: INSTRUCTIONS,
    // Operator-directed switch to OpenAI (2026-08-25): the Anthropic key supplied for this
    // bake-off is rejected (HTTP 401) and the operator has only OpenAI credentials.
    // Recorded as D-15. Overridable so a future leg can compare providers.
    model: model || process.env.DIGEST_MODEL || 'openai/gpt-5.6-terra',
    tools: { post_to_slack: postToSlackTool },
    defaultOptions: {
      maxSteps: STEP_BUDGET,          // PRD §3 hard ceiling
      autoResumeSuspendedTools: false, // the pause must be real, never auto-resumed
    },
  });
}
