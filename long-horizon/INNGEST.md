# The Inngest durable loop — tested 1 Sep 2026

`createInngestAgent()` is widely described as the production path for long-running agents, and
Mastra's own docs call it that. This is what happened when we actually ran it.

**Stack:** `@mastra/core` 1.63.2 · `@mastra/inngest` 1.8.8 · `@mastra/convex` 1.5.4 ·
local Inngest dev server (`inngest-cli` 1.44.0) · `ConvexStore` · live Kimi K2.6.

**Verdict: 6 of 7 steps pass. Inngest genuinely does re-invoke a suspended run. The resumed run
does not complete.** So the criterion is partially met, and the half that fails is the half that
matters for production.

---

## What was tested, in order

| | Step | Result |
|---|---|---|
| 1 | Inngest dev server runs locally | **pass** |
| 2 | Worker connects via **Connect mode** — dials out, no tunnel or public URL | **pass** |
| 3 | The durable agent registers its workflows | **pass** — 2 functions: `durable-agentic-loop`, `durable-agentic-execution` |
| 4 | A run dispatches and **suspends** on the approval gate | **pass** — `finishReason: suspended`, gated on the tool |
| 5 | The suspended snapshot persists in Convex and survives `kill -9` | **pass** — verified with a control |
| 6 | **Inngest re-invokes the worker on resume** | **pass** — the worker was invoked without us driving it |
| 7 | The resumed run **completes** | **fail** |

Step 7's failure, from the worker log:

```
TypeError: Cannot read properties of undefined (reading 'agentSpanData')
stepExecutionPath: [ 'init-iteration-state' ]
stepId: 'workflow.inngest:durable-agentic-loop.finalize'
```

**Connect mode is worth knowing about on its own.** `connect({ mastra, inngest })` has the worker
dial out to Inngest's connect-gateway rather than Inngest calling into an HTTP endpoint. That
removes the usual local-testing obstacle entirely — no tunnel, no public URL, no ngrok.

---

## Five blockers, each observed

**1. The agent-boundary resume looks for the wrong workflow name.**
`agent.approveToolCallGenerate()` fails outright:

> `could not find a suspended run for runId "…". The run may have already completed, never suspended, or the runId is invalid.`

— while Convex demonstrably holds a snapshot row for that exact runId with `status: suspended`.
The cause is in core:

```js
await waitForSuspendedSnapshot(workflowsStore, "agentic-loop", runId, …)
```

The name is **hardcoded**, but `createInngestAgent` writes snapshots under
`inngest:durable-agentic-loop`. A sibling call site in the same file correctly uses
`this.workflowId`, which suggests an oversight rather than a design decision.

**Practical consequence: do not use `approveToolCallGenerate()` with an Inngest agent.** Its
resume API is `resume(runId, resumeData, options)` / `resumeGenerate(runId, resumeData, options)`
— positional arguments, not an options object.

**2. The Inngest agent has no recovery API.**

| | `createDurableAgent()` | `createInngestAgent()` |
|---|---|---|
| Returns | a real `DurableAgent` | a plain `Object` |
| `recover` · `recoverActiveRuns` · `listActiveRuns` | all three | **none** |

Those methods are documented as *"the typical boot-time hook"* for runs *"orphaned by a process
restart"* — which is exactly the long-horizon recovery case. They exist on the local durable
agent and not on the Inngest one, so with Inngest, recovery must come from Inngest's own queue
rather than an app-level call at boot.

**3. `AUTOMATIC_PARALLEL_INDEXING` — duplicate step IDs.** Inngest warns:

> `Duplicate step ID "…durable-agentic-execution.span.start" detected across parallel chains` ·
> *"Using the same ID for steps in different parallel chains can cause unexpected behaviour."*

Emitted by Mastra's own generated workflow, not by our code.

**4. A router-string model does not survive serialisation to the worker.** With memory enabled:

> `Model moonshotai/kimi-k2.6 is a metadata-only stub. The actual model instance should be…`

The durable loop serialises the agent definition for the worker, and a `provider/model` string
arrives as a stub. Passing a resolved model instance is the likely workaround; untested here.

**5. Failures hang rather than failing fast.** Several resume attempts ran past ten minutes with
no output. For a scheduled agent that matters more than the error itself — a hung run holds its
slot and produces no signal.

---

## What this means for the standard

**Not yet.** `createInngestAgent()` is not usable for a Tier B/C build at these versions. The
proven path remains `generate()` + `approveToolCallGenerate()` + `ConvexStore`, which passes
12/12 — see [`HARNESS.md`](HARNESS.md).

Worth being precise about *why*, since "Inngest doesn't work" would be wrong:

- **Inngest itself behaved correctly.** It registered the app, held the suspended run across a
  process death, and re-invoked the worker. Steps 1–6 are Inngest doing its job.
- **Mastra's durable-agent layer is where it breaks** — the hardcoded workflow name, the missing
  recovery API, the duplicate step IDs, and the `agentSpanData` crash are all in
  `@mastra/core` / `@mastra/inngest`.

**Re-test when** the workflow-name lookup uses `this.workflowId` at the agent boundary, and the
Inngest variant exposes the recovery API. Both are small, specific upstream changes.

**One thing already worth adopting from this**: the local Inngest dev server plus Connect mode is
a genuinely good local test rig for durable work — cheap to stand up, no tunnel, and the dev
server's UI shows the run graph. Useful independently of whether the agent layer is ready.

---

## Reproduce

```bash
npx inngest-cli@latest dev --port 8288        # terminal 1
node inngest/worker.js                        # terminal 2 — connects, stays up
node inngest/start-run.js                     # dispatch; expect finishReason: suspended
kill -9 $(cat data/inngest-worker.pid)        # kill mid-suspend
node inngest/worker.js                        # fresh worker
node inngest/approve.js                       # attempt resume
node inngest/status.js                        # writes the status the dashboard reads
```

Probe lives outside this repo, alongside the harness probe.
