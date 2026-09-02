# The standard harness

How to build an agent on this framework. The rest of this folder is evidence; this file is the
recipe.

Everything here is either **proven** by the tests in [`HARNESS.md`](HARNESS.md) /
[`MEMORY.md`](MEMORY.md) / [`INNGEST.md`](INNGEST.md), or marked as **design** where it isn't.
That distinction is the point — see [How to read it](README.md#how-to-read-it).

---

## 1. The shape

```
   TRIGGER                        whatever the OS dispatches
      │                           • a fellow request via Agent Inventory  ← the primary path
      │                           • a signal or webhook                   ← event-driven
      │                           • a schedule                           ← recurring
      ▼
   1. PREFLIGHT                   can I reach my dependencies?
      │                           no → record a clean `offline`, exit 0, don't start work
      ▼
   2. WORKFLOW                    Mastra workflow — the orchestration. Deterministic.
      │                           steps are named and typed; sub-modules are nested workflows
      │                           ├─ suspend() ──► human approval ──► resume()
      ▼
   3. AGENT, inside a step        Agent.generate() — model judgement, scoped to one decision
      │                           skills are its tools
      ▼
   4. DURABLE STATE               ConvexStore + ConvexVector
      │                           workflow snapshots · memory · vectors · runs
      ▼
   5. MEMORY WRITE                deterministic, after the step. NOT the model's choice.
      ▼
   6. FRESHNESS CHECK             did the write actually land? check the timestamp, never the size
      ▼
   7. GRADE                       BEHAVIOR.md against the trace, afterwards, out of band
```

**On the trigger:** we tested with `launchd` because a recurring schedule is the *harshest*
durability test available — it runs unattended for days across laptop sleep, lid closes and
network loss, with nobody watching. That was the test rig, **not the recommendation.** In
production the OS dispatches: a fellow brings a request to Agent Inventory, or a signal fires.
The seven steps below are identical either way; only what calls step 1 changes.

**Steps 1, 5 and 6 exist only because they broke.** They are not obvious, and none of them are in
Mastra's docs. Each one cost a day.

---

## 2. Use Mastra workflows for orchestration — not a prompt-driven loop

This is the most load-bearing recommendation in the file, and it's the one with the most evidence
behind it.

### Why

**Durability is proven at exactly this layer.** The STATE-1 kill-test — `PASS 12 · FAIL 0 ·
BLOCKED 0`, live model, real Convex — is *workflow snapshots resuming from Convex after a
`kill -9`*. That is the verified thing in this whole folder. A loop where the model decides what
to do next has no snapshot to resume from; when the process dies, the run is gone.

**Named steps give you a gradeable trace.** [`BEHAVIOR.md`](BEHAVIOR.md) grades conduct — what
happened, in what order, with what tools. Steps have ids, so the trace is structured data. A
prompt-driven loop leaves a transcript you have to infer intent from, and inference is exactly
what you can't rely on when you're checking whether the agent misbehaved.

**Human approval is `suspend()` / `resume()`, and you get it for free.** The Fellow → request →
work → *"delivers output back"* round trip is literally a suspended workflow. The snapshot
persists in Convex; the run resumes when the approval arrives, in a different process, possibly
days later. Proven, including across a hard kill.

**Failure localises.** A typed step that fails names itself and its inputs. A failing agent loop
just stops producing output, which is the hardest class of bug to find — and precisely the class
this project kept hitting.

### The division of labour

> **Deterministic orchestration. Model judgement inside steps.**
>
> If the control flow is knowable, don't let the model decide it.

The Master Agent for a harness is a **workflow**, not an agent. The agents live *inside* its
steps, each scoped to one decision, with skills as their tools.

### The primitives worth knowing

| | |
|---|---|
| `createStep({ id, inputSchema, outputSchema, execute })` | a typed unit of work |
| `createWorkflow(...).then(step).commit()` | sequential composition |
| `.parallel([...])` | concurrent steps |
| `.branch([[condition, step], ...])` | conditional routing |
| `.dowhile()` · `.dountil()` · `.foreach()` | loops with a bound |
| `.map()` | reshape data between steps, instead of steps knowing each other's shapes |
| **a workflow as a step** | nesting — this is how sub-modules compose |
| `suspend()` / `resume()` | human-in-the-loop, snapshot-backed |
| `watch()` | observe progress without changing behaviour |

### How that maps onto a module harness

```
Master GTM Agent                    ── a Mastra workflow (the orchestrator)
│
├─ Marketing & Comms                ── a NESTED workflow (the sub-module)
│  ├─ step: brand-voice-check       ── calls an Agent; skills are its tools
│  └─ step: draft-review            ── suspend() here if a human signs off
│
├─ BD & Partnerships                ── a nested workflow
├─ Sales Enablement                 ── a nested workflow
└─ ...
```

Nesting is what makes a sub-module independently testable and reusable across harnesses. A
sub-module you can run on its own is a sub-module you can grade on its own.

### Verified vs not

**Verified here:** workflow snapshots persist in `ConvexStore` and resume after `kill -9` (12/12
golden cases) · `suspend()` / `resume()` on a tool-approval gate.

**And the nesting this section recommends is now tested too** (2 Sep) — the exact shape above: a
parent workflow, `.branch()` routing on real data into a **nested** workflow, `suspend()` inside
that nested workflow, the process `kill -9`'d while suspended, and a fresh process resuming from
Convex with the runId as its only input.

```
[nest] suspended at: [["submodule-approval","await-approval"]]
   kill -9 → process is gone
[nest] FRESH PROCESS resuming runId=24a2b4b0-…
[nest] status=success
[nest] result={"submodule-approval":{"verdict":"approved by haniyah"}}
```

Two structural details worth knowing before you build on it:

- **A nested workflow gets its own snapshot row.** One run produced two rows sharing a runId —
  `module-harness` (the parent) and `submodule-approval` (the child). Sub-modules are durable
  independently, which is what makes them independently resumable.
- **Suspension is addressed by path, two levels deep.** The parent records
  `suspendedPaths: {"submodule-approval": [1,0]}`; the child records `{"await-approval": [1]}`.
  `resume()` takes `step: ["submodule-approval", "await-approval"]` — the nested workflow id, then
  the step id. Build your approval routing around that shape.

**The real table name, since we got this wrong once:** `TABLE_WORKFLOW_SNAPSHOT =
"mastra_workflow_snapshot"` — **singular**. The package's bundled reference doc says plural; that
is an upstream documentation bug, and following it makes you declare an empty table while the one
holding your data stays undeclared. Reads and writes are both singular and self-consistent, so
nothing breaks — but declare the singular name so the real table gets a validator and indexes.

**Still unverified by us:** `.foreach()` · `.parallel()` · `.dowhile()` / `.dountil()` ·
`.agent()` as a step · `watch()` streaming · nesting deeper than two levels. The primitives exist
and are documented upstream; we have not run them, and this folder does not claim otherwise.

---

## 3. Memory — three rules, all learned the hard way

1. **Never write Mastra's memory tables directly.** Reading them raw is essential — it's the only
   honest verification. *Writing* them silently removes the agent's ability to maintain its own
   memory: the update tool stops being offered on the request at all.

2. **Don't leave the memory write to the model.** It will stop doing it. Reproduced A/B: with
   semantic recall available, the model declines to call `updateWorkingMemory` because recall
   already answers *"what have I covered?"*. **Memory maintenance decays as the corpus grows** —
   backwards for a long-horizon agent. Write it deterministically after the step.

3. **Check the write timestamp, never the size.** A frozen memory and a healthy memory are the
   same number. Nine cycles reported `ok`, recall passed on all nine, memory read a plausible
   1,742 chars — and it hadn't been written once.

> **Grade freshness, never size.** A metric you can satisfy by doing nothing is not a metric.

Full account in [`MEMORY.md`](MEMORY.md#the-failure-that-outranks-all-of-the-above).

---

## 4. BEHAVIOR.md — where it goes, and what it's for

- It lives **next to the agent**, versioned with its code. **The agent never reads it.** It grades
  the trace afterwards, out of band. Injecting it turns a grading standard into a prompt.
- It grades **conduct** on a track *parallel* to output grading, not instead of it. Both green
  means ship.
- Start with the **mechanical** predicates, not the clever ones. *"Was the memory tool offered,
  and was it called?"* is two lines, needs no judgement, and would have caught nine hours of
  failure that four other signals missed.
- Predicates: `ordering` · `pairing` · `required` · `forbidden` · `count`, each returning
  true / false / **`na`**. The `na` state is load-bearing — without it every clause must be
  answerable on every run, which forces either false failures or clauses too weak to grade
  anything.

**One clause we got wrong first**, kept as a warning: *"memory must change each cycle"* would have
failed a **correctly behaving** agent for seven consecutive cycles, because the input was
genuinely already covered. Unchanged state on already-covered input is *correct*. A judged clause
compares **input against state** — it doesn't just watch the state.

**Blocked on one thing:** we don't emit tool-*offering* in traces, only tool-calling. That's
TUS-2758's scope, and the memory failure is the argument for adding it.

---

## 5. Inngest — not yet, and be precise about why

**Inngest itself works.** It held a suspended run across a `kill -9`, kept state in Convex, and
re-invoked the worker on its own with nobody driving it. Connect mode needs no tunnel or public
URL, and reconnected unprompted after an 11-hour laptop sleep. Steps 4, 5 and 6 of the test are
the hard parts, and all three pass.

**Mastra's durable-agent wrapper on it does not.** The resumed run never completes —
`Cannot read properties of undefined (reading 'agentSpanData')`. Five blockers, all Mastra-side:
a hardcoded workflow id that can't find its own run, and `createInngestAgent()` returning a plain
object with none of the three recovery methods `createDurableAgent()` has.

**So:** Mastra workflows + `ConvexStore` is the standard today. `createInngestAgent()` stays out
until the blockers clear — the machinery underneath is sound, and step 6 passing is the part that
would be hard to build ourselves. Detail in [`INNGEST.md`](INNGEST.md).

**Also worth correcting, because it's in circulation:** durable agents are **not** new in
1.62/1.63. `createInngestAgent` shipped in 1.30.0 and `untilIdle` in 1.41.0 — both already present
in the 1.61.0 baseline the 26 Aug decision was made against.

---

## 6. Memory across the three module harnesses

We offer three modules — **Product**, **GTM**, **Investments** — each with its own harness, a
Master Agent orchestrating sub-modules, and agents with skills inside them. That structure raises
a memory question the single-agent tests don't answer: *what remembers what, and at which layer?*

### The boundary rule, and why it's not optional

The failure in [`MEMORY.md`](MEMORY.md) was **two memory systems answering the same question.**
The agent stopped writing its own notes because another channel could answer instead. Add a third
system that answers the same question and you get the same failure, larger and harder to see.

> **One question, one owner.** If two layers can answer the same question, the agent stops
> maintaining whichever one costs it effort.

Which gives three layers with three genuinely different jobs:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  TENANT / FELLOW LAYER          "who is this, what ran, what's approved" │
│  CONVEX — the system of record                                          │
│  identity (Clerk-bound) · tenancy · runs · events · approvals           │
└──────────────────────────────────────────────────────────────────────────┘
        ▲                        ▲                          ▲
┌───────┴─────────┐   ┌──────────┴────────┐   ┌─────────────┴───────────┐
│  GTM MODULE     │   │  PRODUCT MODULE   │   │  INVESTMENTS MODULE     │
│  MEMORY         │   │  MEMORY           │   │  MEMORY                 │
│                 │   │                   │   │                         │
│  accounts       │   │  interviews       │   │  diligence packs        │
│  calls, emails  │   │  feedback         │   │  models, filings        │
│  sequences      │   │  specs, decisions │   │  provenance trail       │
│                 │   │                   │   │                         │
│  → Supermemory  │   │  → Supermemory    │   │  → Activeloop           │
└─────────────────┘   └───────────────────┘   └─────────────────────────┘
        ▲                        ▲                          ▲
┌───────┴──────────────────────────────────────────────────────┴──────────┐
│  AGENT WORKING MEMORY           "what have I done and decided?"         │
│  Mastra + Convex · per agent, per resource · small, bounded, template   │
└─────────────────────────────────────────────────────────────────────────┘
```

Read the three questions carefully, because the whole design is in them:

| Layer | Answers | Never answers |
|---|---|---|
| Module memory | *what is true about the world?* — the account, the venture, the market | *have I already done this?* |
| Agent working memory | *what have I done and decided on this task?* | *what is true about the account?* |
| Convex | *who is this, what ran, what was approved?* | either of the above |

**Do not adopt a memory vendor to replace `ConvexVector` in the harness.** Our vectors work — 83
of them, local 384-dim embedder, index created unprompted, retrieval verified. The argument for a
module memory layer is *never* "better vectors". It is that the **module corpus outlives and spans
individual agents**, and agent working memory is deliberately small and bounded.

### Which vendor for which module

**Neither is tested here. This is architecture, not a finding.**

| | Supermemory | Activeloop (Deep Lake) |
|---|---|---|
| What it is | a managed memory **service** | a versioned data **store** you run |
| Shape | ingest, and it decides retrieval | you own the retrieval logic |
| Strong at | fast to adopt, connectors, conversational memory | multi-modal, dataset versioning, self-hostable |
| Costs you | opinionation, an external dependency on the hot path | engineering time and ops |

**GTM → Supermemory.** *"What do we know about this account?"* is a retrieval question. The
corpus is conversational and arrives through connectors — Slack, email, Notion, call notes. Speed
of adoption matters more than provenance.

**Product → Supermemory.** Interviews, feedback, specs, decisions. Same shape as GTM: retrieval
over a growing conversational corpus.

**Investments → Activeloop.** Versioning is the deciding feature, not a bonus. *"Why did we
believe that in Q2?"* is a **provenance** question, and diligence needs an auditable trail over
multi-modal documents. A managed service that silently re-ranks is the wrong tool for a memo you
may have to defend.

**Sequencing:** Supermemory first, on GTM or Product. Convex already holds identity and tenancy,
so the memory layer starts as a queryable side-car you can remove. Activeloop's versioning becomes
the stronger argument once *"why did the agent believe that last quarter?"* is a question someone
actually asks — which, for Investments, it will be.

### Wiring it without repeating the failure

1. **Give it one job, stated out loud.** *"Retrieve module knowledge"* — never *"remember
   things"*. Vague ownership is how you end up with two layers answering one question.
2. **Never on the hot path unguarded.** Same preflight rule as the model: unreachable memory
   service → degrade, don't hang. Our 44-minute stall came from exactly this shape of mistake.
3. **Tenancy at the boundary.** Every query carries a tenant scope, enforced where the identity
   lives — Convex — not inside the vendor.
4. **Grade it.** A `required: retrieveModuleMemory` predicate, **offered and called**. Managed
   services fail quietly and slowly, which is the exact failure mode nothing was watching.
5. **Verify by disabling everything else.** Turn the other channels off and confirm retrieval
   still works. Otherwise you are measuring one layer and crediting another — the mistake that
   cost this project two days.

### Before adopting either — three tests

The same shape as the harness tests, because they're the ones that caught real problems:

- **Read the state back from outside the vendor's SDK.** If verification needs their client,
  you've proven a cache, not a store.
- **Kill the process mid-write.** Does it recover, or leave debris?
- **Run with harness memory disabled, then with the module layer disabled.** If behaviour is
  identical either way, the layers overlap — and one of them will stop being maintained.

---

## 7. The short version

| Decision | Answer |
|---|---|
| Harness | **Mastra + ConvexStore.** Proven: 12/12 kill-test, 41 hours unattended, three sleep boundaries |
| Orchestration | **Mastra workflows.** Deterministic; the Master Agent per module is a workflow, not a loop |
| Agents | inside workflow steps, one decision each, skills as tools |
| Sub-modules | **nested workflows** — independently runnable, independently gradeable |
| Human approval | `suspend()` / `resume()`, snapshot-backed |
| Agent memory | `@mastra/memory` + `ConvexVector`, **written deterministically**, freshness-checked |
| Module memory | Supermemory (GTM, Product) · Activeloop (Investments) — **untested, architecture only** |
| System of record | **Convex.** Identity, tenancy, runs, approvals |
| Conduct grading | `BEHAVIOR.md`, out of band, next to the agent, never in context |
| Background durability | **not `createInngestAgent()` yet** — 5 blockers, all Mastra-side |
| Pin | `@mastra/convex` **1.5.4**. 1.5.5 fails the kill-test |

**Stack:** `@mastra/core` 1.63.2 · `@mastra/convex` 1.5.4 (pinned) · `@mastra/memory` 1.27.0 ·
`@mastra/inngest` 1.8.8 · `@mastra/langfuse` 1.5.3 · `@mastra/fastembed` 1.3.0.

**One provider note:** an Anthropic-compatible endpoint that emits a `thinking` block with no
signature needs `providerOptions.anthropic.thinking.type = 'disabled'`. Ours does. It is also 3.6×
faster than the alternative we measured (6.2s vs 22.6s).
