// The orchestration skeleton. Copy, rename the ids, replace the step bodies.
//
// This is the shape that was actually tested: parent workflow -> .branch() on real data ->
// nested workflow -> suspend() inside the nested workflow -> kill -9 -> fresh process resumes
// from Convex with the runId as its only input. Verified 2 Sep 2026 on core 1.63.2 / convex 1.5.4.
//
// The rule this encodes: DETERMINISTIC ORCHESTRATION, MODEL JUDGEMENT INSIDE STEPS.
// If the control flow is knowable, the workflow decides it -- not the model.
import { Mastra } from '@mastra/core';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { ConvexStore } from '@mastra/convex';
import { z } from 'zod';

// Option names are deploymentUrl / adminAuthToken. `url` / `adminKey` are SILENTLY IGNORED,
// so a wrong guess fails at runtime rather than at construction.
export function makeStore() {
  if (!process.env.CONVEX_URL) throw new Error('CONVEX_URL is required — Convex is the system of record');
  return new ConvexStore({
    id: 'mastra-convex',
    deploymentUrl: process.env.CONVEX_URL,
    adminAuthToken: process.env.CONVEX_ADMIN_KEY,
  });
}

// ---- a step that needs model judgement. ONE decision. skills are the agent's tools.
const decide = createStep({
  id: 'decide',
  inputSchema: z.object({ items: z.array(z.string()) }),
  outputSchema: z.object({ items: z.array(z.string()), needsApproval: z.boolean() }),
  execute: async ({ inputData, mastra }) => {
    // const agent = mastra.getAgent('my-agent');
    // const res = await agent.generate(buildPrompt(inputData));
    return {
      items: inputData.items,
      needsApproval: inputData.items.some((i) => i.startsWith('!')),
    };
  },
});

// ---- the human gate. It lives inside the SUB-MODULE that needs sign-off, not at the top.
// resumeSchema/suspendSchema are what make resume type-safe across a process boundary.
const gate = createStep({
  id: 'await-approval',
  inputSchema: z.object({ items: z.array(z.string()) }),
  outputSchema: z.object({ approved: z.boolean(), by: z.string() }),
  resumeSchema: z.object({ approved: z.boolean(), by: z.string() }),
  suspendSchema: z.object({ waitingOn: z.string() }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) return await suspend({ waitingOn: `${inputData.items.length} items need sign-off` });
    return { approved: resumeData.approved, by: resumeData.by };
  },
});

const record = createStep({
  id: 'record',
  inputSchema: z.object({ approved: z.boolean(), by: z.string() }),
  outputSchema: z.object({ verdict: z.string() }),
  execute: async ({ inputData }) => ({
    verdict: `${inputData.approved ? 'approved' : 'rejected'} by ${inputData.by}`,
  }),
});

const skipGate = createStep({
  id: 'no-approval-needed',
  inputSchema: z.object({ items: z.array(z.string()), needsApproval: z.boolean() }),
  outputSchema: z.object({ verdict: z.string() }),
  execute: async () => ({ verdict: 'auto-approved' }),
});

// ---- A SUB-MODULE: a nested workflow. Independently runnable, so independently gradeable,
// and it gets its OWN snapshot row sharing the parent's runId.
export const SUBMODULE_ID = 'submodule-approval';
const submodule = createWorkflow({
  id: SUBMODULE_ID,
  inputSchema: z.object({ items: z.array(z.string()), needsApproval: z.boolean() }),
  outputSchema: z.object({ verdict: z.string() }),
})
  // .map() reshapes between steps so neither step needs to know the other's schema
  .map(({ inputData }) => ({ items: inputData.items }))
  .then(gate)
  .then(record)
  .commit();

// ---- THE MASTER: a workflow, not an agent.
export const WORKFLOW_ID = 'module-harness';
export const workflow = createWorkflow({
  id: WORKFLOW_ID,
  inputSchema: z.object({ items: z.array(z.string()) }),
  outputSchema: z.object({ verdict: z.string() }),
})
  .then(decide)
  .branch([
    [async ({ inputData }) => inputData.needsApproval === true, submodule],
    [async ({ inputData }) => inputData.needsApproval !== true, skipGate],
  ])
  .commit();

export function makeMastra(extra = {}) {
  return new Mastra({ workflows: { [WORKFLOW_ID]: workflow }, storage: makeStore(), ...extra });
}

// ---- run and resume.
//
// Note the API names: createRun (not createRunAsync), and start() awaits while startAsync()
// returns immediately with only a runId. Getting that wrong looks like "status is undefined".
export async function startRun(input) {
  const m = makeMastra();
  const run = await m.getWorkflow(WORKFLOW_ID).createRun();
  const res = await run.start({ inputData: input });
  return { runId: run.runId, status: res.status, suspended: res.suspended ?? null, result: res.result };
}

// The runId is the ONLY thing carried in code. Everything else comes from Convex -- which is
// what makes this a durability proof rather than a same-process convenience.
export async function resumeRun(runId, suspendedPath, resumeData) {
  const m = makeMastra();
  const run = await m.getWorkflow(WORKFLOW_ID).createRun({ runId });
  const res = await run.resume({
    // two levels: [nested workflow id, step id]
    step: suspendedPath ?? [SUBMODULE_ID, 'await-approval'],
    resumeData,
  });
  return { status: res.status, result: res.result };
}
