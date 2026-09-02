---
name: learnings
description: The hard rules every agent build at Utopia Studio must obey — context discipline, loop ownership, memory tiers, evaluator separation, exit conditions, stack decisions, and long-horizon runtime — each one traceable to a specific failure that actually happened, not to best practice. Load this BEFORE designing, coding, reviewing, or modifying ANY agent, harness, loop, pipeline, memory layer, evaluator, or agent-adjacent system at the Studio — whenever the task mentions building an agent, writing a system prompt, designing a loop or critic, choosing an agent stack, adding memory, running something unattended or in the background, or reviewing agent architecture. Also load it when grading or auditing an existing agent against Studio standards. Rules carry IDs (CTX-1, LOOP-3, MEM-8, STATE-1a, HORIZON-4 …) so reviews, evals and the agents registry can cite them; cite the ID when you block or waive something.
---

# Learnings — Rules for Building Agents

## What this is

Rules a building agent loads and cannot silently skip. **Every rule here is traceable to a
specific failure that actually happened** — none of it is theoretical best practice. That
traceability is the whole authority of this document; a rule with no failure behind it does not
belong in it.

Two sources so far, and the file is named for the practice rather than either one because there
will be more:

| Where it came from | What it produced |
|---|---|
| **Atelier**, the Studio's autonomous website generator — six months of building it | `CTX-*` · `LOOP-*` · `MEM-*` · `EVAL-*` · `TOOL-*` and the three root causes below |
| **The Mastra harness run**, Aug–Sep 2026 — a re-test of the harness decision plus 41 hours unattended across three sleep/wake boundaries | `STATE-1` / `STATE-1a` · `HORIZON-*` |

Evidence for the second sits in [`long-horizon/`](../long-horizon/), which separates *verified
here* from *unverified* from *false*. Where a rule below says something is proven, that folder is
where the run is.

**How to use this skill:** before proposing or writing any agent design or code, check it against the rules below. When your work violates a rule, either fix it or state explicitly which rule you are breaking and why the exception is justified — never violate silently. When reviewing someone else's agent, cite rule IDs in your findings. Finish every build or review with the pre-flight checklist at the end.

The rules carry IDs (CTX-1, LOOP-3, HORIZON-4, …) so evals, reviews, and the agents registry can
reference them.

## The three root causes

Everything that went wrong in **Atelier** was a symptom of one of these. They remain the sharpest
diagnostic in the file for a request-shaped agent:

1. **Context was pushed in, not pulled.** A 50KB system prompt held across all eight loop iterations until the 64MB action ceiling was hit; knowledge injected wholesale into every stage, growing monotonically.
2. **The loop ran inside a request-scoped function with no durable log.** No crash-resume; a run that died mid-generation restarted from scratch; state transitions buried in imperative code.
3. **Nothing external judged the output, so nothing improved.** The critic shared the generator's framing and read code instead of the rendered page; loop exit was a round cap; zero evals.

If a design decision feels ambiguous, ask which of these three it drifts toward.

**A fourth appeared later, and only shows up in agents that run unattended:** *nothing was
watching the part that quietly stopped.* Nine consecutive cycles of a background agent reported
`ok`, its recall check passed on all nine, its memory read a plausible size — and it had not
written that memory once. Every available signal was green. See `HORIZON-3` and `HORIZON-7`; the
generalisation is that **a metric you can satisfy by doing nothing is not a metric.**

---

## Context rules

**CTX-1 · Context is an attention budget, not storage.** Aim for the smallest set of high-signal tokens that gets the outcome. Recall degrades as the window fills.
*Violation looked like:* the 50KB standing prompt and the OOM it caused.

**CTX-2 · Preload only the invariant core; pull everything else just-in-time.** Skills, brand books, reference docs, and prior artifacts are tools to call, never prompt payload. (Claude Code is the reference: CLAUDE.md preloaded, everything else glob/grep/read on demand.)
*Violation looked like:* productKnowledge injected wholesale into every stage on every run.

