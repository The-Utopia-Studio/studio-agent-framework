/**
 * PROBE STEP 2 — THE ACTUAL TEST.
 *
 * Run this in a FRESH process, after kill -9 and after deleting every
 * Mastra-local file. It is given nothing but a runId string.
 *
 * PASS: the run rehydrates from Convex and commit-write executes.
 * FAIL: anything needs a local file that scripts/kill-test.sh deleted.
 *       Then STATE-1 stands as written and @convex-dev/agent is the answer.
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { mastra } from './mastra.js';

const runId = process.env.PROBE_RUN_ID ?? readFileSync('.probe-run-id', 'utf8').trim();

console.log(`\n=== STATE-1 PROBE — resume in a fresh process ===`);
console.log(`pid:   ${process.pid}`);
console.log(`runId: ${runId}`);

const workflow = mastra.getWorkflow('approvalWorkflow');

// Read the persisted state back BEFORE resuming. If this is null, the state
// is not in Convex and the test has already failed.
const persisted = await workflow.getWorkflowRunById(runId);
if (!persisted) {
  console.error(`
FAIL: no run ${runId} found in Convex.
Nothing was persisted where STATE-1 requires it.
`);
  process.exit(1);
}
console.log(`recovered from Convex: status="${persisted.status}"`);

const run = await workflow.createRun({ runId });
const result = await run.resume({
  step: 'human-gate',
  resumeData: { approved: true, approvedBy: 'kp' },
});

console.log(`\nstatus: ${result.status}`);
if (result.status === 'success') {
  console.log(`
PASS — STATE-1 satisfied.

A fresh process, given only a runId, resumed from Convex alone and ran the
step that had been gated. No Mastra-local file was involved; kill-test.sh
deleted them all before this process started.

Record it: add a dated probe result under STATE-1 in atelier-learnings,
SUPERSEDING the 24-25 Aug entry rather than rewriting it (MEM-3), and name
the store this time.
`);
} else {
  console.error(`
FAIL / INCONCLUSIVE — status "${result.status}".
Do not record a pass. Capture the error and try @convex-dev/agent instead.
`);
  process.exit(1);
}
