'use strict';
// Does a Mastra WORKFLOW on Inngest survive a hard kill and COMPLETE?
//
// This exists because the answer differs from the one everyone quotes. Our earlier Inngest test
// used `createInngestAgent()` -- Mastra's durable-AGENT wrapper -- and got 6/7: it suspended, the
// state survived `kill -9`, Inngest re-invoked the worker unprompted, and then the resumed run
// NEVER COMPLETED. Five blockers, all in that wrapper. See long-horizon/INNGEST.md.
//
// `init(inngest)` is a different door. It returns createWorkflow / createStep bound to Inngest, so
// each workflow step becomes an Inngest step. Three of the four checkable blockers
// ('agentic-loop', AUTOMATIC_PARALLEL_INDEXING, 'metadata-only stub') do not appear in
// @mastra/inngest at all; 'agentSpanData' -- the crash that killed the agent path -- does appear,
// which is why this test was worth running rather than assuming.
//
// Result, 4 Sep 2026, @mastra/core 1.63.2 + @mastra/inngest 1.8.8 + @mastra/convex 1.5.4:
//   suspended inside the nested workflow, worker kill -9'd, restarted, resumed -> status success.
//   agentSpanData never fired. The workflow path completes where the agent path does not.
//
// Deliberately NO agent and NO model call: this asks about the execution engine, not the model,
// and it should cost nothing to re-run.
//
//   node inngest-workflow-durability.js start    -> suspends inside the nested workflow
//   kill -9 <worker pid>                          -> then restart the worker
//   node inngest-workflow-durability.js resume   -> the question: does it COMPLETE?
//   node inngest-workflow-durability.js verify   -> raw-HTTP read-back, zero SDK
//
// Needs a worker process holding the connection open; see the companion note in README.md.
const fs = require('node:fs');
const path = require('node:path');
const { Mastra } = require('@mastra/core');
const { init } = require('@mastra/inngest');
const { ConvexStore } = require('@mastra/convex');
const { Inngest } = require('inngest');
const { z } = require('zod');

const PARENT = 'durability-parent';
const CHILD = 'durability-child';
const RUNFILE = path.join(__dirname, '.inngest-durability-run.json');

