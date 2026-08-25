# Harness decision + day-1 plan

Written 2026-08-25, after reading `mastra-ai/mastra` and `humanlayer/12-factor-agents` source.
**This corrects the Phase 3 verdict in the audit.** See §0.

---

## 0. Correction to the audit

My earlier "do not adopt Mastra on current evidence" rested on two claims. Reading the repo, both were wrong:

| Earlier claim | What the repo actually shows |
|---|---|
| "`NOASSERTION` licence on GitHub vs Apache-2.0 on the site — resolve before adopting" | `LICENSE.md` is explicit: **Apache-2.0** for everything outside directories named `ee/`. The `ee/` carve-out is auth only (`packages/core/src/auth/ee/`, `packages/server/src/server/auth/ee/`). GitHub reports `NOASSERTION` because of the dual-licence preamble, not because the licence is unclear. **Resolved — Apache-2.0 for what you'd use.** |
| "Failed `STATE-1`: resume required Mastra's private LibSQL state file" | Mastra's storage layer is pluggable, and **`stores/convex` exists**. `@mastra/convex`'s `ConvexStore` implements the full storage contract — threads, messages, **workflow snapshots**, scores, resources, schedules — as tables you define in **your own** `convex/schema.ts`, with indexes (`by_workflow_run`, `by_thread_created`, `by_resource`, …). The studio's gate-6 probe used the **default LibSQL store**. It tested a configuration, not the framework. |

**What I have not done:** re-run the kill-test. I am predicting `@mastra/convex` passes `STATE-1` because the workflow snapshot lives in your Convex tables and is readable from the dashboard — but that is an inference from the schema, not a measurement. §4 is the test that settles it, and it is a half-day.

One more thing the repo shows that neither the audit nor the bake-off note mentions, and it is the single most valuable finding here:

> `packages/core/src/tools/hitl.md` — `requireApproval: true` on an individual tool, or `requireToolApproval: true` on a run, **closes the stream when the agent selects a tool and before it executes**, resuming via `.approveToolCall({ runId })` / `.declineToolCall({ runId })`. Tools can also `suspend()` mid-execution with typed `suspendSchema` / `resumeSchema`.

That is `LOOP-5` — *"check whether the pause can happen between tool selection and tool invocation; that is the granularity approval actually needs"* — implemented. 12-factor names the same thing as the common gap: *"often AI orchestrators will allow for pause and resume, but not between the moment of tool selection and tool execution"* (Factor 6). Very few harnesses do this. Mastra does.

---

## 1. Which harness

**Mastra, configured with `@mastra/convex`, used through its Workflow primitives rather than its opaque agent loop.**

Not because it won a feature bake-off. Because of four constraints you have already committed to, which between them eliminate almost everything else:

| Your constraint | What it eliminates | What survives |
|---|---|---|
| `STACK-1` — Convex is the single source of truth for run state *and* business data | Every harness whose state lives in its own store with no Convex adapter: CrewAI, Flue (own "durable stream"), LangGraph (postgres/sqlite checkpointers only, no Convex one ships) | Mastra (`@mastra/convex`), `@convex-dev/agent` |
| TypeScript-only, Convex + Clerk + Vercel | LangGraph (Python-first; the TS port trails), CrewAI, PydanticAI, OpenAI Agents SDK (Python) | Mastra, `@convex-dev/agent`, Vercel AI SDK |
| `LOOP-5` — pause between tool *selection* and tool *invocation* | Most of the field, per 12-factor Factor 6 | Mastra (`requireApproval`) |
| Two engineers | Writing and maintaining your own durable execution engine | anything you don't have to maintain |

`@convex-dev/agent` is the honest runner-up and I said so in the audit. It is smaller, Convex-native, Apache-2.0, and it would work. It loses on two things: it is built around **chat threads** — the right shape for an in-app assistant, a worse fit for the multi-stage, human-gated, non-conversational pipelines your `agent-prd` Tier B describes — and at 344★ its ecosystem is thin enough that you will be the ones finding the bugs. Keep it as the fallback if the §4 kill-test fails.

**Use Mastra's Workflows, not `agent.streamVNext`, as the spine for anything Tier B or C.** This matters and it is where most teams get Mastra wrong:

