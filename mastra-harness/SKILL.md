---
name: mastra-harness
description: >-
  Implements a Tier B/C coded agent on the studio harness — Mastra + ConvexStore. Fires when a
  PRD and work orders already exist and code is about to be written: "build the first work
  order", "implement the agent", "scaffold the harness", "wire up Mastra", "does this agent need
  a workflow", "what memory should this agent have", "this agent needs to survive restarts / run
  overnight / remember across runs". Picks up exactly where `agent-prd` stops. First DECIDES,
  per agent, whether it needs a Mastra workflow and which memory channels it gets — both are
  per-agent calls with real costs, not defaults — then builds the seven-step runtime shape with
  the three pieces that are always forgotten (dependency preflight, deterministic memory write,
  state freshness check) and a `doctor` command that must exit 0 before the order is done. Do
  NOT fire to decide WHETHER to build an agent (use agent-builder), to spec role/tools/memory
  (use agent-design), to write golden cases or autonomy level (use eval-first-spec), to produce
  the PRD and work orders (use agent-prd), or for Tier A skills/projects that never run
  unattended — those need no harness.
type: implementer
supersedes: none
---

# Mastra harness

`agent-prd` ends with *"Stop. Do not begin executing the first order unless asked."* This skill
is what happens next.

Evidence for everything here is in [`long-horizon/`](../long-horizon/) — 41 hours unattended
across three sleep/wake boundaries, a 12-case kill-test, a nested-workflow kill-test, and a
memory failure that nine green signals missed. [`long-horizon/STANDARD.md`](../long-horizon/STANDARD.md)
is the why. This is the how.

---

## 1. Decide what this agent needs — before writing anything

**Neither the workflow nor the memory is a default.** Both cost something, and the wrong choice
costs more than the missing one. The builder workflow makes these two calls per agent, from what
the agent actually is: `workflow-design` and `agent-design` should already have decided upstream,
and the PRD should carry it. Where the PRD left it open, decide here with the criteria below and
**record it in [`template.md`](template.md)** so review can check the reasoning, not just the code.

### 1a. Does it need a Mastra workflow?

The question is not "is this agent important". It is: **does losing work mid-flight cost
anything?**

| What the agent is | Workflow? | Why |
|---|---|---|
| One model call, no state | **no** | nothing exists to resume |
| Independent cycles, cheap to redo | **no** | a lost cycle costs one interval |
| A human has to approve something | **yes** | `suspend()`/`resume()` *is* the gate, and it must survive days |
| Multi-step with state accumulating across steps | **yes** | mid-flight loss is expensive |
| Sub-modules that must be durable on their own | **yes** | a nested workflow gets its own snapshot |
| Conduct graded step by step | **yes** | named steps are a gradeable trace; a loop is a transcript |

**Row two is not a loophole, it's a measured result.** The reference agent behind this folder ran
46 cycles over 41 hours through three sleep/wake boundaries with **no workflow at all** — just
`Agent.generate()` on a trigger. It survived because its cycles are independent: a lost cycle
costs one interval and the next tick catches up. Adding a workflow would have bought nothing and
cost a snapshot write per step.

If you do need one:

> **Deterministic orchestration. Model judgement inside steps.**
> If the control flow is knowable, don't let the model decide it.

| Design artefact | Becomes |
|---|---|
| a module's Master Agent | a `createWorkflow(...)` |
| a sub-module | a **nested workflow** (a workflow used as a step) |
| one owned decision | a `createStep` that calls `Agent.generate()` |
| a skill | a tool on that agent |
| a human sign-off | `suspend()` inside the sub-module that needs it |

### 1b. Which memory channels?

**More channels is not better.** They compete: each one you add makes the model less likely to
maintain the ones that cost it effort. Give the agent the **fewest channels that answer its
question.**

| What it needs to remember | Give it | What it costs |
|---|---|---|
| nothing across runs | none | — |
| its own notes, bounded | working memory | ~+60% input tokens as it grows |
| search over its own past | `+ semanticRecall` | a vector store, an embedder — **and it suppresses the working-memory write** |
| knowledge shared across agents | a module memory layer | a separate owner answering a separate question |

**The trap in row three, measured.** Reproduced A/B on one agent, same instructions, same model:

| Recall available | `updateWorkingMemory` |
|---|---|
| `lastMessages: 0` + `semanticRecall: false` | offered → **called** |
| `lastMessages: 6` + `semanticRecall` on | offered → **not called**, memory frozen |

Once semantic recall can answer *"what have I already covered?"*, the model has no felt need to
persist anything — so **memory maintenance decays as the corpus grows**, which is backwards for a
long-horizon agent. If this agent needs both channels, the working-memory write **must** be
deterministic (§4). If it only needs one, prefer working memory alone; it is cheaper and it
doesn't rot.

