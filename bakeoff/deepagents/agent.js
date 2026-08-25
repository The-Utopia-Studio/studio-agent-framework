// Leg 3 · the Deep Agents agent and its one gated tool.
// Same shape as legs 1 and 4: the orchestrator owns the fetch (PRD §1B steps 2-3, LOOP-1)
// so a failed or empty fetch can never reach the approval gate, and post_to_slack is the
// single registered tool (TOOL-1).
import { createDeepAgent } from 'deepagents';
import { tool, modelCallLimitMiddleware } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite';
import * as z from 'zod';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const post_to_slack = require('../tools/post_to_slack.js');
const { appendEvent, readRunState } = require('../store/events.js');

export const STEP_BUDGET = Number(process.env.DIGEST_STEP_BUDGET || 10);

let RC = null;
export function setRunContext(c) { RC = c; }
export function getRunContext() { if (!RC) throw new Error('deepagents run context not set'); return RC; }
export function clearRunContext() { RC = null; }

export const postToSlackTool = tool(async ({ digest_text }) => {
  const rc = getRunContext();

  // ---- CHECK-FIRST (PRD §5, case 11, LOOP-6) ---------------------------------------
  // Our event log is the authority, not LangGraph's checkpoint store.
  const prior = readRunState(rc.runId, { dbPath: rc.dbPath });
  rc.observed.checkFirstPerformed = true;
  if (prior.has_persisted_send) {
    rc.observed.skippedExistingSend = true;
    const persisted = JSON.parse(prior.slack_response_json);
    return JSON.stringify({
      ok: !!persisted.ok, status: persisted.status ?? null,
      body: persisted.body ?? null, skipped_existing_send: true,
    });
  }

  const response = await post_to_slack(digest_text, {
    webhookUrl: rc.slackWebhookUrl, fetchImpl: rc.slackFetchImpl,
  });
  rc.observed.slackSendAttempts++;

  // Second save point (PRD §5): persist the Slack response on receipt.
  if (!readRunState(rc.runId, { dbPath: rc.dbPath }).has_persisted_send) {
    appendEvent(rc.runId, {
      step_name: 'post_to_slack_result',
      slack_response: response,
      failure_stage: response.ok ? null : 'post',
      error_message: response.ok ? null : `slack ${response.status ?? 'network'}: ${response.error ?? response.body ?? ''}`,
    }, { dbPath: rc.dbPath });
  }

  return JSON.stringify({
    ok: response.ok, status: response.status,
    body: response.body, skipped_existing_send: false,
  });
}, {
  name: 'post_to_slack',
  description: 'Post the finished digest to the #agent-test Slack channel. Requires human approval.',
  schema: z.object({ digest_text: z.string().min(1) }),
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

export function makeModel({ baseURL, live }) {
  return new ChatOpenAI({
    model: live ? (process.env.DIGEST_MODEL_ID || 'gpt-5.6-terra') : 'digest-mock',
    apiKey: live ? process.env.OPENAI_API_KEY : 'sk-mock',
    ...(baseURL ? { configuration: { baseURL } } : {}),
  });
}

/** A checkpointer is REQUIRED for human-in-the-loop. SqliteSaver so it survives a crash;
 *  MemorySaver (the docs' default) would be lost on process death. */
export async function makeAgent({ baseURL, live, checkpointPath }) {
  const checkpointer = SqliteSaver.fromConnString(checkpointPath);
  const agent = await createDeepAgent({
    model: makeModel({ baseURL, live }),
    tools: [postToSlackTool],
    systemPrompt: INSTRUCTIONS,
    // NATIVE approval: pause between tool selection and tool invocation.
    interruptOn: { post_to_slack: true },
    checkpointer,
    // This run is exactly one model turn: draft the digest and select the gated tool.
    // Capping the thread at one model call means the post-tool concluding call is not
    // made, which is what PRD case 4's "LLM not re-invoked" requires -- and it is the
    // documented mechanism (`exitBehavior: "end"` ends the agent rather than erroring).
    // Also serves as the budget guard enforced in code, not in a prompt (LOOP-8, LOOP-3).
    middleware: [modelCallLimitMiddleware({
      threadLimit: Number(process.env.DIGEST_MODEL_CALL_LIMIT || 1),
      exitBehavior: 'end',
    })],
  });
  return { agent, checkpointer };
}