- A Mastra **agent** run is a hidden loop. That is fine for Tier A / rungs 1–3, and it is what `TOOL-3`'s first fit-gate ("does it hide the loop?") is asking about.
- A Mastra **workflow** is explicit: you write the steps, the branches, and the suspend points, and Mastra provides durability and retries underneath. Your loop stays readable, which is exactly the escape clause `LOOP-1` already grants — *"a framework may run the loop only for Tier-A work, and only if the loop stays readable."*

So: agents as *steps inside* workflows you own. That satisfies `LOOP-1` and 12-factor Factor 8 ("own your control flow") without you writing a durable execution engine.

### The two caveats, up front

1. **`ConvexStore` authenticates with `adminAuthToken` (`CONVEX_ADMIN_KEY`).** Mastra talks to Convex as an admin, bypassing Clerk. So `MEM-7`'s tenant isolation **cannot** be enforced by Convex auth on this path — it has to be enforced in application code by scoping every call on `resourceId`, and tested adversarially before anything touches real fellow data. Put this in the PRD's Gate 9 tenancy row. It is the thing most likely to bite you in six months.
2. **Release cadence is roughly one minor a week** (`@mastra/core@1.61.0`, 24 Aug). For a standard you want "set in stone," pin the exact version in the manifest and upgrade deliberately, on the eval suite — which is precisely what `LOOP-9` already tells you to do on every model upgrade. Same discipline, applied to the harness.

---

## 2. Off the shelf, or custom?

**Both, split on a line that already exists in your own rules.** The question "build or buy" is the wrong shape; the right question is *which layer*.

12-factor is unusually clear on this, and it is worth noticing how closely it already agrees with `atelier-learnings` — the two documents were written independently and land on the same rules:

| 12-factor | Your rule | Verdict |
|---|---|---|
| 2 · Own your prompts | `CTX-4` prompt content read at runtime | **Build.** Never a framework's job. |
| 3 · Own your context window | `CTX-1`, `CTX-2` attention budget, pull don't push | **Build.** |
| 5 · Unify execution state and business state | `STACK-1` one store, Convex, for run-state *and* business data | **Build the schema, adopt the writer.** |
| 6 · Launch/Pause/Resume | `LOOP-2` durable log, `STATE-1` kill-test | **Adopt.** This is the expensive part. |
| 7 · Contact humans with tool calls | `LOOP-5` humans are high-latency tools | **Adopt** — Mastra's `requireApproval`. |
| 8 · Own your control flow | `LOOP-1` own the `while` loop | **Build** — as an explicit Mastra workflow. |
| 9 · Compact errors into context | `LOOP-7` compact errors back into context | **Build.** Domain-specific. |
| 10 · Small, focused agents | `TOOL-2` default to a single loop | **Build** — this is a design rule, not software. |
| 13 (appendix) · Pre-fetch context you know you'll need | `CTX-2b` prefetch exception | Already aligned. Nice independent confirmation. |

The pattern: **everything about *what your agent knows and decides* is yours. Everything about *surviving a crash* is bought.** Nobody should be hand-writing durable execution in 2026 with two engineers, and 12-factor never asks you to — Factor 8 is about control flow, not about persistence machinery.

**What you build, concretely — and it is small:**

1. `AgentManifest` (decision 12 in the audit) — your spec format, pinning harness version, rung, tier, autonomy, budgets, tool identity.
2. Your **own** `agentRuns` / `agentEvents` tables, *alongside* Mastra's `mastra_*` tables. See §3 — this is the one place I'd add rather than adopt.
3. The gates you already have: `assertWithinBudget`, `requireSandbox` in `@studio/ai-runtime`. Wire them as the first step of every workflow.
4. The eval harness (`harness/run.ts`, decision 14). Mastra ships `packages/evals` and a `mastra_scorers` table; you can point your rubrics at it rather than building storage.

**Do not build:** a loop engine, a checkpointer, a retry system, a tool-calling protocol, a streaming layer, a vector store.

### Why not just build thin on 12-factor directly?

It is a real option and I want to be fair to it: a stateless-reducer loop over a Convex event log is maybe 300 lines, satisfies every one of your rules by construction, and has zero vendor surface. If you had four engineers and six months I would argue for it.

You have two engineers and you want to start today. The 300 lines is not the cost — the cost is the next twelve months of retries, idempotency, streaming, tool-call parsing across providers, resume-race conditions, and approval plumbing. Mastra shipped a fix for exactly one of those on 11 Aug: *"Fixed concurrent `resume()` calls on the same suspended workflow run executing downstream steps more than once. A resume now atomically claims the run."* That is a bug you would have found in production, at 2am, six months in.

---