**Module memory is a different layer.** Agent working memory answers *"what have I done?"*; a
module knowledge layer answers *"what is true about the world?"*. One question, one owner — if
two layers can answer the same question, the agent stops maintaining the one that costs it
effort. See [`long-horizon/STANDARD.md` §6](../long-horizon/STANDARD.md).

---

## 2. The stack — pinned, not "latest"

```
@mastra/core       1.63.2
@mastra/convex     1.5.4      ← PINNED. 1.5.5 fails the kill-test. bisected.
@mastra/memory     1.27.0     ← only if §1b said memory
@mastra/fastembed  1.3.0      ← only if §1b said semanticRecall. local, 384-dim, no API call
@mastra/langfuse   1.5.3
```

`@mastra/inngest` 1.8.8 installs and its dev loop works, but **do not build on
`createInngestAgent()`** — see §7.

## 3. The shape

Steps 1, 5 and 6 are the ones that cost a day each. They are not obvious and they are not in
Mastra's docs. Steps 2, 3 and 5 are conditional on §1.

```
   TRIGGER                     whatever the OS dispatches (Agent Inventory request · signal · schedule)
      ▼
   1. PREFLIGHT                can I reach my dependencies? no → clean `offline`, exit 0    ALWAYS
      ▼
   2. WORKFLOW                 deterministic; sub-modules are nested workflows           if §1a
      │                        ├─ suspend() ──► human approval ──► resume()
      ▼
   3. AGENT                    Agent.generate(). one decision. skills = tools              ALWAYS
      ▼
   4. DURABLE STATE            ConvexStore (+ ConvexVector if semanticRecall)              ALWAYS
      ▼
   5. MEMORY WRITE             deterministic, after the step. NOT the model's choice      if §1b
      ▼
   6. FRESHNESS CHECK          did the write land? check the TIMESTAMP, never the size    if §1b
      ▼
   7. GRADE                    BEHAVIOR.md against the trace, out of band                  ALWAYS
```

## 4. Preflight, or you get a 44-minute hang

An agent that starts work before checking reachability does not fail — it **hangs**. Observed:
44.6 minutes on a macOS DarkWake, a two-second maintenance wake inside a long sleep during which
the scheduler fires jobs and the network stack is not yet up. The model call died *inside* the
workflow, so the run recorded as `failed` and left orphaned `pending` snapshot rows.

Probe **before** starting work, and classify a network-shaped error as `offline`, not `failed`.
Exit 0 so the trigger doesn't thrash.

> **A precondition that leaves no trace is not auditable.** Emit the record where the gate makes
> its decision, not where the work would have happened.

[`scaffold/preflight.js`](scaffold/preflight.js) — always.

## 5. Memory — write it yourself

Only if §1b gave this agent memory. Then, three rules:

**Never write Mastra's memory tables directly.** Raw *reads* are essential — the only honest
verification. A raw *write* to `mastra_resources.workingMemory` left Mastra no longer **offering**
`updateWorkingMemory` to the model at all, while the agent's replies still claimed it was updating
memory.

**Don't leave the write to the model** — see the A/B in §1b. Ask the model for the memory
*content* as ordinary output, then write it yourself through the vendor API. The model still does
the synthesis; it just can't skip the write. [`scaffold/memory.js`](scaffold/memory.js).

> **Mastra's working memory is all-or-nothing, and this is the part that will cost you an hour.**
> You cannot keep `workingMemory: { enabled: true }` and own the write. With the feature on,
> Mastra appends *"IMPORTANT: You MUST call updateWorkingMemory in every response…"* to the system
> prompt **after** your instructions. That contradicts "emit it as output, there is no tool", and
> the model resolves the conflict by doing **neither** — it says "Updating memory." and moves on.
> Strengthening your own instruction does not help; the instruction was never the problem.
>
> The working pattern is **two Memory instances**: the agent's, with `workingMemory: false`, and a
> storage-only one — never attached to an Agent, so it contributes no system prompt — with the
> feature on purely for `get`/`updateWorkingMemory`. Two, because those methods throw unless the
> feature is enabled, but enabling it is what injects the contradiction.
>
> With the feature off, Mastra no longer injects the stored memory either, so **reading becomes
> your job too**. That is a feature: the memory sits in a prompt you wrote, rather than appended
> by the framework where you cannot see it — which is exactly how the contradiction went
> unnoticed.

**Check the timestamp, never the size.** Nine cycles reported `ok`, recall passed on all nine,
memory read a plausible 1,742 chars — and had not been written once.

