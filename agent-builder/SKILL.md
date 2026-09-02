---
name: agent-builder
description: >-
  The front door for building any agent at Utopia Studio — technical or not. Fires when
  someone wants to build, plan, scope, or ship an agent and hasn't been routed to a specific
  stage: "I want to build an agent", "help me build an agent for X", "where do I start with
  agents", "we need an agent that...", "turn this workflow into an agent". Runs a short
  intake, then chains the build-craft skills in order — workflow-design (fleet or solo?) →
  agent-design (role · tools · memory) → eval-first-spec (golden cases · autonomy · cost) →
  agent-prd (gates → PRD → work orders) → mastra-harness (workflow? memory? → implement,
  then doctor) — carrying each stage's artefact into the next so nothing gets re-asked. Exits non-builders early on the surface ladder (skill → project →
  managed → coded) with a checklist instead of a codebase. Always load `learnings` first and check the design against its rule IDs.
  Do NOT fire when a specific
  stage is named ("spec just this one agent" → agent-design, "design the fleet" →
  workflow-design, "write the PRD" → agent-prd, "build the work order" → mastra-harness) — this is the router, not a replacement.
type: orchestrator
supersedes: none
---

# Agent Builder

## What it does

Turns "I want to build an agent" into a finished, gated build plan by running the four
build-craft skills **in order, with explicit handoffs**. The person answers questions;
the pipeline decides how deep to go based on their answers, not on how much they already
know. Every stage emits an artefact the next stage consumes, so by the end there is one
coherent chain: a fleet map → an agent spec per node → a scoreable eval contract → a
buildable PRD with work orders. Or — for most people — an early exit at a lower rung of
the surface ladder with a checklist, which is the correct output, not a consolation prize.

```
Intake → workflow-design → agent-design (×N agents) → eval-first-spec → agent-prd
  |            |                    |                       |               |
 job line   fleet map          agent spec(s)          eval contract    PRD + work orders
           (or: solo →         (or: exit at                            (or: exit at
            skip to             rung 1–3 with                           strategy doc,
            agent-design)       a checklist)                            flagged as such)
```

## Why this skill exists

The four stage skills are good alone and better chained, but chained by hand they leak:
the same questions get asked twice, memory gets described in two vocabularies, the
generator≠evaluator rule gets restated three ways, and a fellow who only needed a Claude
project gets marched toward a codebase. This skill is the carrier — it holds the answers,
translates between the stages, and enforces the shared rules exactly once.

## When to use / When NOT

Use when someone wants to build an agent and hasn't been routed yet — especially when
they're non-technical, when the scope is unclear (one agent or several?), or when they've
never run the underlying workflow by hand.

| Not this skill | Use instead | Why |
|---|---|---|
| "Design the fleet / orchestrate the agents" | `workflow-design` | They've already routed themselves to stage 1. Run it directly. |
| "Spec this one agent's role / tools / memory" | `agent-design` | Stage 2 directly. |
| "Write the golden cases / set autonomy / cost" | `eval-first-spec` | Stage 3 directly. |
| "Write the agent PRD / work orders" | `agent-prd` | Stage 4 directly — but check stages 1–3 artefacts exist first; if not, offer to run the chain from where the gaps start. |
| "Improve a live agent / raise autonomy" | `refine-flywheel` | Post-launch. This pipeline is pre-first-commit. |

## Method

Copy this checklist:

```
Agent-builder progress:
- [ ] Step 0: Load learnings; intake — 5 questions, then pick the entry point
- [ ] Step 0b: Use — runtime home, talk surface, tool identity, context route
- [ ] Step 1: Run workflow-design → fleet map (or solo verdict)
- [ ] Step 2: Run agent-design per agent → agent spec(s)
- [ ]   Step 2a: Surface-ladder gate — lowest rung; beginner path still reports
- [ ]   Step 2b: Wedge gate — adoption evidence in hand?
- [ ] Step 3: Run eval-first-spec → eval contract (golden cases · autonomy · cost)
- [ ] Step 4: Run agent-prd → PRD + work orders (engineering gates enforced)
- [ ] Step 5: Chain check — memory table, gen≠eval, kill line, home/ID/STATE-1
```