**CTX-3 · Every handoff is a typed contract with no silent defaults.** Validate on write and on read, and assert the payload actually landed in the assembled prompt string. One assertion kills an entire bug class.
*Violation looked like:* visual-direction palette, motif, feel and layout silently dropped in compileFinalWebsiteBrief — and nothing caught it.

**CTX-4 · Prompt content is read at runtime, never compiled at build.** If it must be bundled, assert a content hash so staleness fails loudly.
*Violation looked like:* prompts compiled into index.ts, so a forgotten bundle step shipped silently stale content.

**CTX-5 · Pitch the system prompt at the right altitude.** Too low is brittle hardcoded logic (a file per archetype, forever); too high is vague guidance that assumes context the model lacks.

**CTX-6 · Gate every fallback with "only if absent."** A concrete example or default table placed after a "use the source of truth" rule is a trap: the model confirms the example instead of reading the source. Every fallback block states: only if the source field is absent; if present, use it exactly; priority order written out.

## Loop rules

**LOOP-1 · Own the `while` loop.** The model picks the next action; your code owns stop conditions, retries, budget ceilings and approval gates. A framework may run the loop only for Tier-A work, and only if the loop stays readable.

**LOOP-2 · The loop stands on a durable, append-only event log that lives outside the process.** Every iteration writes an event. A run that dies mid-way resumes from the last event — it never restarts from scratch. Prove crash-resume by killing the process mid-run; that is a test, not a nice-to-have.
*Violation looked like:* the 600s action ceiling, the 8-minute elapsed guard, and no crash-resume — all the same missing thing.

**LOOP-3 · A round cap is a timeout, not a success condition.** Every loop needs at least one verifiable or threshold exit (a test passes; every graded criterion clears its bar) PLUS at least one budget or stall guard (step/token/cost ceiling; no improvement across N rounds → stop and escalate). `maxSteps` is a runaway guard, never a definition of done.
*Violation looked like:* "2 REVISE rounds then accept best-effort" — an unconditional pass gate.

**LOOP-4 · State transitions are an explicit state machine over the log, not imperative code.** Typed state, explicit conditional edges, persistent checkpoints — adopt all three inside a single-agent loop before reaching for a graph framework.
*Violation looked like:* the visual_directions routing bug that took archaeology to find instead of a query.

**LOOP-5 · Humans are high-latency tools.** A human decision is a structured tool call that suspends the loop and resumes from the log — not a special case in the orchestrator. Check whether the pause can happen between tool selection and tool invocation; that is the granularity approval actually needs.

**LOOP-6 · Steps are idempotent; a retry never double-executes a side effect.** A durable engine WILL retry steps. Never mutate a prior iteration's record — regeneration creates a new row with a pointer back.

**LOOP-7 · Compact errors back into context.** Catch the failure, summarise it, hand it to the model so it can self-heal instead of crashing the run.

**LOOP-8 · Cap fan-out in code, not in a prompt.** No recursive spawning, bounded branch count, per-run cost ceiling enforced by the orchestrator. Asking a model nicely is not a control.

**LOOP-9 · Every scaffold component is a dated assumption about model weakness.** On every model upgrade, rerun the eval suite, then remove scaffolding one piece at a time and measure what was actually load-bearing.

## Memory rules

**MEM-1 · Four tiers, separate stores, never one undifferentiated "memory".** Working context (assembled per call, curated never accumulated) · episodic (append-only event log) · semantic (durable facts and decisions, per tenant) · procedural (skills/playbooks, pulled by name). Collapsing tiers into standing context was Atelier's OOM, its context rot, and its "why is it ignoring the brand book" complaint — all from one decision.

**MEM-2 · Retrieve, do not inject.** Each stage gets a search tool over memory with a fixed token allowance filled by relevance. If the allowance overflows, the ranking is wrong — do not raise the ceiling.

**MEM-3 · Append only, with provenance.** Corrections supersede; nothing is rewritten or deleted. Every entry carries decision, rationale, source, timestamp, and identifier. An agent-inferred entry never outranks a human decision. Structured entries, not prose blobs — blobs cannot be deduplicated, superseded, or audited.

