# Proposal: `agentRuns` + `agentEvents` in studio-product-framework

**Not applied.** Everything else in this handoff is either a throwaway repo or an
uncommitted docs edit. This one touches `apps/web/convex/schema.ts` in a repo with
active development by two people, and a Convex schema change pushes to a real
deployment the moment someone runs `convex dev` in that tree. It should be a PR
somebody reads, not a working-tree edit found later.

Audit decision 13. Closes interop mismatch #2: `STATE-1`'s kill-test currently has
no target, because there is no run log in `apps/web/convex/schema.ts`.

## The change

Append to the `defineSchema({...})` object in `apps/web/convex/schema.ts`:

```ts
  /** Studio-owned agent run index. Canonical for AUDIT, not for resume. */
  agentRuns: defineTable({
    runId: v.string(),
    tenantId: v.string(),
    manifestRef: v.string(),           // AgentManifest id@packVersion
    kind: v.union(v.literal("builder"), v.literal("runtime")),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("awaiting_human"),
      v.literal("succeeded"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
  })
    .index("by_run", ["runId"])
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_status", ["tenantId", "status"]),

  /** Append-only. Never mutated (LOOP-6, MEM-3). The trace archive reads this. */
  agentEvents: defineTable({
    runId: v.string(),
    tenantId: v.string(),
    seq: v.number(),
    type: v.string(),                  // run.started | step.completed | human.requested | ...
    payload: v.any(),
    createdAt: v.number(),
  })
    .index("by_run_seq", ["runId", "seq"])
    .index("by_tenant", ["tenantId"]),
```

`AgentRunStatus` in `packages/ai-runtime/src/types.ts` is
`queued | running | awaiting_tool | succeeded | failed | cancelled`. I used
`awaiting_human` rather than `awaiting_tool` because the states are not the same
thing and conflating them is how you lose the ability to ask "how many runs are
blocked on a person?" — which is the question `REPORT-1` and every stalled
human-gate postmortem actually needs. **Pick one and make the other match**; do not
ship both spellings.

## Why two families of tables and not one

Mastra's `mastra_workflow_snapshots` (if you adopt it) is canonical for **resume**.
`agentEvents` is canonical for **audit and evals**. A snapshot says where a run
ended up; it never says why. `LOOP-2` asks for an event per iteration and
`agent-design`'s trace archive needs a readable history. Two tables, two questions —
not two sources of truth for one fact. Write that distinction down, or someone will
"clean up the duplication" in six months.

## The wire that makes STACK-4 true

`packages/observability/src/events.ts` already defines `agentRunStarted`,
`agentRunSucceeded`, `agentRunFailed`. They are emitted nowhere.
`packages/ai-runtime/src/run-agent.ts` exports `startAgentRun`. It is called nowhere.

One edit connects them: have `startAgentRun` insert `agentRuns` + a `run.started`
row in `agentEvents`, and emit `StudioEvents.agentRunStarted` to Langfuse. That
single change turns `STACK-4` from an assertion into a fact and gives the framework
its first observability of itself.

## Order

1. This schema change, as a PR.
2. Wire `startAgentRun` to write `run.started`.
3. Then, and only then, the `STATE-1` kill-test against real studio infrastructure —
   it needs a target to resume from.
