# Long-horizon background agents

> **Note.** Several issues reference this path for a design doc that did not exist. The material
> now lives in [`long-horizon/`](../long-horizon/), split by subject rather than as one document,
> because it accumulates operational findings and a single file was becoming the wrong shape.
> This page is the index so existing references resolve.

Agents that run for **minutes to days** in the background — research pipelines, multi-stage
codegen, eval sweeps. Tier B/C coded agents only.

## Start here

| Question | Read |
|---|---|
| Which harness, pinned to what, and what has actually been proven on it? | [`long-horizon/HARNESS.md`](../long-horizon/HARNESS.md) |
| What does the agent remember between runs, and what does that cost? | [`long-horizon/MEMORY.md`](../long-horizon/MEMORY.md) |
| How is its conduct graded, separately from its output? | [`long-horizon/BEHAVIOR.md`](../long-horizon/BEHAVIOR.md) |
| Where did these findings come from, and when? | [`long-horizon/research/`](../long-horizon/research/) |

## The rules these sit on

- **STATE-1 / STATE-1a** — vendor runtime state is a cache, not the source of truth. Canonical
  state lives in a tenant-keyed, externally queryable store, and recovery is proven by a hard
  kill and a fresh process. See the [README](../README.md#4--state-1-kill-test--the-one-that-matters).
- **The 26 Aug decision** — Mastra + ConvexStore is the standard harness.
  [Decision record](decisions/2026-08-26-mastra-convex-and-product-framework.md).

## What is still open

- The durable-agent APIs (`createInngestAgent`, `untilIdle`) have **never been exercised** here.
- A run across a genuine multi-hour sleep/wake boundary with varied input.
- Whether the memory cost curve plateaus.
- Behaviour specs are researched but not yet wired in — plan in
  [`long-horizon/BEHAVIOR.md`](../long-horizon/BEHAVIOR.md) §4.
