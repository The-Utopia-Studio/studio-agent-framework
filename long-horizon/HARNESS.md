# The harness — Mastra + Convex, in practice

Extends the [26 Aug decision](../docs/decisions/2026-08-26-mastra-convex-and-product-framework.md)
with what a working long-horizon build actually looks like. Re-tested **1 Sep 2026**.

## Pinned stack

| Layer | Package | Version | Role |
|---|---|---|---|
| Agent loop | `@mastra/core` | **1.63.2** | tool selection, approvals, resume |
| Durable state | `@mastra/convex` → `ConvexStore` | **1.5.4** | threads, messages, resources, snapshots |
| Vector store | `@mastra/convex` → `ConvexVector` | 1.5.4 | recall index — the same Convex, no new service |
| Memory | `@mastra/memory` | 1.27.0 | working memory + semantic recall |
| Embeddings | `@mastra/fastembed` | 1.3.0 | 384-dim, **local** — no key, no per-call cost |
| Traces | `@mastra/langfuse` | 1.5.3 | spans, cost |

**`@mastra/convex` is pinned to 1.5.4 deliberately.** 1.5.5 makes the kill-test fail. Bisected
with everything else constant: core 1.63.2 + convex 1.5.4 → 17/17; core 1.63.2 + convex 1.5.5 →
16/17 (`model_calls_after_resume` 0 → 1). There is no matching 1.6x release — `@mastra/convex`
is on its own version line. **Re-run the suite before bumping either package.**

## What the kill-test pass looks like

`PASS 12 · FAIL 0 · PRIMITIVE-GAP 0 · BLOCKED 0` of 12 golden cases, live model, `ConvexStore`.
Better than the 26 Aug baseline (11 pass, 1 blocked) because Langfuse credentials now exist.

The case that matters, field by field:

```
killed_by_sigkill          true      real SIGKILL in a separate OS process
resumed                    true
restarted                  false
args_byte_identical        true      persisted args match what was presented
tool_selection_events      1         the tool was never re-decided
model_calls_after_resume   0         counted from real outbound HTTP, not a mock log
harness_produced_send      true      a genuinely persisted send, not "did not throw"
resume_path                native: approveToolCallGenerate() on the persisted harness_run_id
vendor_store_kind          convex
terminal_outcome           posted
```

**On the "no vendor-local file" clause.** `ConvexStore` writes no local Mastra database at all,
so STATE-1a's deletion clause is satisfied by construction rather than by deleting something.
Verified with a control: deleted the local file, ran the full kill-test on `ConvexStore` — not
recreated; forced the same case onto LibSQL — created a 638,976-byte file. The check
discriminates rather than always passing.

## The five pieces worth copying

These are the structural parts of a passing build. Points 1–3 are what the kill-test actually
tests; 4–5 are what stop a week-long run lying to you.

**1. A canonical, append-only event log, enforced by the database.** Plain SQLite with `UPDATE`
and `DELETE` refused by triggers, not by convention. Readable with no framework API — that is
what makes it auditable, and what STATE-1 means by "outside the process".

**2. A save point before the expensive step.** Everything a fresh process needs is on disk
*before* the approval pause is surfaced: tool name, full arguments, and the harness's own run
id. That single ordering is what makes the kill-test passable at all.

**3. Check-first idempotency on the one externally-visible action.** Before writing outward, the
tool queries our own log for an already-recorded write and skips if it finds one. Layered *on
top of* the harness, not delegated to it — Mastra warns it cannot de-duplicate concurrent
resumes.

**4. Honest run status.** Four states — `ok` / `degraded` / `offline` / `failed` — and never
`ok` on zero work. The first version of ours computed status from whether an error was thrown,
and the error was only set by a late step, so **a total network failure recorded as success.**
That is the bug class to design against, not an edge case.

**5. A spend guard the agent enforces on itself.** Token usage read from the model's own
response, intercepted at the fetch layer so no code path can bypass it. Warn at a threshold;
on reaching the cap, write a flag and stop — ours unloads its own schedule. An unset cap is an
**error**, not "unlimited". Tested by setting the cap below current spend: it refused and
genuinely stopped.

## Running unattended: what the environment does

Findings from a real scheduled run on a laptop. These bite any scheduled agent, not just ours.

**A closed lid is not a clean pause.** Mostly it is — across four long sleeps (53 / 33 / 207 /
636 min) zero cycles fired in three of them. But macOS takes brief **DarkWake** maintenance
wakes inside a long sleep, and `launchd` *does* occasionally fire a job during one. Observed: a
**two-second** DarkWake fired the agent while the network stack was still initialising.

**"The network is up" is not inferable from one host.** In that window the news feeds answered
while the model host reset the connection. Two hosts, one reachable.

**Where the failure lands matters more than the failure.** Because the model call died *inside*
Mastra's workflow, the run recorded as `failed` rather than `offline`, and Mastra could not
delete its own snapshot rows — leaving orphaned `pending` rows. Over a week of DarkWakes that
debris accumulates and every one reads as a genuine fault.

