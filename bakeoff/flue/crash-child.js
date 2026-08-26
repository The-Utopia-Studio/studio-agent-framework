// Leg 4 · phase 1 of a Flue crash case. Runs the real sequence to the fixture's crash
// point, then SIGKILLs ITSELF — a real uncatchable kill (LOOP-2: "prove crash-resume by
// killing the process mid-run; that is a test, not a nice-to-have").
import { start, sqlite } from '@flue/runtime/node';
import { init } from '@flue/runtime';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LinearDigest, setRunContext } from './agent.js';
import { installApprovalGate } from './approval-gate.js';
import { mockProvider, MOCK_MODEL } from './provider.js';

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
const flueDb = `${dbPath}.flue.db`;
const say = (m) => process.stdout.write(`[phase1 pid=${process.pid}] ${m}\n`);

const mock = await ensureMockModel();
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

function die(why) {
  const st = readRunState(runId, { dbPath });
  fs.writeFileSync(handoff, JSON.stringify({
    case: caseName, runId,
    instanceId: `digest-${runId}`,
    submissionId: (gate && gate.state.submissionId) || globalThis.__submissionId || null,
    toolCallId: st.harness_run_id,
    argsJson: st.selected_args_json,
    presentedArgs: st.selected_args_json ? JSON.parse(st.selected_args_json) : null,
    modelCallsBeforeCrash: mockCallsSinceReset(),
    crashAfter: fixture.crash.after,
    childPid: process.pid,
  }, null, 2));
  say(`handoff written (modelCalls=${mockCallsSinceReset()})`);
  say(`SIGKILL self now: ${why}`);
  process.kill(process.pid, 'SIGKILL');
}

const gate = installApprovalGate({
  gatedTool: 'post_to_slack',
  onSelected: async (args, toolCallId, ictx) => {
    if (readRunState(runId, { dbPath }).selected_args_json) return;
    appendEvent(runId, {
      step_name: 'llm_tool_selection', tool_selected: 'post_to_slack',
      tool_args: args, harness_run_id: toolCallId,
    }, { dbPath });
    say(`interceptor ctx: submissionId=${ictx && ictx.submissionId} conversationId=${ictx && ictx.conversationId}`);
    say('llm_tool_selection persisted (tool + full args) — SAVE POINT before the pause');
  },
  decide: async () => {
    if (fixture.crash.after === 'selection') {
      // Case 4: die while the gate is paused, BEFORE any approval decision exists.
      die('crash point = after selection persisted, before approval');
    }
    return 'approved';
  },
  onDecision: async (decision) => {
    const st = readRunState(runId, { dbPath });
    if (!st.decision) {
      appendEvent(runId, { step_name: 'approval_decision', decision, approver: 'Haniyah Umair' }, { dbPath });
      say(`approval_decision=${decision} persisted`);
    }
    if (fixture.crash.after === 'approval_before_send_persist') {
      // Case 11: die after approval is durable, BEFORE post_to_slack is invoked.
      die('crash point = after approval granted, before the send');
    }
  },
});

await start({
  agents: [{ agent: LinearDigest, name: 'LinearDigest' }],
  db: sqlite(flueDb),
  providers: [mockProvider(mock.url)],
  env: { ...process.env, OPENAI_API_KEY: 'sk-mock' },
});

const handle = init(LinearDigest, { id: `digest-${runId}` });
const receipt = await handle.dispatch(prompt);
globalThis.__submissionId = receipt.submissionId;
say(`dispatched submissionId=${receipt.submissionId}`);
await handle.read(receipt);
say('FATAL: read() settled without the crash firing');
process.exit(3);