**MEM-4 · Write the diff before applying a human edit**, so a later regeneration cannot silently revert it.

**MEM-5 · Capture failures, not only successes.** Knowing what to abandon is most of the value; a success-only memory cannot stop a repeated mistake.

**MEM-6 · Never compress the playbook to save tokens.** Brevity bias (summarising away the detail that mattered) and context collapse (iterative rewrites eroding the playbook to a bland shadow) are the two named failure modes. Refinement emits small itemised deltas merged deterministically — never a full rewrite. Retrieve less; do not compress what you keep.

**MEM-7 · Every memory table keys off the tenant id, indexed — never a freeform name string.** Reads filter on tenant with no exceptions. Test isolation adversarially before anything touches real fellow data.

**MEM-8 · Memory must be human-readable and queryable from outside the tool that wrote it.** State only an LLM (or only a vendor) can read is lock-in dressed as convenience.

## Evaluation rules

**EVAL-1 · The thing that generates is never the thing that grades.** Agents confidently praise their own mediocre work, worst on subjective tasks. A skeptical standalone evaluator is tractable to tune; a self-critical generator is not.
*Violation looked like:* the critic shared the generator's framing — which is how "About page renders product mockups" survived.

**EVAL-2 · Give the evaluator eyes.** It navigates the deployed artifact, not the source that produced it. Bugs that survive review are the ones nobody looked at.

**EVAL-3 · Make subjective quality gradable: explicit criteria, hard thresholds.** Any criterion below threshold fails the round and returns specific feedback. Weight the criteria the model is bad at (coherence, originality) over what it handles by default. "Is this good?" is unanswerable; four scored criteria are not.

**EVAL-4 · No evals, not done.** Ten eval tasks written on day one, twenty to fifty within weeks, drawn from real failures and rejections — run on every change. Without them every design opinion is unverifiable. Establish the naked single-call baseline before adding any scaffolding, or you will never know what the scaffolding is worth.

**EVAL-5 · Deterministic before judgment.** Cheap mechanical checks (build passes, schema validates, banned pattern absent) run first and free; spend model judgment only on what genuinely needs it. Validator error messages say exactly what to fix — "invalid file" produces the same mistake three times.

## Tool and topology rules

**TOOL-1 · Fewer tools, unambiguously scoped.** If a human engineer cannot say which tool applies, the agent cannot either. Tool returns are token-efficient — a 40KB blob poisons every later turn.

**TOOL-2 · Default to a single loop.** A loop is already a graph with one node. Multi-agent (orchestrator–worker) is for breadth-first work where total information exceeds one context window — it costs 3–10× the tokens and is documented as *worse* for tightly interdependent work where outputs must cohere. If someone reaches for multi-agent by default, ask what specifically fails with one agent in a loop.

**TOOL-3 · Framework fit gates.** Before adopting any framework or tool, it passes the eval inbox: Does it hide the loop? Is what it stores queryable from outside it? Can it pause between tool selection and tool invocation? What is its eval and versioning story? No ad-hoc adoption.

## Stack decisions (already made — do not relitigate per build)

**STACK-1 ·** Session log and source of truth: **Convex**, append-only, tenant-keyed. Do not duplicate canonical state into an external store.

**STACK-2 ·** Durable execution: **buy, don't build** — Inngest as default for multi-tenant lines; Trigger.dev for sovereign/self-hosted deployments.

**STACK-3 ·** Coded-agent harness: **Mastra with ConvexStore** is the Studio standard for Tier-B/C durable, resumable, or approval-gated agents. Mastra runs the loop; Convex holds the canonical, tenant-keyed state and append-only event log. **Tier-A** single-shot agents may use a lightweight framework loop (for example Vercel AI SDK) or no runtime at all. An alternative harness needs a dated, evidence-backed waiver and must meet the same STATE-1/STATE-1a tests.

**STACK-4 ·** Observability: **Langfuse wired in from the first commit** — every tool call, error, and cost traced.