### Step 0 — Load learnings, then intake (5 questions)

**Before the first question, load `learnings`.** Cite rule IDs when you block or waive. Silent violation is forbidden.

Ask the five, 2–3 at a time. Then run Step 0b. Do not skip 0b on the beginner path (REPORT-1).

1. **The work.** What work should this do, and what artefact does it produce, for whom?
   (This becomes workflow-design's Step 1 job line — write it down once, carry it forward.)
2. **Has a human done it?** Has this workflow been run by hand at least once, with real
   inputs and outputs you could show me? If no: the honest first step is "run it by hand
   to seed real traces" — record that and offer to design the by-hand run instead.
3. **One or many?** Does the work have parallel sub-tasks, a produce-and-judge conflict,
   or context depth beyond one agent? (Pre-screens workflow-design's Step 0 gate — if
   all clearly no, enter at agent-design and skip stage 1.)
4. **Who builds and runs it?** You, another fellow, the studio? Comfortable in a repo, or
   is Claude.ai/Cowork the ceiling? (Feeds the surface-ladder gate at Step 2a.)
5. **What breaks if it's wrong?** Reversible or irreversible actions, who's harmed, who
   must approve. (Pre-seeds autonomy level for eval-first-spec and blast-radius rows for
   agent-design's tool table.)

Record the answers in one intake block. Every stage reads from it; no stage re-asks it.


### Step 0b — Use: home, surface, tools, context

Second beat. Cannot skip. Fast-pass still answers these and *reports* them (REPORT-1, HOME-2).

Ask 2 at a time:

6. **Runtime home (HOME-1).** Where does the loop execute *this week*?
   - **Utopia OS** — default if the studio operates this as a function. Library row now; OS runs it later.
   - **Standalone** — own Vercel app. OS library only *links* it, because it cannot live in the OS yet.
   - **Local** — Claude / Codex / Cursor on a machine. Real home when the machine is the point (schedule, repo, internal team). Not a waiting room.
7. **Talk surface (HOME-1).** Where do people or triggers speak to it? OS UI, Slack, schedule, CLI. This is *not* the same answer as 6.
8. **Who do the tools act as (ID-1)?** Studio shared Composio · named-team shared Composio · fellow (their Composio user, later) · first-party API / service account. Writes on a shared connection need a named owner.
9. **Context route.** Invariant core preloaded; everything else pulled (CTX-2). Prefetch into the Convex log only when you already know you will need it (CTX-2b).

Record on the carrier. Stages do not re-ask. Default destination of the *record* is always the OS library, even when runtime is local or Vercel.

### Step 1 — workflow-design → fleet map

Run `workflow-design` with the intake block. Its Step 0 fleet-or-solo gate is the first
kill point: if solo, take its routing at face value, skip to Step 2 with one agent. If
fleet, the output artefact is the **fleet map** — the step table, spawn triggers, surfaces,
loop exits. Carry forward per agent: its cognitive mode, spawn trigger, done signal,
hand-off targets, and surface.

### Step 2 — agent-design per agent → agent spec(s)

For each node in the fleet map (or the one solo agent), run `agent-design`. Pre-fill from
the carrier: the role's trigger is the spawn trigger from Step 1; the intake's blast-radius
answers seed the tool table's guardrail column. Output per agent: the four-part spec —
role · tools · memory layer · eval pointer. Translate its memory design through the
**shared memory table** (below) so stage 4 receives it without re-mapping.

### Step 2a — Surface-ladder gate (the non-builder exit)

Before going deeper, place the build on the ladder. Pick the **lowest rung that delivers
the role** — climbing for status is the failure, not the goal (HOME-2).
On rungs 1–3, still emit home, talk surface, tool identity, and any blocker.
A fast-pass that "just finishes" without those rows fails REPORT-1.

| Rung | Surface | It is | Exit artefact | Exit here when |
|---|---|---|---|---|
| 1 | **Skill** | A SKILL.md + template in the marketplace | The skill file + a usage checklist | The role is a tell-able procedure; no state between runs |
| 2 | **Project** | A Claude project / Cowork setup with instructions + files | Setup checklist + the instruction files | Needs standing context and files, no custom loop |
| 3 | **Managed** | An existing runtime (OS run button, Cowork schedule, approval queue) | Config + handoff package + owner | Needs scheduling, approvals, or run visibility — but the loop is the platform's |
| 4 | **Coded** | Custom loop, durable log, validators | Full PRD + work orders (Step 4) | Needs its own loop, durability, or a generator–evaluator pattern |

Rungs 1–3 still get stages 3 and 4 — but agent-prd runs in **fast-pass mode** (its Gates
1, 1B, 2, 4, 5), and the deliverable is a checklist-grade document, not a codebase spec.
Say the rung out loud and why. A rung-1 exit with a working checklist beats a rung-4 PRD
nobody can execute.

### Step 2b — Wedge gate

eval-first-spec assumes a **validated wedge** — adoption evidence in hand — and refuses to
spec from nothing. Check before entering stage 3: is there behaviour or money behind this
agent (someone already does this work, asked for it, or pays for it), not just an opinion
that it would be useful? If the wedge is unvalidated, stop the chain here and route to
`wedge-five-questions` first. Do not let the pipeline's momentum carry a nobody-wants-this
idea into a fully specced, fully gated PRD — that is the most expensive way to find out.

### Step 3 — eval-first-spec → eval contract

Run `eval-first-spec` per agent. Pre-fill: the job line from intake, autonomy ceiling from
intake Q5, and golden-case seeds from the by-hand runs (intake Q2) — the last three
rejected outputs are the first three cases. Output: the **eval contract** — job line,
golden cases, autonomy level with failure rates, cost-per-outcome. This is the single
place the eval is authored. Stages 2 and 4 point at it; neither restates it.

### Step 4 — agent-prd → PRD + work orders

Run `agent-prd` with everything the carrier holds: fleet map, agent specs, eval contract,
ladder rung. Its interview now skips what's answered and drills into what only it covers —
I/O contracts, loop pattern + exit conditions, durability, timeout budgets, validators,
event schema — then work orders with acceptance tests, only after the hard gates pass.
Its strategy-doc failure mode is the pipeline's too: a chain that stops after Step 3
*feels* finished and isn't. Name the transition and finish.

**Before emitting the deliverable, re-open agent-prd and verify against its Output
contract section** — deliver in the format that contract mandates for this environment
(file creation available → a real document with rendered diagrams and the run-sequence
checklist as a real table, template section names 1–12 including Decisions and
rationale), not in the format the conversation has drifted into. A stage's deliverable
is judged by that stage's own contract; chat momentum is not a format. This check
applies at every stage, but stage 4 is where it fails most — it is the last stage, the
context is fullest, and the document is the artefact non-builders actually read.

### Step 5 — Chain check

Three shared rules, enforced here, once:

**1 · One memory table.** Stores (agent-design) are *where*; tiers (agent-prd) are *what
kind*. Emit exactly one mapping in the final document; neither vocabulary appears unmapped.

| agent-design store | agent-prd tier(s) | What lives there |
|---|---|---|
| CLAUDE.md | Semantic (curated core) | Durable facts, org map, standing rules, thresholds |
| skills | Procedural (explicit half) | Tell-able, versioned procedures |
| lessons.md | Procedural (tacit half) + Semantic (decisions) | Append-only corrections — what changed and why |
| trace archive | Episodic | Every run: input, output, human edit, outcome |
| *(assembled per call)* | Working context | Built fresh each call from the stores above — never a store itself |

**2 · One generator≠evaluator rule.** Canonical statement: *nothing grades its own work —
the evaluator is always a separate agent, prompt, or human from the generator, at every
level.* workflow-design's critic-independence (Step 6), agent-design's eval gates, and
agent-prd's Gate 4 / Trap 12 are all instances of this rule; the final document states it
once and cites it three times.

**3 · The combined kill line.** Both disciplines, both directions:
- **Blocker verdicts** (from Icarus): any stage may return "not shippable — X missing"
  and the chain stops there, stating the smallest next step. The named exits: Step 1
  "no work named — ask the one question"; Step 2 "no traces — run it by hand first";
  Step 2b "no wedge — wedge-five-questions first"; Step 3 "fewer than 14 real inputs —
  go get more, never fabricate"; Step 4 "gates unmet — flagged as strategy doc, not
  spec". A chain that always completes is theatre; a blocker firing is the pipeline
  working.
- **Hard gates** (from agent-prd): thresholds not just weights, exit conditions not just
  ceilings, an event schema not just an architecture diagram. A document that reads
  finished but fails these is flagged as a strategy doc, in the document itself.

**4 · Learnings loaded.** `learnings` was applied. New production misses become a rule ID + eval case, not a Slack anecdote.

**5 · Home, identity, one store.** Runtime home and talk surface are both named (HOME-1). Tool identity is named (ID-1). For rung 4 / Tier B–C, Mastra + ConvexStore is the Studio standard: Mastra runs the agent loop and Convex is the only source of truth. A kill-and-fresh-process resume from Convex is required (STATE-1, LOOP-2); any vendor-local state is cache. An alternative harness requires a dated, evidence-backed waiver and the same tests.

The chain ships only when: intake *and Step 0b* are on record; the fleet-or-solo verdict is explicit;
every agent has a four-part spec; the rung is named with a reason; the eval contract
exists and is pointed at (not restated); the PRD's hard gates pass or the fast-pass
deferrals are listed as blocking; and the three shared rules above each appear exactly
once. Anything missing → name it, stop, smallest next step.

## Gotchas

- **Format contracts erode under orchestration.** Each stage skill's output contract is
  binding when run inside the chain — the carrier changes what a stage *knows*, never
  what it *delivers*. If agent-prd's contract says a rendered document with diagrams and
  the checklist as real tables, the chain produces that, not a chat-message summary of
  it. Verify each stage's deliverable against that stage's own output contract before
  moving on.
- **Re-interviewing.** Each stage skill has its own questions; run them against the
  carrier first and only ask the person what the carrier can't answer. The tell that the
  chain is broken: the person types the same fact twice.
- **Ladder-climbing.** Defaulting every build to rung 4 because the pipeline ends in a
  PRD. Most Utopia agents to date are rung 1–3. The PRD stage adapts to the rung; the
  rung does not stretch to fill the PRD.
- **The polite chain.** Running all five steps to completion because stopping feels like
  failure. A Step 1 "this is a solo agent" or a Step 2 "no traces exist — run it by hand
  first" is the pipeline working, not the pipeline failing.
- **Vocabulary leak.** A final document that says "lessons.md" in one section and
  "procedural memory" in another with no mapping. One table, once, always.

## Related skills

`learnings` — load first; rule IDs are law.
`workflow-design` (stage 1), `agent-design` (stage 2), `eval-first-spec` (stage 3),
`agent-prd` (stage 4) — the pipeline runs them; it never restates their internals.
`refine-flywheel` — where the shipped agent goes next; out of scope here.
`explicit-vs-tacit-capture`, `dataset-builder` — feed the memory layer and golden cases
when intake Q2 finds real by-hand runs.

Supersedes: none. New skill — the intake/orchestration layer the pack routes around but
nothing currently owns.
