// Does the pattern STANDARD.md tells people to build actually survive a hard kill?
//
// The module architecture is: Master Agent = a workflow, sub-modules = NESTED workflows,
// human approval = suspend() inside one of those nested workflows. The 12-case kill-test
// proved a FLAT workflow resumes from Convex. It did not prove any of that nesting, and a
// standard that teaches an unverified pattern is the exact mistake this project keeps making.
//
//   node nest-test.js start --hold   -> suspends inside the NESTED workflow, then holds
//   node nest-test.js resume         -> fresh process, resumes from Convex only
//   node nest-test.js verify         -> reads the snapshot back over raw HTTP, no SDK
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { Mastra } from '@mastra/core';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { ConvexStore } from '@mastra/convex';
import { z } from 'zod';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const RUNFILE = path.join(ROOT, '..', 'runs', 'nest-run.json');
const PARENT_ID = 'module-harness';       // stands in for "Master GTM Agent"
const CHILD_ID = 'submodule-approval';    // stands in for a sub-module needing sign-off

function store() {
  if (!process.env.CONVEX_URL) throw new Error('CONVEX_URL required -- this test is about durability');
  return new ConvexStore({
    id: 'mastra-convex',
    deploymentUrl: process.env.CONVEX_URL,
    adminAuthToken: process.env.CONVEX_ADMIN_KEY,
  });
}

const classify = createStep({
  id: 'classify',
  inputSchema: z.object({ items: z.array(z.string()) }),
  outputSchema: z.object({ items: z.array(z.string()), needsApproval: z.boolean() }),
  execute: async ({ inputData }) => ({
    items: inputData.items,
    // data-dependent on purpose, so .branch() has something real to decide on
    needsApproval: inputData.items.some((i) => i.startsWith('!')),
  }),
});

// The suspending step. It lives inside the CHILD workflow -- that is the whole point:
// the approval gate sits in a sub-module, not in the top-level orchestration.
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

const autoApprove = createStep({
  id: 'auto-approve',
  inputSchema: z.object({ items: z.array(z.string()), needsApproval: z.boolean() }),
  outputSchema: z.object({ verdict: z.string() }),
  execute: async () => ({ verdict: 'auto-approved, no gate needed' }),
});

// A sub-module: independently runnable, and it owns its own approval gate.
const submodule = createWorkflow({
  id: CHILD_ID,
  inputSchema: z.object({ items: z.array(z.string()), needsApproval: z.boolean() }),
  outputSchema: z.object({ verdict: z.string() }),
})
  .map(({ inputData }) => ({ items: inputData.items }))
  .then(gate)
  .then(record)
  .commit();

const parent = createWorkflow({
  id: PARENT_ID,
  inputSchema: z.object({ items: z.array(z.string()) }),
  outputSchema: z.object({ verdict: z.string() }),
})
  .then(classify)
  // route into the nested workflow only when the data says approval is needed
  .branch([
    [async ({ inputData }) => inputData.needsApproval === true, submodule],
    [async ({ inputData }) => inputData.needsApproval !== true, autoApprove],
  ])
  .commit();

function mastra() {
  return new Mastra({ workflows: { [PARENT_ID]: parent }, storage: store() });
}

async function start() {
  const m = mastra();
  const wf = m.getWorkflow(PARENT_ID);
  const run = await wf.createRun();
  const items = ['!needs-signoff', 'routine-a', 'routine-b'];
  console.log(`[nest] parent=${PARENT_ID} child=${CHILD_ID} runId=${run.runId}`);
  const res = await run.start({ inputData: { items } });
  console.log('[nest] raw result keys:', Object.keys(res||{}).join(', '));
  console.log(`[nest] status=${res.status}`);
  console.log(res.status === 'suspended'
    ? `[nest] suspended at: ${JSON.stringify(res.suspended)}`
    : `[nest] result: ${JSON.stringify(res.result || res)}`);
  fs.mkdirSync(path.dirname(RUNFILE), { recursive: true });
  fs.writeFileSync(RUNFILE, JSON.stringify({
    runId: run.runId, status: res.status, suspended: res.suspended ?? null, items,
    startedAt: new Date().toISOString(),
  }, null, 2));
  console.log(`[nest] runId written -> ${RUNFILE}`);
  if (res.status === 'suspended' && process.argv.includes('--hold')) {
    console.log('[nest] holding for kill -9 ...');
    await new Promise(() => {});
  }
}

async function resume() {
  const saved = JSON.parse(fs.readFileSync(RUNFILE, 'utf8'));
  console.log(`[nest] FRESH PROCESS pid=${process.pid} resuming runId=${saved.runId}`);
  const m = mastra();
  const wf = m.getWorkflow(PARENT_ID);
  // no state carried in code -- runId is the only input, everything else comes from Convex
  const run = await wf.createRun({ runId: saved.runId });
  const res = await run.resume({
    step: saved.suspended?.[0] ?? [CHILD_ID, 'await-approval'],
    resumeData: { approved: true, by: 'haniyah' },
  });
  console.log(`[nest] status=${res.status}`);
  console.log(`[nest] result=${JSON.stringify(res.result ?? res.steps ?? res)}`);
  const ok = res.status === 'success';
  console.log(ok ? '[nest] PASS -- nested suspend resumed after process death'
                 : `[nest] FAIL -- status ${res.status}`);
  process.exit(ok ? 0 : 1);
}

// Raw HTTP, no SDK: a process that never wrote the state proves it is durable, not cached.
async function verify() {
  const saved = JSON.parse(fs.readFileSync(RUNFILE, 'utf8'));
  const base = process.env.CONVEX_URL.replace(/\/+$/, '');
  const res = await fetch(`${base}/api/mutation`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Convex ${process.env.CONVEX_ADMIN_KEY}` },
    body: JSON.stringify({
      path: 'mastra/storage:handle',
      // SINGULAR. TABLE_WORKFLOW_SNAPSHOT = "mastra_workflow_snapshot". The package's bundled
      // reference doc says plural -- an upstream doc bug. Reading the plural name returns 0 rows
      // and looks exactly like "durability is broken", which is how it wasted an afternoon.
      args: { op: 'queryTable', tableName: 'mastra_workflow_snapshot', limit: 200 },
      format: 'json',
    }),
  });
  const body = await res.json();
  if (body.status === 'error') throw new Error(body.errorMessage || 'convex error');
  const v = body.status === 'success' ? body.value : body;
  const rows = v && (v.result ?? v.results);
  if (!Array.isArray(rows)) throw new Error(`unrecognised shape: ${JSON.stringify(v).slice(0, 200)}`);
  const mine = rows.filter((r) => r.run_id === saved.runId || r.runId === saved.runId);
  console.log(`[nest] snapshot rows for this run: ${mine.length}`);
  for (const r of mine) {
    const snap = typeof r.snapshot === 'string' ? JSON.parse(r.snapshot) : r.snapshot;
    console.log(`  workflow=${r.workflow_name ?? r.workflowName} status=${snap?.status ?? '?'}`);
    console.log(`  steps in snapshot: ${Object.keys(snap?.context ?? {}).join(', ') || '(none)'}`);
  }
  if (!mine.length) { console.log('[nest] FAIL -- no snapshot in Convex'); process.exit(1); }
  console.log('[nest] PASS -- snapshot readable over raw HTTP with zero SDK');
}

const fn = { start, resume, verify }[process.argv[2]];
if (!fn) { console.error('usage: node nest-test.js start|resume|verify [--hold]'); process.exit(2); }
fn().catch((e) => { console.error('[nest] ERROR', e?.stack || e); process.exit(1); });