**STACK-5 ·** Tier selection comes first and the tooling follows: Tier A (one job, <10 steps, one request — framework loop fine, no harness), Tier B (multi-stage, human gates, must survive restarts — own the loop over a durable log), Tier C (subjective quality that must measurably improve — Tier B plus an eval suite as the optimisation target). Never start at Tier C: self-improvement with no trustworthy signal optimises noise, and reward hacking is the default outcome.

---


## Long-horizon rules (agents that run unattended)

Everything above assumes a **request-shaped** run: someone asks, the agent answers, the run ends.
An agent that runs for hours or days with nobody watching fails differently, and these seven are
what 41 hours of it produced. Load them at **design** time — five of the seven are decisions the
PRD has to carry, not implementation details discovered at build time.

**HORIZON-1 · A workflow only where losing work mid-flight costs something.** The question is not
whether the agent matters. It is what one lost run costs. One model call with no state, or
independent cycles that are cheap to redo, need **no workflow** — a lost cycle costs one interval
and the next tick catches up. A human approval gate, state accumulating across steps, or
sub-modules that must be durable on their own each need one. A workflow "because it is the
standard", with no answer to that question, buys a snapshot write per step and nothing else.
*Observed:* the reference agent ran 46 cycles over 41 hours through three sleep/wake boundaries
with no workflow at all.

**HORIZON-2 · Give it the fewest recall channels that answer its question — they compete.** Working
memory, recent messages and semantic recall all answer *"what have I already covered?"*, and each
one added makes the model less likely to maintain the ones that cost it effort. Switching
everything on "to be safe" is the failure mode, not the safe option.
*Violation looked like:* with semantic recall available, the model stopped calling the
memory-write tool entirely — reproduced A/B on one agent, same instructions, same model.

**HORIZON-3 · Memory maintenance is deterministic, never the model's choice. Grade freshness, never
size.** Ask the model for the memory *content* as ordinary output, then write it yourself through
the vendor API — it still does the synthesis, it just cannot skip the write. And judge the state by
whether the **write timestamp advanced**, not by how big it is: a frozen size and a healthy size are
the same number. Beware the inverse too — *unchanged* state is **correct** when the input was
already covered, so a clause reading "memory must change" fails a well-behaved agent (it did, for
seven consecutive cycles).
*Violation looked like:* nine overnight cycles reporting `ok` with memory never written once,
while the agent's own replies said "Updating memory."

**HORIZON-3a · Never write a framework's memory tables out of band.** Raw *reads* for verification
are essential and are what MEM-8 demands. A raw *write* silently removed the agent's ability to
maintain its own memory — the framework stopped offering the write tool at all. And a framework's
memory feature may be **all-or-nothing**: Mastra's injects "you MUST call updateWorkingMemory"
*after* your instructions, so an agent told to write memory itself receives contradictory orders and
satisfies neither. Own both sides or neither.

**HORIZON-4 · Assume the trigger is hostile. Probe before you work, and `offline` is not `failed`.**
A scheduled job fires during a two-second maintenance wake inside a long sleep, with the network
stack still initialising. Probe every dependency *before* starting real work — one host answering
does not prove the network — and classify a network-shaped error as **`offline`**, meaning the
environment failed and there is nothing to debug in the agent. Four statuses, not two:
`ok` · `degraded` · `offline` · `failed`. Every tick must be **idempotent** and able to no-op
cleanly; an agent that can only succeed will hang.
*Violation looked like:* a 44.6-minute hang, recorded as `failed`, leaving orphaned `pending`
snapshot rows that each read as a genuine fault.

**HORIZON-5 · A gap is not a miss until it is unexplained. Measure coverage against awake time.**
Cross-check every gap against the machine's own sleep log and classify it — `asleep` · `jitter` ·
`partly-unexplained` · `unexplained` — and only the last should page anyone. Judging on wall-clock
punishes a machine for being switched off, which is not a fault.
*Violation looked like:* a healthy agent scored at 18% coverage for having been asleep.

**HORIZON-6 · An unattended agent must be able to stop itself.** A soft warning stops nothing at
3am because nobody is awake to read it; the guard has to unload its own scheduled job at the cap. An
agent that cannot stop itself is instrumented, not capped. And **budget from the late token figure,
never the first cycle** — memory makes input grow, measured at +61% for a memory-carrying agent
against +25% for a memoryless control, with the curve not yet flat.