function build() {
  for (const k of ['CONVEX_URL', 'CONVEX_ADMIN_KEY']) {
    if (!process.env[k]) throw Object.assign(new Error(`missing env: ${k}`), { code: 'EMISSINGENV' });
  }

  const inngest = new Inngest({
    id: 'workflow-durability',
    baseUrl: process.env.INNGEST_BASE_URL || 'http://localhost:8288',
    isDev: true,
  });

  // The whole point of the test: workflow primitives BOUND TO INNGEST, not the agent factory.
  const { createWorkflow, createStep } = init(inngest);

  const prepare = createStep({
    id: 'prepare',
    inputSchema: z.object({ label: z.string() }),
    outputSchema: z.object({ label: z.string(), items: z.array(z.string()) }),
    execute: async ({ inputData }) => ({ label: inputData.label, items: ['alpha', 'beta', 'gamma'] }),
  });

  // Suspends INSIDE the child -- the shape a module sub-module needs for a human gate.
  const gate = createStep({
    id: 'await-approval',
    inputSchema: z.object({ items: z.array(z.string()) }),
    outputSchema: z.object({ approved: z.boolean(), by: z.string() }),
    resumeSchema: z.object({ approved: z.boolean(), by: z.string() }),
    suspendSchema: z.object({ waitingOn: z.string() }),
    execute: async ({ inputData, resumeData, suspend }) => {
      if (!resumeData) return await suspend({ waitingOn: `${inputData.items.length} items` });
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

  const child = createWorkflow({
    id: CHILD,
    inputSchema: z.object({ label: z.string(), items: z.array(z.string()) }),
    outputSchema: z.object({ verdict: z.string() }),
  }).map(({ inputData }) => ({ items: inputData.items })).then(gate).then(record).commit();

  const parent = createWorkflow({
    id: PARENT,
    inputSchema: z.object({ label: z.string() }),
    outputSchema: z.object({ verdict: z.string() }),
  }).then(prepare).then(child).commit();

  const mastra = new Mastra({
    workflows: { [PARENT]: parent },
    storage: new ConvexStore({
      id: 'durability-convex',
      deploymentUrl: process.env.CONVEX_URL,
      adminAuthToken: process.env.CONVEX_ADMIN_KEY,
    }),
  });

  return { mastra, inngest };
}

async function start() {
  const { mastra } = build();
  const run = await mastra.getWorkflow(PARENT).createRun();
  console.log(`[durability] parent=${PARENT} child=${CHILD} runId=${run.runId}`);
  const res = await run.start({ inputData: { label: 'durability' } });
  fs.writeFileSync(RUNFILE, JSON.stringify({ runId: run.runId, status: res.status,
    suspended: res.suspended ?? null, startedAt: new Date().toISOString() }, null, 2));
  console.log('  status    :', res.status);
  // NOTE: on the Inngest engine this is null, where the plain engine reports [[child, step]].
  // You cannot discover the suspension path from the result -- you have to know it.
  console.log('  suspended :', JSON.stringify(res.suspended ?? null), '(null is expected on Inngest)');
  console.log(res.status === 'suspended' ? '  GOOD — there is something to resume'
                                         : '  NOT suspended — nothing to test');
}

async function resume() {
  const saved = JSON.parse(fs.readFileSync(RUNFILE, 'utf8'));
  console.log(`[durability] FRESH PROCESS pid=${process.pid} resuming ${saved.runId}`);
  const { mastra } = build();
  const run = await mastra.getWorkflow(PARENT).createRun({ runId: saved.runId });
  // The fallback path is load-bearing: res.suspended is null on this engine.
  const res = await run.resume({
    step: saved.suspended?.[0] ?? [CHILD, 'await-approval'],
    resumeData: { approved: true, by: 'operator' },
  });
  console.log('  status :', res.status);
  console.log('  result :', JSON.stringify(res.result ?? res.steps ?? res));
  const ok = res.status === 'success';
  console.log(ok ? '  PASS — a WORKFLOW on Inngest resumed and COMPLETED (the agent path never did)'
                 : `  FAIL — status ${res.status}`);
  process.exit(ok ? 0 : 1);
}

// Raw HTTP, zero SDK: a process that never wrote the state proves it is durable, not cached.
async function verify() {
  const saved = JSON.parse(fs.readFileSync(RUNFILE, 'utf8'));
  const base = process.env.CONVEX_URL.replace(/\/+$/, '');
  const r = await fetch(`${base}/api/mutation`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Convex ${process.env.CONVEX_ADMIN_KEY}` },
    // SINGULAR. TABLE_WORKFLOW_SNAPSHOT = "mastra_workflow_snapshot".
    body: JSON.stringify({ path: 'mastra/storage:handle',
      args: { op: 'queryTable', tableName: 'mastra_workflow_snapshot', limit: 200 }, format: 'json' }),
  });
  const b = await r.json();
  const v = b.status === 'success' ? b.value : b;
  const rows = v && (v.result ?? v.results);
  if (!Array.isArray(rows)) throw new Error(`unrecognised shape: ${JSON.stringify(v).slice(0, 160)}`);
  const mine = rows.filter((x) => String(x.run_id) === saved.runId);
  // ONE row on Inngest, where the plain engine writes TWO (parent + child). So a sub-module is
  // NOT independently resumable on this engine.
  console.log(`[durability] snapshot rows for this run: ${mine.length} (1 expected on Inngest, 2 on the plain engine)`);
  for (const x of mine) {
    const s = typeof x.snapshot === 'string' ? JSON.parse(x.snapshot) : x.snapshot;
    console.log(`  ${x.workflow_name} | status ${s?.status} | steps: ${Object.keys(s?.context ?? {}).join(', ')}`);
  }
  if (!mine.length) { console.log('  FAIL — no snapshot in Convex'); process.exit(1); }
}

const fn = { start, resume, verify }[process.argv[2]];
if (!fn) { console.error('usage: node inngest-workflow-durability.js start|resume|verify'); process.exit(2); }
fn().catch((e) => {
  if (e && e.code === 'EMISSINGENV') { console.error(e.message); process.exit(78); }
  console.error('[durability] ERROR', e?.stack || e);
  process.exit(1);
});