**Fix, and the general rule:** probe the dependency *before* starting a workflow, and classify a
network-shaped error as `offline`, not `failed`. Verified against an unresolvable host — a
3.6-second skip, no workflow started, no debris, clean exit so the schedule does not thrash.

Generalised: **a precondition that leaves no trace is not auditable.** Emit a record where the
gate already makes its decision.

**What did not break, which matters as much.** No data loss across a 6.5-hour sleep — 35 items
first seen before it were still recognised after. No duplicate runs, no torn writes,
`PRAGMA integrity_check` clean. On real wake `launchd` fired the lapsed interval within **2.6
minutes**; recovery needed no help.

**One honest limit.** A cycle that fails on a cold network is **abandoned, not resumed** —
nothing retries it, and the next scheduled tick starts fresh. That is weaker than the kill-test
and should not be conflated with it:

- **Kill-test** — a suspended run *with real state on disk* is resumed from Convex. Proven.
- **Cold-network cycle** — died before it had state worth resuming. Abandoned.

For an agent whose cycles are independent this costs nothing. For one with a real task in
flight it would matter, and there is currently no retry.

**Attribute gaps, don't guess at them.** Cross-check every gap against the system's own sleep
log so it resolves to "laptop was closed for 207 min — expected" rather than a mystery. Measure
coverage against **awake** time: judging a laptop on wall-clock scores it badly for being shut,
which is not a fault.

## Verified · unverified · false

**Verified:** 12/12 on the real stack · kill-test holds at 1.63.2 · no local vendor file under
`ConvexStore` · spend guard stops the agent · sleep gaps attributable · `launchd` refires ~2.6
min after wake.

**Tested 1 Sep and NOT yet usable:** `createInngestAgent()` — 6 of 7 steps pass, but a resumed
run never completes. Inngest itself behaves correctly; Mastra's durable-agent layer is where it
breaks. Five specific blockers in [`INNGEST.md`](INNGEST.md). The proven path remains
`generate()` + `approveToolCallGenerate()` + `ConvexStore`.

**Unverified:** `createDurableAgent` / `createEventedAgent` / `untilIdle` — **never exercised
here** · HITL snapshot behaviour under load · cancel closing the
span tree (the 1.63.0 fix is in the changelog; not run) · `ConvexNativeVector` (blocked
upstream — exporting `mastraNativeVectorAction` makes `convex dev` reject the push, because its
args validator declares a `$or` field and Convex reserves `$`).

**False — corrections to claims in circulation:**

- **"Durable/background agents are new in 1.62/1.63."** No. `createInngestAgent` shipped in
  **1.30.0**, `untilIdle` in **1.41.0** — both already present in the 1.61.0 baseline the 26 Aug
  decision was made against. The 1.63.0 changelog does not mention durable agents at all.
- **"`sandbox.stop()` suspends."** Not a Mastra API. No `@mastra/sandbox` on npm, no `Sandbox`
  type anywhere in core 1.63.2. Sandboxing belongs to `@studio/ai-runtime`.
- **"Background tasks resume instead of double-running" — this one is TRUE.** 1.63.0, and the
  trigger is a *falsy* resume payload. `false` is how a boolean human-in-the-loop tool
  **declines**, so the bug lived precisely on the gate path.

## Two errors in our own 26 Aug material

**The Convex schema is wrong.** [`findings-mastra.md`](../docs/bakeoff/findings-mastra.md) §4
declares `mastra_workflow_snapshot` (singular). The Convex table is **`mastra_workflow_snapshots`**
(plural). §4 traced HTTP request bodies, correctly saw the singular name, and mistook it for the
table name — that is Mastra's *logical* name, which the storage handler resolves to the plural
Convex table. Identical in 1.5.4 and 1.5.5, so never a version change.

It looked harmless because **Convex accepts writes to a table you never declared.** It fails only
on an indexed read — which is what `Workflow.createRun()` does. Invisible until resume needs to
work.

**`model_calls_after_resume` was a flaky assertion, and ours not Mastra's.** The decline path
used `declineToolCall()`, which resolves *before* the model's concluding turn finishes, leaving
a request in flight when the case reported. In a single-process suite that request lands during a
**later** case's measurement window. Bisected; reproduced at core 1.61.0 too. Fixed by using
`declineToolCallGenerate()`, matching the approve path.

## Reproduce

```bash
cd studio-harness-probe && npm run suite:convex
```

Needs `CONVEX_URL`, `CONVEX_ADMIN_KEY`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`,
`DIGEST_MODEL` and its provider key.

**One trap worth knowing:** the suite counts model calls by matching the outbound host against
an allowlist. A model on any other host is **not counted**, and `model_calls_after_resume` reads
`0` while measuring nothing — a false pass on the most important assertion. Set
`DIGEST_MODEL_HOSTS` if the model is not on moonshot / anthropic / openai / localhost.
