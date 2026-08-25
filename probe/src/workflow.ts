import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

/**
 * The STATE-1 probe workflow.
 *
 * Three steps, one human gate. Deliberately NO model call: STATE-1 asks a
 * question about durable state, not about inference, and keeping the LLM out
 * means the kill-test runs with no model API key and no non-determinism.
 *
 * The gate uses suspend() at a STEP boundary, which is the granularity
 * LOOP-5 and 12-factor Factor 6 both care about: the run stops BEFORE the
 * irreversible step executes, not after.
 */

const proposeWrite = createStep({
  id: 'propose-write',
  inputSchema: z.object({ target: z.string(), value: z.string() }),
  outputSchema: z.object({ target: z.string(), value: z.string(), proposedAt: z.number() }),
  execute: async ({ inputData }) => {
    console.log(`  [propose-write] proposing ${inputData.target} = "${inputData.value}"`);
    return { ...inputData, proposedAt: Date.now() };
  },
});

const humanGate = createStep({
  id: 'human-gate',
  inputSchema: z.object({ target: z.string(), value: z.string(), proposedAt: z.number() }),
  outputSchema: z.object({
    target: z.string(),
    value: z.string(),
    approvedBy: z.string(),
  }),
  suspendSchema: z.object({ question: z.string(), target: z.string(), value: z.string() }),
  resumeSchema: z.object({ approved: z.boolean(), approvedBy: z.string() }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      console.log('  [human-gate] SUSPENDING — nothing has been written yet.');
      return await suspend({
        question: `Approve writing "${inputData.value}" to ${inputData.target}?`,
        target: inputData.target,
        value: inputData.value,
      });
    }
    if (!resumeData.approved) {
      throw new Error('Declined by human — the irreversible step never ran.');
    }
    console.log(`  [human-gate] approved by ${resumeData.approvedBy}`);
    return {
      target: inputData.target,
      value: inputData.value,
      approvedBy: resumeData.approvedBy,
    };
  },
});

const commitWrite = createStep({
  id: 'commit-write',
  inputSchema: z.object({ target: z.string(), value: z.string(), approvedBy: z.string() }),
  outputSchema: z.object({ committed: z.boolean(), target: z.string(), approvedBy: z.string() }),
  execute: async ({ inputData }) => {
    // LOOP-6: this is the idempotent, irreversible step. It must only ever
    // run after the gate, and it must survive being retried.
    console.log(`  [commit-write] COMMITTED ${inputData.target} (approved by ${inputData.approvedBy})`);
    return { committed: true, target: inputData.target, approvedBy: inputData.approvedBy };
  },
});

export const approvalWorkflow = createWorkflow({
  id: 'approvalWorkflow',
  inputSchema: z.object({ target: z.string(), value: z.string() }),
  outputSchema: z.object({
    committed: z.boolean(),
    target: z.string(),
    approvedBy: z.string(),
  }),
})
  .then(proposeWrite)
  .then(humanGate)
  .then(commitWrite)
  .commit();