**HORIZON-7 · For a run with no end, the unit of grading is the cycle.** `BEHAVIOR.md`-style
predicates assume a trace with a start and a finish; a background agent has neither. Grade
mechanical predicates over a **window of N cycles** instead. A request-shaped run has a human at the
end who notices a bad answer — a background agent has nobody, so a predicate over its *behaviour* is
the only thing standing between "working" and "quietly stopped".
*The predicate that would have caught HORIZON-3 on cycle one:* the memory-write tool must be
**offered on the provider request and called**, graded from the request itself, never from the
resulting state.

**Cross-run state is not a workflow snapshot.** Worth stating plainly because it is the most common
confusion here: a snapshot resumes an *interrupted run*. Continuity *across* runs is memory plus the
domain store. Reaching for snapshots to carry day-to-day state looks like it works until the first
clean run boundary.

---


## Home, identity, and state (Studio 2026-08 adds)

**HOME-1 · Runtime and talk surface are two decisions.** Runtime is where the loop executes: Utopia OS (default for studio-operated functions), standalone Vercel (library *links* it when it cannot live in the OS), or local Claude / Codex / Cursor (scheduled internal work, or a machine-shaped job). Talk surface is where a person or trigger speaks to it: OS UI, Slack, schedule, CLI. Ask both. The same agent can run locally and be talked to on a schedule.
*Violation looked like:* every PRD assumed Claude chat was both home and surface.

**HOME-2 · Ladder defaults down.** Pick the lowest rung that delivers the job. Climbing for status is the failure. A beginner / fast-pass path still *reports* when it should stop — it does not silently complete the chain (REPORT-1).

**REPORT-1 · Unconditional report on the beginner path.** Fast-pass (rungs 1–3) must still emit the blocker, the rung, the home, the talk surface, and the tool-identity row. Completing without those is theatre. A chain that always finishes is broken.

**ID-1 · Who the tools act as is a required field.** Studio or a named internal team → shared Composio (or first-party API with a service account for GitHub / Linear / Convex). A fellow → their own Composio `user_id` + Connect Link, later on the OS. Never the studio Slack acting as a fellow. Writes on a shared connection need a named owner and a kill switch.

**STATE-1 · Vendor runtime state is a cache, not the source of truth.** For the Studio standard, Mastra uses **ConvexStore**: Mastra runs the loop, while Convex is the only canonical source of truth for run-state and business data. A local/vendor state file is never canonical. Kill the process, start a fresh one, and it must resume from Convex alone. If resume needs a vendor-local file, the design fails LOOP-2 and STACK-1. This is verified for Mastra + Convex by the STATE-1a hard-kill, fresh-process test; every qualifying build must still run its own test.

**STATE-1a · The hard-kill, fresh-process test — the gate STATE-1 is verified by.** Start a run, let it reach real state, then `kill -9` it — not a graceful shutdown, no cleanup hook, no chance to flush. Delete every vendor-local state file. Start a **new process** whose only input is the runId, and it must resume and complete. If it needs anything the killed process left on disk, the design fails STATE-1.

*Verified for the Studio standard*, `@mastra/core@1.63.2` + `@mastra/convex@`**`1.5.4`**: `PASS 12 · FAIL 0 · BLOCKED 0` across 12 golden cases, live model, real Convex. Also verified for the shape module harnesses need — a `suspend()` **inside a nested workflow**, hard-killed while suspended and resumed from Convex alone. A nested workflow gets its own snapshot row sharing the parent's runId, so a sub-module is independently resumable.

**Pin `@mastra/convex` at 1.5.4.** 1.5.5 **fails this test** — bisected with everything else held constant. A caret range here is a live hazard, not a style preference.

*This supersedes the 24–25 Aug STATE-1 entry*, which recorded the test as designed but not run against real infrastructure. Every qualifying build still runs its own.

