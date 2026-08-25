/**
 * PROBE STEP 1 — start a run and let it suspend at the human gate.
 *
 * Prints the runId. Keep it: probe-resume.ts needs it, and the whole point
 * of the test is that a FRESH process with only that string can continue.
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { mastra } from './mastra.js';

const runId = process.env.PROBE_RUN_ID ?? `probe-${Date.now()}`;

const workflow = mastra.getWorkflow('approvalWorkflow');
const run = await workflow.createRun({ runId });

console.log(`\n=== STATE-1 PROBE — start ===`);
console.log(`runId: ${run.runId}`);

const result = await run.start({
  inputData: { target: 'studio/roadmap.md', value: 'ship the harness decision' },
});

console.log(`\nstatus: ${result.status}`);
if (result.status === 'suspended') {
  writeFileSync('.probe-run-id', run.runId, 'utf8');
  console.log(`
Suspended before commit-write. Nothing irreversible has run.
runId written to .probe-run-id

NOW DO THE DESTRUCTIVE PART:
  bash scripts/kill-test.sh
`);
} else {
  console.error(`
UNEXPECTED: expected status "suspended", got "${result.status}".
The gate did not hold. Investigate before trusting any of this.
`);
  process.exit(1);
}
