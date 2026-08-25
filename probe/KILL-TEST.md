# STATE-1 kill-test — Mastra + @mastra/convex

Throwaway probe. Not production code. Delete the Convex deployment afterwards.

## What this settles

Your 24–25 Aug gate-6 probe recorded that Mastra failed `STATE-1` because resume
needed `harness_run_id` in its private LibSQL store. That probe used Mastra's
**default** store. Mastra's storage layer is pluggable and `@mastra/convex` ships a
`ConvexStore` implementing the full contract — threads, messages, **workflow
snapshots**, scores — as tables declared in *your* `convex/schema.ts`.

So the probe measured a configuration, not the framework. This re-runs it properly.

**Pass** → `STATE-1a` (the adapter clause, now in `atelier-learnings`) is satisfiable,
the bake-off closes, and Mastra is the harness.
**Fail** → `STATE-1` stands as written and `@convex-dev/agent` is the answer.

Either way it is an afternoon, and either way you stop having an open bake-off.

## Why there is no LLM in this test

`STATE-1` asks a question about durable state, not about inference. Putting a model
in the loop would add a credential you have to supply, cost, latency, and
non-determinism — and would test nothing extra. The workflow suspends at a step
boundary, exactly where a human gate suspends.

**You need a Convex deployment. You do not need a model API key.**

`src/optional-agent-demo.ts` covers the other half of `LOOP-5` — pausing between the
moment the model *selects* a tool and the moment it *executes* — via
`requireApproval: true`. That one does need a key. Run it after.

## Run it

```bash
cd studio-harness-probe
pnpm install
npx convex dev          # interactive: browser login, creates a dev deployment
```

Then, in the Convex dashboard: **Settings → Deploy keys → Generate admin key.**

```bash
cp .env.example .env    # paste CONVEX_URL and CONVEX_ADMIN_KEY
bash scripts/kill-test.sh
```

The script starts a run in a background process, waits for it to suspend at the
human gate, `kill -9`s it, **deletes every Mastra-local file**, then resumes in a
fresh process given nothing but the run id string.

## What "pass" has to mean

Not "it resumed." Specifically:

- [ ] `[2/5]` shows a `kill -9`, not a graceful shutdown
- [ ] `[3/5]` reports **0** local db-like files remaining
- [ ] `[4/5]` runs in a process with a **different pid**
- [ ] `probe-resume` printed `recovered from Convex: status="suspended"` — it read the
      state back *before* resuming, so the resume is not working from memory
- [ ] `commit-write` logged **once**, after approval, never before

If `commit-write` ever logs before approval, stop. That is a `LOOP-5` failure and it
matters more than the resume result.

## Caveats you will hit, both real

1. **`ConvexStore` authenticates with `adminAuthToken`.** Mastra talks to Convex as
   an admin, bypassing Clerk. `MEM-7` tenant isolation therefore cannot be enforced
   by Convex auth on this path — it is application code's job, scoping every call on
   `resourceId`, and it must be tested adversarially before this touches real fellow
   data. Put it in the PRD's Gate 9 tenancy row as a named risk, not an assumption.
2. **`@mastra/core` ships ~1 minor a week** (1.61.0 as of 25 Aug). Pin the exact
   version in the `AgentManifest` and upgrade deliberately, on the eval suite —
   which is what `LOOP-9` already tells you to do for models. Same discipline.

## After a pass

1. Supersede the 24–25 Aug `STATE-1` entry in `atelier-learnings` — **supersede, do
   not rewrite** (`MEM-3`) — naming the store this time. The stub is already written.
2. Close the bake-off: `agent-prd` Appendix C, harness = `@mastra/core@<pinned>` with
   `@mastra/convex`. It has been open long enough to be a decision by default.
3. Then the real work: the `agentRuns`/`agentEvents` PR
   (`proposals/product-framework-agent-events.md`) and wiring Langfuse.
