# Grading conduct — behaviour specs

How a long-horizon agent's **conduct** gets graded, separately from whether its output was
right. Based on the [Agent Behavior](https://github.com/braintrustdata/agentbehavior) open
standard (Braintrust + Basis, ~29 Jul 2026) and the M1 research in
[`research/`](research/agent-behavior-m1.md).

Status: **research complete, not yet wired in.** The plan is §4.

---

## 1. What a BEHAVIOR.md is — and what it is not

A `BEHAVIOR.md` is a **grading standard**, not a prompt. It describes recurring conduct — how an
agent gathers evidence, decides, acts, and recovers — so a human or judge has something concrete
to score a recorded trajectory against.

It is **explicitly never injected into the agent's runtime context.** The standard says so
directly, and it is the single most important thing to get right when adopting it:

| | Audience | Purpose | Changes when |
|---|---|---|---|
| `AGENTS.md` / system prompt | the agent, at runtime | tell it how to act | implementation changes |
| `BEHAVIOR.md` | reviewers, eval authors, judges | define what counts as good conduct | the standard changes |

If a behaviour spec ever needs loading at runtime, that is the signal it has stopped being a
grading standard.

**Format** (RFC 2119 MUST/SHOULD, follow it exactly so standard tooling works unmodified):

```
.agents/behaviors/
└── <behavior-name>/
    ├── BEHAVIOR.md      # required
    └── references/      # optional: rationale, example traces
```

Frontmatter: `name` (≤64 chars, lowercase/hyphen, matching the directory), `description`
(≤1024), optional `license` and `metadata`. Body is free-form Markdown; six dimensions are
strongly recommended — **Intent, Evidence, Decision, Execution, Recovery, Failure modes**.

**Judging:** each clause scores `true` / `false` / `na`. Deterministic predicates first —
`ordering`, `pairing`, `required`, `forbidden`, `count` — with narrow LLM-as-judge only for
clauses predicates cannot express. **A blocked or prevented tool call must never count as a
violation**; a write stopped by a fence is the system working.

## 2. Where it sits relative to what we already have

Two other things in this framework use the words "golden case" and could look like overlap:

| | Scores | Shape of question |
|---|---|---|
[`eval-first-spec`](../eval-first-spec/SKILL.md) | **output correctness** | did this input produce the right result |
| behaviour specs | **process / conduct** | regardless of the output, did it follow the rules getting there |

They stay **parallel, not merged.** A golden case needs a single pass/fail answer per real
input, and "did the agent behave well across the whole trajectory" is not that shape of
question. Both feed one gate: a change ships only when the output score **and** the behaviour
pass rate clear their thresholds.

The line worth keeping: **output scoring tells you what happened; behaviour scoring tells you
how.**

## 3. Why this needs the harness

A spec grades a **recorded trajectory**. Nothing is gradeable until that trajectory exists in a
shape a predicate can run over — and the trajectory is produced by the harness.

The append-only event log in [`HARNESS.md`](HARNESS.md) is already most of it:

| Needed by the standard | Have | Gap |
|---|---|---|
| tool name | `tool_selected` | — |
| tool args | `tool_args`, canonical JSON | — |
| result | result column | — |
| **duration per call** | run-level only | **missing** |
| **`blocked: true`** | — | **missing** |
| stage transitions | `step_name` sequence | run sequence, not loop stages |
| errors / retries | `failure_stage`, `error_message` | retries not individually recorded |
| escalations | `decision` + `approver` | — |

Two additive fields close it. Both are cheap now and a migration later.

## 4. The plan

**Phase 0 — no code.** Link the M1 research, confirm the six decision outputs, move M1 to
review. This unblocks spec authoring.

**Phase 1 — make the trajectory gradeable.** Three additive changes:

1. `durationMs` per event.
2. `blocked: boolean` + `blockedBy`, **written at block time**. A judge cannot recover this
   afterwards — our first version recorded a cold network as `failed` and nothing downstream
   could tell it from a real fault. Inferred at judging time from an error string, a harmless
   network blip reads as an agent violation.
3. A `precondition_checked` event — `{ gate, satisfied, reason }`.

**Phase 2 — a thin compiler**, in the existing evaluator rather than a separate package, so the
output score and behaviour score emit a comparable shape for the combined gate. Five predicates
over the event array, then a semantic path for what they cannot express.

Recommendation on `behavior-judge` (the upstream reference implementation): **adopt the
vocabulary, not the dependency.** It is a single-developer project built the week of the
standard's launch. The predicate surface is small and well specified — cheaper to implement
against our own trajectory format than to vendor an unmaintained package. Revisit if it matures.

**Phase 3 — the specs.** Five named in M2, plus the sixth below.

**Phase 4 — the combined gate**, plus Agent Inventory fields: `behaviorSpecs: string[]`,
`behaviorCompliance: {specSlug, verdict, lastRunAt, evidence?}[]`, `behaviorPassRate: number`.

## 5. The unblock worth knowing about

`sandbox-before-exec` is held in M1 because the real gate is a **structural precondition upstream
of the trajectory** — it rejects a request before the run starts, so a judge has no event to
inspect. As drafted, the spec would either fail every trajectory or be ungradeable.

We hit that identical shape with a network preflight and solved it by having the precondition
**emit a record** where it already makes its decision. Verified: an unresolvable host produces a
3.6-second skip with a row a judge can read, no workflow started, no debris.

So the spec does not need to wait: have the gate emit `precondition_checked`, and it grades with
a plain `required` predicate.

**As a framework rule: a precondition that leaves no trace is not auditable.**

## 6. The missing sixth spec — long-horizon memory hygiene

All five M2 specs grade conduct **within one run**. Nothing grades conduct **across** runs, which
is the entire subject of long-horizon agents.

The judging rule is the part that is easy to get wrong, and we got it wrong first:

> **Intent:** accumulated state must stay accurate and bounded — incorporate genuinely new
> information, and do not bloat with restatement.
>
> **Evidence:** for each cycle, compare what was *presented* against what the state already
> covered, then whether the state changed.
>
> **Decision:** state unchanged is a violation **only if** the input contained information the
> state did not already cover. Unchanged state on already-covered input is **correct**.
>
> **Failure modes:** state grows monotonically without merging or retiring · state restates the
> input rather than synthesising · state resets between processes · the agent claims recall it
> cannot demonstrate.

A naive "memory must change" clause would have failed a well-behaved agent for seven consecutive
cycles in our own run. See the trap in [`MEMORY.md`](MEMORY.md).

### And the clause that must sit beside it

The rule above is right, and on its own it is not enough. Two weeks later the inverse happened:
nine overnight cycles where memory **should** have changed, did not, and every signal stayed
green — status `ok`, recall demonstrably working, memory a plausible 1,742 chars. The size was
frozen. A frozen size and a healthy size are the same number.

So the spec needs a second, mechanical predicate that does not depend on judging the input:

> **`required: updateWorkingMemory`** — the memory-write tool must be **offered on the request
> and called** at least once per N cycles. Graded from the provider request and response, not
> from the state.

Why offered-and-called rather than looking at the state:

- **Offered** catches the framework silently withholding the tool. It happened: a raw write to
  `mastra_resources.workingMemory` left Mastra no longer putting `updateWorkingMemory` on the
  request, while the agent's own replies still said *"Updating memory."*
- **Called** catches the model declining. It happened, and it is not a bug: once semantic recall
  can answer *"what have I covered?"*, the model has no need to persist and stops. Memory
  maintenance **decays as the corpus grows**.

Neither is visible in the state. Both are visible in one provider request. This is the single
strongest argument for grading conduct rather than outcomes — no status field, log line or trace
caught nine hours of it, and a two-line predicate would have failed cycle one.

> Corollary for any long-horizon spec: **grade freshness, never size.** A metric you can satisfy
> by doing nothing is not a metric.

## 7. One clause worth stealing into every spec

`compound-loop-honesty` names the pattern precisely: a stage that runs but writes nothing
meaningful *"defeats the loop's purpose while looking like it worked."*

We hit that three times in **verification** code, not agent code — reads that returned empty on
success, indistinguishable from absent data. One sat in a standards document for two days
asserting a working feature was broken. Generalised:

> A step whose success and its no-op are indistinguishable from the outside has not been
> verified. Where an empty result and a failure look alike, the step must throw, or name which
> it was.

## 8. Open question with no owner

A single run currently produces **more than one** trajectory: the canonical append-only log, and
the harness's own state in the durable store. A judge needs **one**. Someone has to decide
whether the harness's event stream is normalised into the canonical log, or the canonical log
becomes the only format and the harness adapter writes into it.

This blocks the compiler, and nothing else can settle it.