**CTX-2b · Prefetch exception.** Retrieve on demand (CTX-2, MEM-2) except when you already know you will need a payload this run — fetch it once, write it to the log, do not spend a later loop step finding it again. That is the only exception.

## Pre-flight checklist

Run before calling any agent build or review done. Each unchecked item is either fixed or explicitly waived with a reason.

- [ ] Ten or more eval tasks exist, with graders, before scaffolding was added (EVAL-4)
- [ ] Naked baseline recorded — the number the scaffolding must beat (EVAL-4)
- [ ] Loop has a verifiable/threshold exit AND a budget/stall guard — a round cap alone fails this (LOOP-3)
- [ ] Durable append-only log outside the process; crash-resume proven by killing it mid-run (LOOP-2)
- [ ] Generator and evaluator are separate; evaluator sees the real artifact (EVAL-1, EVAL-2)
- [ ] Every stage handoff typed and validated; payload asserted present in the assembled prompt (CTX-3)
- [ ] Prompt content read at runtime, or content-hash asserted (CTX-4)
- [ ] Only the invariant core preloaded; everything else pulled via tools (CTX-2)
- [ ] Every fallback gated with "only if absent" (CTX-6)
- [ ] Four memory tiers named, even if the answer is "not used"; tenant-keyed; retrieval budgeted (MEM-1, MEM-2, MEM-7)
- [ ] Steps idempotent; no prior record mutated (LOOP-6)
- [ ] Fan-out and cost capped in code (LOOP-8)
- [ ] Langfuse tracing live from commit one (STACK-4)
- [ ] Tier recorded, and the stack choices that follow from it (STACK-5)
- [ ] Runtime home and talk surface both named (HOME-1)
- [ ] Lowest rung chosen; beginner path still reported blockers (HOME-2, REPORT-1)
- [ ] Tool identity named: studio / team / fellow / service API (ID-1)
- [ ] Kill-and-resume from Convex log only — no vendor state file required (STATE-1, LOOP-2)
- [ ] Context pulled on demand, or prefetched into the log on purpose (CTX-2, CTX-2b)

**If the agent runs unattended — scheduled, event-driven, or in the background — also:**

- [ ] Workflow-or-not decided against what one lost run costs, and the answer recorded (HORIZON-1)
- [ ] Recall channels chosen as the *fewest* that answer the question, not all of them (HORIZON-2)
- [ ] Memory written deterministically by code, not left to the model (HORIZON-3)
- [ ] Durable state judged on **write freshness**, never on size; no clause reading "memory must change" (HORIZON-3)
- [ ] No out-of-band writes to any framework memory table (HORIZON-3a, MEM-8)
- [ ] Dependencies probed before real work starts; every tick idempotent and able to no-op (HORIZON-4)
- [ ] Four statuses emitted, with `offline` distinct from `failed` (HORIZON-4)
- [ ] Gaps attributed against the machine's sleep log; coverage measured against **awake** time (HORIZON-5)
- [ ] A hard cost cap the agent can enforce **on itself**, budgeted from late-run token figures (HORIZON-6)
- [ ] Conduct graded per **cycle** over a window, not per run (HORIZON-7)

## The compounding loop

This skill is append-only and grows the same way the rest of the framework does: **every production failure becomes a rule entry here and a permanent eval case.** When a new failure surfaces:

1. Write the rule in the format above — ID, imperative rule, one line of why, and *Violation looked like:* the actual failure, dated.
2. Add the failure to the affected agent's eval suite as a permanent regression case.
3. Never rewrite existing rules to make room — supersede explicitly (`CTX-1 superseded by CTX-9, 2026-XX-XX`) so history stays auditable (MEM-3 applies to this file too).

Each build makes the next one cheaper. That loop is the difference between a framework and a folder of documents.

## Deeper reference

The full reasoning, the tool evaluations, the memory-store bake-off protocol, the build-order sequence, and the reading list live in the source playbook: **"Building Agents That Don't Break — Utopia Studio"** (Haniyah Umair, July 2026). Read it when you need the *why* behind a rule at length, the topology comparison tables, or the vendor verdicts. This skill is the enforceable surface; the playbook is the evidence.
