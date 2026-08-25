# Handoff — 25 Aug 2026

You said build it. Here is what exists, what is verified, and the two things only
you can do.

---

## The two blockers

Neither is work I can finish for you.

1. **A Convex deployment.** `npx convex dev` needs an interactive browser login and
   creates a cloud deployment on your account.
2. **`CONVEX_ADMIN_KEY`.** An admin credential from your Convex dashboard. I do not
   handle credentials — you paste it into `.env`, which is gitignored.

Everything up to those two lines is built and typechecks. **The kill-test needs no
model API key** — `STATE-1` is a question about durable state, not inference, so I
kept the LLM out of it deliberately.

**Your path from here is two commands.** After `npx convex dev` and pasting the key:

```bash
cd "studio-harness-probe" && bash scripts/kill-test.sh
```

---

## 1 · `studio-harness-probe/` — the STATE-1 kill-test

New throwaway repo. Nothing else touched.

| File | What it is |
|---|---|
| `convex/schema.ts` | 16 Mastra tables + your own `agentRuns` / `agentEvents`, tenant-keyed and indexed |
| `convex/mastra/{storage,cache}.ts` | Mastra's Convex handlers |
| `src/mastra.ts` | `ConvexStore` wiring, with the admin-auth caveat in a comment where someone will read it |
| `src/workflow.ts` | 3 steps, one `suspend()` gate before the irreversible step. No model call |
| `src/probe-start.ts` | Starts a run, suspends, writes the runId |
| `src/probe-resume.ts` | **The test.** Fresh process, given only a runId |
| `scripts/kill-test.sh` | `kill -9`, deletes every local Mastra file, resumes |
| `src/optional-agent-demo.ts` | The other half of `LOOP-5` — `requireApproval` on a tool. Needs a key. Optional |
| `KILL-TEST.md` | How to run it, and what "pass" has to mean |
| `proposals/product-framework-agent-events.md` | The `agentRuns`/`agentEvents` PR. **Deliberately not applied** — see below |

### What I verified, and how

- **`pnpm typecheck` passes clean** against real installed packages —
  `@mastra/core@1.61.0`, `@mastra/convex@1.5.4`, `convex@1.45.0`. Every API I used
  is checked against the shipped `.d.ts`, not written from memory:
  `createWorkflow` · `createStep` with `suspendSchema`/`resumeSchema`/`suspend()` ·
  `.then().commit()` · `createRun({ runId })` · `run.start()` · `run.resume({ step,
  resumeData })` · `getWorkflowRunById()` · `ConvexStore` · all 16 table exports ·
  `createTool({ requireApproval: true })`.
- **The Convex code path is real.** Run against a deliberately fake deployment, the
  stack is `Workflow.createRun → Workflow.getWorkflowRunById →
  WorkflowsConvex.getWorkflowRunById → ConvexDB.load → ConvexAdminClient.callStorage
  → HTTP`, failing only at a 404 from the fake host. That is direct evidence
  `createRun` rehydrates run state **from Convex** — the exact mechanism `STATE-1`
  is asking about.
- **Missing-credential path** fails with a readable message, not a stack trace.

### What I did NOT verify

**I have not run the kill-test.** Nobody has. It needs the deployment. I predict it
passes, because the workflow snapshot demonstrably lives in your Convex tables — but
that is an inference from the schema and the call path, not a measurement. Do not
record a `STATE-1` pass until `scripts/kill-test.sh` prints one.

---

## 2 · `studio-standard-agent-framework/` — audit decisions 1, 2, 3, 4, 12

**Edited in the working tree. Nothing committed, nothing pushed.** Review with
`git diff` in that directory; `git checkout .` reverts the lot.

| Decision | Change |
|---|---|
| **1** | `README.md` Hermes headline now states the round in full — 7 of 9 golden scored, A3 and A4 known-failing, and that the 24/25 covers the golden set only. `hermes/RESULTS.md` gains the 5 adversarial rows and an honest round total. |
| **2** | `LICENSE` — Apache-2.0, **with an explicit caveat you must resolve**: the repo bundles three Icarus-credited skills, and I cannot confirm the Icarus pack's own licence permits redistribution. Better an explicit open question than a silently wrong licence. |
| **3** | `agent-prd` hard gate no longer restates "ten eval tasks". It now cites stage 3's contract at stage 3's bar, with the rung 1–3 floor named separately. Gate inversion closed. |
| **4** | `atelier-learnings` gains **`STATE-1a`** (the adapter clause — four conditions, and the test is *deletion*, not shutdown) and **`STATE-1b`** (a snapshot is not an event log). The 24–25 Aug Mastra entry is **superseded, not rewritten** (`MEM-3`), with the store named. |
| **12** | `schema/agent-manifest.schema.json` — the `AgentManifest`, JSON Schema 2020-12. |

### The manifest is tested, not just written

`node scripts/validate-manifest.mjs` (in the probe repo) runs it against two fixtures:

```
ok    granola-linear-drafter.manifest.json          (valid=true,  expected=true)
ok    INVALID-runtime-no-sandbox.manifest.json      (valid=false, expected=false)
      correctly rejected: must have required property 'sandbox',
                          must have required property 'tenancy'
```

The negative fixture is audit decision 7 enforced mechanically: flip `kind` to
`runtime` and the manifest is **rejected** unless it declares a sandbox provider,
`maxTurns`, `maxSpendCredits`, and a named, adversarially-tested tenancy boundary.
That gate is now a schema, not a paragraph someone might skip. `rung: 4` and
`tier: B|C` likewise require a pinned `harness` block carrying its `STATE-1`
evidence.

That validator is also the seed of decision 14's `harness/` — the runner is the same
shape, just with a rubric and a transcript instead of a manifest.

---

## 3 · What I deliberately did NOT build

**`studio-product-framework` is untouched.** Every other change here is a throwaway
repo or an uncommitted docs edit. A Convex schema change is neither: it lands in a
repo two people are actively working in, and it pushes to a real deployment the
moment anyone runs `convex dev` in that tree. It should be a PR somebody reads.

The exact change is written out in `studio-harness-probe/proposals/`. It is a
ten-minute PR once you want it — and it is worth reading for one detail: your
existing `AgentRunStatus` has `awaiting_tool` where the run log wants
`awaiting_human`. Those are different states, and conflating them costs you the
ability to ask "how many runs are blocked on a person?" Pick one spelling before
either lands.

**Decisions 6, 9, 11, 14, 15 are not done.** 6 (kill the `eval-first-spec` fork) and
9 (nine dangling skill references) need calls only you can make: which copy survives,
and whether the missing skills get vendored or referenced. 11 and 15 are mechanical
but assume 6 and 9 are settled. 14 is the five-day one.

---

## Recommended order when you're back

1. `npx convex dev`, paste the key, `bash scripts/kill-test.sh`. **Half an hour.**
2. Read `git diff` in `studio-standard-agent-framework`. Keep, amend, or revert.
3. Resolve the LICENSE caveat — it is the only thing in this handoff I could not
   settle from the repos alone, and it blocks anyone outside the studio using this.
4. Then decision 6, which is the one still actively costing you: two documents called
   the studio standard, disagreeing about whether five golden cases or twenty is a
   pass.
