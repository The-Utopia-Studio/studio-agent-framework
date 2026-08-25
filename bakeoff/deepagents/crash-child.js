// Leg 3 · phase 1 of a Deep Agents crash case. Runs the real sequence to the fixture's
// crash point, then SIGKILLs ITSELF (LOOP-2).
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeAgent, setRunContext } from './agent.js';
import { readInterrupt } from './entry.js';

const require = createRequire(import.meta.url);
const fetch_linear_issues = require('../tools/fetch_linear_issues.js');
const { appendEvent, readRunState } = require('../store/events.js');
const { ensureMockModel, setMockMode, resetMockCounters, mockCallsSinceReset } = require('../evals/mock-model.js');
const { makeLinearFetch, makeSlackFetch } = require('../evals/mocks.js');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const argOf = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : null; };

const caseName = argOf('case'), runId = argOf('runId'), dbPath = argOf('dbPath'), handoff = argOf('handoff');
const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, 'evals', 'fixtures', `${caseName}.json`), 'utf8'));
const checkpointPath = `${dbPath}.langgraph.db`;
const say = (m) => process.stdout.write(`[phase1 pid=${process.pid}] ${m}\n`);

const mock = await ensureMockModel();
setMockMode({});
resetMockCounters();

const rc = {
  runId, dbPath, checkpointPath,
  projectId: 'fixture-project', linearApiKey: 'mock-key',
  slackWebhookUrl: 'https://hooks.example/mock',
  linearFetchImpl: makeLinearFetch(fixture.linear),
  slackFetchImpl: makeSlackFetch(fixture.slack),
  traceKey: null,
  observed: { slackSendAttempts: 0, checkFirstPerformed: false, skippedExistingSend: false },
};
setRunContext(rc);

appendEvent(runId, { step_name: 'run_start' }, { dbPath });
say('run_start persisted');

const issues = await fetch_linear_issues(rc.projectId, { apiKey: rc.linearApiKey, fetchImpl: rc.linearFetchImpl });
appendEvent(runId, { step_name: 'fetch_linear_issues_result' }, { dbPath });
say(`fetched ${issues.length} open issues`);

const trunc = issues.truncated ? `Showing ${issues.length} of ${issues.totalOpenCount} open issues (truncated).` : '';
const prompt = [
  'Post the digest for this project.',
  trunc ? `<truncation>${trunc}</truncation>` : '',
  `<issues>${JSON.stringify([...issues])}</issues>`,
].filter(Boolean).join('\n');

const { agent } = await makeAgent({ baseURL: mock.url, live: false, checkpointPath });
const threadId = `digest-${runId}`;
const config = { configurable: { thread_id: threadId } };

const out = await agent.invoke({ messages: [{ role: 'user', content: prompt }] }, config);
const it = readInterrupt(out);
if (!it) { say('FATAL: no __interrupt__ raised; nothing to resume'); process.exit(3); }
say(`__interrupt__ raised: tool=${it.toolName} allowedDecisions=${JSON.stringify(it.allowedDecisions)}`);

// CRITICAL SAVE POINT — before the pause is surfaced, and before the kill.
appendEvent(runId, {
  step_name: 'llm_tool_selection', tool_selected: it.toolName,
  tool_args: it.args, harness_run_id: it.interruptId,
}, { dbPath });
say('llm_tool_selection persisted (tool + full args) — SAVE POINT before the pause');

function die(why) {
  const st = readRunState(runId, { dbPath });
  fs.writeFileSync(handoff, JSON.stringify({
    case: caseName, runId, threadId, checkpointPath,
    interruptId: it.interruptId,
    argsJson: st.selected_args_json,
    presentedArgs: it.args,
    allowedDecisions: it.allowedDecisions,
    modelCallsBeforeCrash: mockCallsSinceReset(),
    crashAfter: fixture.crash.after,
    childPid: process.pid,
  }, null, 2));
  say(`handoff written (modelCalls=${mockCallsSinceReset()})`);
  say(`SIGKILL self now: ${why}`);
  process.kill(process.pid, 'SIGKILL');
}

if (fixture.crash.after === 'selection') {
  die('crash point = after selection persisted, before approval');
}

// Case 11: approval granted and durable, then die BEFORE the send.
appendEvent(runId, { step_name: 'approval_decision', decision: 'approved', approver: 'Haniyah Umair' }, { dbPath });
say('approval_decision=approved persisted');
die('crash point = after approval granted, before the send');