## 3. One place to add rather than adopt

Mastra's `mastra_workflow_snapshots` is a **snapshot**, not an append-only event log. It satisfies resume. It does **not** satisfy `LOOP-2`'s *"every iteration writes an event"* or `MEM-3`'s append-only-with-provenance, and you cannot reconstruct *why* a run went the way it did from a snapshot of where it ended up.

So keep both, and be explicit about which is canonical for what:

- **`mastra_workflow_snapshots`** — Mastra's, canonical for *resume*. Vendor-shaped, but in your deployment and queryable from your dashboard, so `MEM-8` holds.
- **`agentEvents`** (yours, from audit decision 13) — canonical for *audit, evals, and the trace archive*. Append-only, tenant-keyed, never mutated. This is what your `agent-design` trace archive and your golden-case harvesting read from.

That is a two-table design, not a duplicated source of truth: one answers "where was I," the other answers "what happened." Write the distinction into `STATE-1` when you amend it — it is the adapter clause the rule needs anyway.

---

## 4. Day 1 — the spike that settles it (half a day)

Do this in a **throwaway repo against a throwaway Convex deployment**, not in `studio-product-framework`. Under a dated `W-01` waiver if the probe log can't live in the production deployment.

**Step 1 — scaffold**

```bash
npx create-mastra@latest studio-harness-probe && cd studio-harness-probe
pnpm add @mastra/convex convex && npx convex dev --once
```

**Step 2 — schema.** In `convex/schema.ts`, mount the Mastra tables (the exports are `mastraThreadsTable`, `mastraMessagesTable`, `mastraResourcesTable`, `mastraWorkflowSnapshotsTable`, `mastraScoresTable` at minimum) and add your own `agentEvents` alongside them, per §3.

**Step 3 — handlers.** `convex/mastra/storage.ts` → `export const handle = mastraStorage;` and `convex/mastra/cache.ts` → `export const handle = mastraCache;` (both from `@mastra/convex/server`).

**Step 4 — wire the store.**

```ts
import { ConvexStore } from '@mastra/convex';
const storage = new ConvexStore({
  id: 'convex',
  deploymentUrl: process.env.CONVEX_URL!,
  adminAuthToken: process.env.CONVEX_ADMIN_KEY!,
  storageFunction: 'mastra/storage:handle',
});
```

**Step 5 — one workflow, one approval gate.** A three-step workflow: read something, propose a write, then a tool carrying `requireApproval: true`. Confirm the run **suspends before the write executes**, not after.

**Step 6 — THE KILL-TEST.** This is the whole point of the spike.

```
1. Start the run. Let it reach the approval suspension.
2. kill -9 the node process. Not a graceful shutdown.
3. rm -rf any local Mastra state / .mastra dir / any libsql file.
4. Start a FRESH process. New PID, no warm memory.
5. Call .approveToolCall({ runId }) with the runId you kept.
```

**Pass:** the run resumes and completes, having read its state from Convex alone.
**Fail:** anything requires the local file you deleted. Then `@convex-dev/agent` is the answer instead, and you have learned it in half a day.

**Step 7 — record it** as a dated *Violation looked like* / *Probe result* entry in `atelier-learnings` under `STATE-1`, superseding the 24–25 Aug Mastra entry with the store named. The old entry is not wrong; it is incomplete, and `MEM-3` says supersede explicitly rather than rewrite.

**Step 8 — check the two caveats while you're in there:** confirm what `adminAuthToken` can reach (§1 caveat 1), and pin the exact `@mastra/core` version you tested.

### What "today" looks like if the spike passes

Steps 1–6 are the afternoon. Then, in order, and none of it is wasted if you later switch harnesses:

1. Amend `STATE-1` with the adapter clause — *a vendor store is canonical-compliant iff it is your Convex deployment, the tables are in your schema, and the kill-test passes with vendor-local files deleted.* (Audit decision 4, now with a probe behind it.)
2. Add `@mastra/convex` to `agent-prd` Appendix C as the harness, with the version pinned. Close the bake-off — it has been open long enough to be a decision by default.
3. Add `agentEvents` to the real schema and emit from step one. (Audit decision 13.)
4. Wire Langfuse (`STACK-4`) into the workflow's step hooks. It is already implemented in `packages/observability`; it just has no caller.

Decisions 1–3 in the audit (the Hermes headline, the `LICENSE`, the eval-bar gate inversion) are still a combined one day and still independent of any of this. Do them while the spike runs.