> **Grade freshness, never size.** A metric you can satisfy by doing nothing is not a metric.

[`scaffold/freshness.js`](scaffold/freshness.js).

## 6. Convex is the system of record

`deploymentUrl` and `adminAuthToken` — `url` / `adminKey` are **silently ignored**, so a wrong
guess fails at runtime rather than at construction.

If §1a gave this agent a workflow, declare `mastra_workflow_snapshot` — **singular**. The
package's bundled reference doc says plural; that is an upstream documentation bug, and following
it makes you declare an empty table while the one holding your data stays undeclared, with no
validator and no indexes.

**Nesting, tested 2 Sep** — parent → `.branch()` → nested workflow → `suspend()` inside it →
`kill -9` → fresh process resumed from Convex, `status=success`. Two things to build around:

- **A nested workflow gets its own snapshot row**, sharing the parent's runId. Sub-modules are
  durable, and therefore resumable, independently.
- **Suspension is addressed by path:** `resume({ step: ["<nested-id>", "<step-id>"] })`. The
  parent records `suspendedPaths: {"<nested-id>": [1,0]}`, the child `{"<step-id>": [1]}`.

[`scaffold/harness.js`](scaffold/harness.js) is that exact shape. Rename the ids.

## 7. Durable background execution — not yet

`createInngestAgent()` is **out**. Inngest itself is fine: it holds a suspended run across a
`kill -9`, re-invokes the worker unprompted, and Connect mode needs no tunnel. The resumed run
then never completes — `Cannot read properties of undefined (reading 'agentSpanData')`. Five
blockers, all in Mastra's durable-agent layer:
[`long-horizon/INNGEST.md`](../long-horizon/INNGEST.md).

**Also, because it circulates:** durable agents are not new in 1.62/1.63. `createInngestAgent`
shipped in 1.30.0 and `untilIdle` in 1.41.0.

## 8. Grade conduct, not just output

Ship a `BEHAVIOR.md` **next to the agent**, versioned with its code. **The agent never reads it.**
It grades the trace afterwards, out of band. Injecting it turns a grading standard into a prompt.

If this agent has memory, the day-one predicate is:

> **`required: updateWorkingMemory`** — offered on the request **and** called, at least once per
> N cycles. Graded from the provider request/response, never from the resulting state.

*Offered* catches the framework withholding the tool. *Called* catches the model declining.
Neither is visible in the state; both are visible in one provider request.

**Do not write a clause of the form "memory must change".** It fails a *correctly behaving* agent
whose input was already covered — it did so for seven consecutive cycles in our own run. A judged
clause compares **input against state**.

## 9. Definition of done

A work order is not done until `doctor` exits 0. Copy
[`scaffold/doctor.js`](scaffold/doctor.js), wire it to `npm run doctor`, and set its `expect`
flags from the §1 decisions — an agent with no memory must not be failed for having none.

- [ ] **[`template.md`](template.md) filled in** — the §1 decisions recorded, with reasons
- [ ] `@mastra/convex` pinned to **1.5.4**, not `^1.5.4`
- [ ] Preflight runs **before** any work; a network failure records `offline` and exits 0
- [ ] Durable state read back **over raw HTTP with zero SDK** — if verification needs the
      vendor's client, you proved a cache, not a store
- [ ] `BEHAVIOR.md` beside the agent with at least one mechanical predicate
- [ ] Langfuse traces carry the git sha

*If §1a said workflow:*
- [ ] Sub-modules are nested workflows; agents live inside steps
- [ ] `suspend()`/`resume()` proven on **this** agent — start it, `kill -9` it, resume in a fresh
      process with the runId as the only input

*If §1b said memory:*
- [ ] The write is **deterministic**, not the model's choice
- [ ] Freshness check wired into `doctor`, failing past N cycles

## 10. What to refuse

| Reject | Because |
|---|---|
| A workflow "because it's the standard", with no answer to §1a | Snapshot writes per step, bought nothing |
| No workflow where a human has to approve something | The gate must survive days and a restart |
| Every memory channel switched on "to be safe" | They compete. Semantic recall stops the working-memory write |
| `^1.5.4` on `@mastra/convex` | 1.5.5 fails the kill-test |
| A raw write to any `mastra_*` memory table | Silently disables the agent's own memory tool |
| "Memory is fine, it's 1,742 chars" | Size cannot distinguish maintained from abandoned |
| A verification read that returns `[]` on failure | Empty and broken look identical. Throw, or name which |
| `createInngestAgent()` | Resumed runs don't complete. Five blockers |
| `BEHAVIOR.md` in the system prompt | It's a grading standard, not a prompt |
| "We'll add the preflight later" | The failure mode is a 44-minute hang, not an error |
