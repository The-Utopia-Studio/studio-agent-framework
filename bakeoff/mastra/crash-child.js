// WO-6/WO-7 · phase 1 of a crash case. Runs the real run sequence up to the fixture's
// crash point, then SIGKILLs ITSELF -- an actual uncatchable kill, not a graceful exit,
// so the resume is proved against a genuinely dead process (LOOP-2: "prove crash-resume
// by killing the process mid-run; that is a test, not a nice-to-have").
import { Mastra } from '@mastra/core/mastra';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDigestAgent } from './agent.js';
import { makeStore } from './entry.js';
import { setRunContext } from './run-context.js';

const require = createRequire(import.meta.url);
const fetch_linear_issues = require('../tools/fetch_linear_issues.js');
const { appendEvent, readRunState } = require('../store/events.js');
const modelCalls = require('../evals/model-call-counter.js');
const { ensureMockModel, setMockMode, resetMockCounters, mockCallsSinceReset } = require('../evals/mock-model.js');
const { makeLinearFetch, makeSlackFetch } = require('../evals/mocks.js');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');

const argOf = (n) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 ? process.argv[i + 1] : null;
};
const caseName = argOf('case');
const runId = argOf('runId');
const dbPath = argOf('dbPath');
const handoff = argOf('handoff');

const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, 'evals', 'fixtures', `${caseName}.json`), 'utf8'));

const say = (m) => { process.stdout.write(`[phase1 pid=${process.pid}] ${m}\n`); };

// Respect DIGEST_REAL_MODEL: the mock server sets ANTHROPIC_BASE_URL process-wide, which
// would hijack a real moonshotai/* call in this child exactly as it does in the parent.
modelCalls.install();
modelCalls.reset();
const realModel = process.env.DIGEST_REAL_MODEL === '1';
let mock = null;
if (!realModel) {
  mock = await ensureMockModel();
  setMockMode({});
  resetMockCounters();
}

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

appendEvent(runId, { step_name: 'run_start' }, { dbPath });
say('run_start persisted');

const issues = await fetch_linear_issues(rc.projectId, {
  apiKey: rc.linearApiKey, fetchImpl: rc.linearFetchImpl,
});
appendEvent(runId, { step_name: 'fetch_linear_issues_result' }, { dbPath });
say(`fetched ${issues.length} open issues`);

const trunc = issues.truncated
  ? `Showing ${issues.length} of ${issues.totalOpenCount} open issues (truncated).` : '';
const prompt = [
  'Post the digest for this project.',
  trunc ? `<truncation>${trunc}</truncation>` : '',
  `<issues>${JSON.stringify([...issues])}</issues>`,
].filter(Boolean).join('\n');

const mastra = new Mastra({
  agents: { 'linear-digest': createDigestAgent() },
  storage: makeStore(dbPath).store,
});
const agent = mastra.getAgent('linear-digest');

const out = await agent.generate(prompt, { requireToolApproval: true });
say(`generate() finishReason=${out.finishReason} mastraRunId=${out.runId}`);
if (out.finishReason !== 'suspended') {
  say('FATAL: no approval pause was offered; nothing to resume');
  process.exit(3);
}

// CRITICAL SAVE POINT — before the pause is surfaced, and before the kill.
appendEvent(runId, {
  step_name: 'llm_tool_selection',
  tool_selected: out.suspendPayload.toolName,
  tool_args: out.suspendPayload.args,
  harness_run_id: out.runId,
}, { dbPath });
say('llm_tool_selection persisted (tool + full args + harness_run_id)');

const persisted = readRunState(runId, { dbPath });

// Case 11 crashes one step later: after the approval is granted, before the send.
if (fixture.crash.after === 'approval_before_send_persist') {
  appendEvent(runId, { step_name: 'approval_decision', decision: 'approved', approver: 'Haniyah Umair' }, { dbPath });
  say('approval_decision=approved persisted; dying BEFORE post_to_slack is invoked');
}

fs.writeFileSync(handoff, JSON.stringify({
  case: caseName, runId,
  mastraRunId: out.runId,
  toolCallId: out.suspendPayload.toolCallId,
  argsJson: persisted.selected_args_json,
  presentedArgs: out.suspendPayload.args,
  modelCallsBeforeCrash: modelCalls.since(),
    modelCallDetailBeforeCrash: modelCalls.detail(),
  crashAfter: fixture.crash.after,
  childPid: process.pid,
}, null, 2));
say(`handoff written (modelCalls=${modelCalls.since()})`);
say('SIGKILL self now');

// Real, uncatchable kill.
process.kill(process.pid, 'SIGKILL');
