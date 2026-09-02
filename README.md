# Studio Standard Agent Framework

The Utopia Studio standard for how agents get **specified, judged, and shipped**.

Six skills. One pipeline. The point is that an agent build at the Studio is not a
matter of taste: the scope is written so it can be scored, the thing that grades is
never the thing that generated, the rules that stopped us before are loaded before
the first question, and a build that isn't ready gets stopped with the reason named
instead of politely completed.

Install all seven. They are a chain, not a menu.

```
learnings/            the hard rules — load first, cited by ID (CTX-1, MEM-8, STATE-1a, HORIZON-4 …)
agent-builder/        the front door — intake, then chains the four stages
  hermes/             the eval harness around agent-builder (rubric + cases + judge log)
workflow-design/      stage 1 — fleet or solo, spawn triggers, loop exits
agent-design/         stage 2 — one agent: role · tools · memory layer · eval pointer
eval-first-spec/      stage 3 — 20 golden cases, autonomy L0–L4, cost per outcome
agent-prd/            stage 4 — hard gates → PRD → work orders
mastra-harness/       stage 5 — implement a work order on Mastra + ConvexStore
```

Stage 5 exists because stage 4 ends with *"Stop. Do not begin executing the first order unless
asked"* — and nothing picked it up from there. It decides, per agent, whether the agent needs a
Mastra workflow at all and which memory channels it gets (both are real choices with real costs,
not defaults), then ships the three runtime pieces that are always forgotten and a `doctor`
command that must exit 0 before an order is called done. Evidence in
[`long-horizon/`](long-horizon/).

**Credits.** `agent-design`, `workflow-design`, and `eval-first-spec` are from Ollie's
Icarus pack (modules 09 + 07), bundled here unchanged so the chain is testable in one
place. `agent-builder`, `agent-prd`, `mastra-harness`, and `learnings` are Haniyah's.

---

## Install (~2 min)

Claude.ai → Settings → Capabilities → Skills → Add → upload each folder's `SKILL.md`
(or the whole folder, where supported). All seven go in Personal skills:

`learnings` · `agent-builder` · `workflow-design` · `agent-design` ·
`eval-first-spec` · `agent-prd` · `mastra-harness`

Seven, not six. The orchestrator loads `learnings` before its first question and
cites rule IDs when it blocks or waives something — without it installed the chain runs
with its rules missing and no one is told.

> **If you installed `atelier-learnings` before Sep 2026, remove it.** It was renamed to
> `learnings` — the rules were never only Atelier's, and the long-horizon `HORIZON-*` family came
> from the Mastra harness run instead. **Every rule ID is unchanged**, so nothing that cites
> `CTX-1` or `STATE-1a` breaks. But leaving both installed is worse than either alone: the
> orchestrator may load the stale copy, which has no `HORIZON-*` rules and no real definition of
> `STATE-1a`, and you will not be told which one it read.

**No git? Grab the whole repo as one zip:**

```bash
curl -L -o studio-standard-agent-framework.zip \
  https://github.com/The-Utopia-Studio/studio-standard-agent-framework/archive/refs/heads/main.zip
unzip studio-standard-agent-framework.zip
```

Unzips to `studio-standard-agent-framework-main/`, containing all six skill folders above
plus supporting docs. No auth needed — it's the same archive GitHub's own "Download ZIP"
button serves. Upload the six folders (or the whole unzipped directory, where the uploader
supports a folder at a time) into Claude.ai's skill uploader per the step above.

---

## "Build" enters the pipeline. "Design" is one stage.

This is the single most common mistake, and it is not a bug in either skill.

| You type | You get | Because |
|---|---|---|
| "I want to **build** an agent that …" | `agent-builder` — intake, then the whole chain | Build = the pipeline |
| "**Design** an agent for …" | `agent-design` — one four-part spec, no chain | Design = stage 2, correctly |
| "**Design the fleet** / orchestrate the agents" | `workflow-design` — stage 1 only | Already self-routed |
| "**Spec the build** / how do we know it works" | `eval-first-spec` — stage 3 only | Already self-routed |
| "Write the **agent PRD**" | `agent-prd` — stage 4 only | Already self-routed |

If you want the chain, say **build**. If you say **design** and get one stage, the
router worked.

---

## What the chain actually asks first

Two beats before any design happens. Both are on the record; no later stage re-asks them.

**Beat 1 — Intake (5 questions).** What work, and what artefact for whom · has a human
done it by hand with real inputs and outputs · one agent or many · who builds and runs it
· what breaks if it's wrong.

**Beat 2 — The use beat (4 questions).** This is the one people skip, and it cannot be
skipped:

- **Runtime home** (HOME-1) — where the loop *executes* this week. Utopia OS, standalone
  Vercel, or local Claude/Codex/Cursor.
- **Talk surface** (HOME-1) — where a person or trigger *speaks to it*. OS UI, Slack,
  schedule, CLI. **This is a different answer from runtime home.** The same agent can run
  locally and be talked to on a schedule. Every PRD before this rule existed assumed
  Claude chat was both.
- **Who the tools act as** (ID-1) — studio shared Composio · named-team shared Composio ·
  the fellow's own Composio user · first-party API / service account. Never the studio
  Slack acting as a fellow. Writes on a shared connection need a named owner and a kill
  switch.
- **Context route** (CTX-2, CTX-2b) — invariant core preloaded, everything else pulled on
  demand. Prefetch into the log only when you already know you'll need it this run.

Answer honestly, especially "has a human done this by hand?" and "what breaks if it's
wrong?". The pipeline sets its depth from your answers, and a blocker firing is the
pipeline working, not failing.

---

## How to test it fully

Four tests. The first is two minutes; the last is the one that actually matters.

### 1 · Smoke table — does the router route?

Each row in a **fresh chat**. A loaded sibling skill changes routing behaviour (observed
17 Aug: "design the fleet" sent mid-conversation blended with the already-loaded
`agent-design` instead of routing). A contaminated run is **invalid**, not failed.

| # | Type this | Expect loaded | Pass looks like |
|---|---|---|---|
| S1 | "I want to build an agent that \<something you do by hand weekly\>" | `agent-builder` | Intake first — 5 questions batched 2–3 at a time, then the use beat |
| S2 | "Design an agent for \<same thing\>" | `agent-design` | One four-part spec. No chain. No intake. |
| S3 | "Design the fleet for \<a multi-step job\>" | `workflow-design` | Fleet-or-solo gate, spawn triggers with observable conditions |
| S4 | "Spec the build — how do we know it works?" | `eval-first-spec` | Golden cases + autonomy + cost, refuses to spec from nothing |
| S5 | "Write the agent PRD for \<X\>" | `agent-prd` | Asks for stages 1–3 artefacts first, offers to fill gaps |
| S6 | Any of the above | `learnings` also loaded | Rule IDs cited when something is blocked or waived |
| S7 | "Build an agent that writes haikus about our roadmap" | `agent-builder`, then **stops** | Wedge blocker fires before any config — nobody asked for this |

S7 is the important one. A chain that always finishes is broken.

### 2 · REPORT-1 on the beginner path

Run S1 with something small and real — a weekly task, nothing irreversible. Expect a
**low rung** (1 skill / 2 project / 3 managed) and a checklist, not a codebase spec. Most
Studio agents to date are rungs 1–3; climbing the ladder for status is the failure.

Then check the thing fast-pass gets wrong. Even on rungs 1–3 the run must still emit:

- [ ] the blocker (or an explicit "none")
- [ ] the rung, with the reason it was chosen
- [ ] the runtime home
- [ ] the talk surface
- [ ] the tool-identity row

A fast-pass that quietly completes without those five rows **fails REPORT-1**. That is
theatre, and it is a reportable bug — send it to Haniyah.

### 3 · Hermes — the eval harness

`agent-builder/hermes/` is the harness around the orchestrator: `rubric.json`
(5 dimensions × 0–5, pass ≥ 21, no dimension < 4), 9 golden cases, 5 adversarial cases
drawn from *observed* failures, and `RESULTS.md`. Round 1 (17 Aug 2026): **6 pass ·
1 partial · 0 fail**, 24/25 on the rubric.

Two rules transfer to every skill's harness, and Hermes doubles as the proposed general
eval standard for Studio skills — swap the cases, keep the structure:

1. **The judge is never the generator.** A separate Claude instance (or a human) scores,
   given the rubric + the case + the transcript. The instance that ran the chain never
   scores itself.
2. **Adversarial cases must attack the skill's *stated* kill lines.** A kill line with no
   case that can trip it is decoration.

Re-run cadence: full golden set on any skill edit · full set **twice** on every model
release, once with the skill loaded and once bare (if the bare model passes, that's a
deprecation flag) · after any live run that misbehaves, distil the failure into a new
adversarial case *before* fixing the skill, so the fix has a regression test.

Read `agent-builder/hermes/README.md` for the full judge protocol.

### 4 · STATE-1 kill-test — the one that matters

Only for rung 4 / Tier B–C builds, and it is not optional there. **Vendor runtime state
is a cache, not the source of truth.**

```
1. Start a run.
2. Kill it mid-run — hard. Not a graceful shutdown.
3. Start a FRESH process. New PID, no warm memory, no local state file available.
4. It must resume from the canonical append-only log ALONE.
```

If resume needs the harness's own state file, the design **fails** — LOOP-2 (durable log
outside the process) and STACK-1 (one source of truth). Not a warning; a fail.

Prove it by killing the process. That is a test, not a nice-to-have.

---

## The coded-agent standard: Mastra + Convex

**Mastra + ConvexStore is the Studio standard harness for Tier B/C coded agents.** Mastra
runs the agent loop; Convex holds the canonical, append-only, tenant-keyed event log and
business data. These are complementary roles, not competing choices.

This decision is based on the Mastra-on-Convex STATE-1a probe: a live Kimi K2.6 agent was
hard-killed with `SIGKILL`, then resumed in a fresh process from the remote Convex state
without a model re-fire or duplicate send. An independent process also read the suspended
state directly from Convex. See [`docs/bakeoff/findings-mastra.md`](docs/bakeoff/findings-mastra.md).

Mastra's default local/LibSQL state is **not** the approved production architecture. A
qualifying build uses `ConvexStore`, and it must still prove its own kill-and-fresh-process
recovery. The decision makes Mastra the Studio default; it does not claim Mastra is best in
every context.

An alternative harness requires a dated, evidence-backed waiver and must meet the same
STATE-1/STATE-1a requirements: canonical state in a tenant-keyed, externally queryable
store; hard-kill recovery in a fresh process; no duplicate external action.

### Decision record — 26 August 2026

**Decision:** Mastra + ConvexStore is the standard runtime harness for coded Tier B/C
Studio agents. **Evidence:** live-model hard-kill, fresh-process recovery, independent
Convex read-back, and no duplicate-send verification. **Review condition:** revisit this
default only when new evidence shows the standard no longer meets Studio requirements or a
candidate demonstrably meets them better under the same conformance suite.

Read the decision and Product Framework / future Utopia OS integration rationale in
[`docs/decisions/2026-08-26-mastra-convex-and-product-framework.md`](docs/decisions/2026-08-26-mastra-convex-and-product-framework.md).

**The W-01 waiver.** A probe may run its canonical log somewhere other than Convex *only*
under a dated **W-01** waiver: which probe, which store is standing in as canonical, why
Convex wasn't used, and the date. The waiver covers a probe — it does not travel to a
production build, and it does not suspend the STATE-1 kill-test. The probe still has to
resume from whatever its canonical log is, with a fresh process, on its own. An undated
waiver is not a waiver.

---

## Long-horizon agents: the harness in practice

The STATE-1 kill-test and the 26 Aug decision are about surviving **one** interruption. An agent
that runs for minutes to days raises questions neither answers: what it remembers between runs,
what happens when the machine sleeps or the network drops mid-run, how you know a week-long run
is still working without reading logs, and how you grade *how* it behaved rather than only
whether the output was right.

[**`long-horizon/`**](long-horizon/) answers those, with evidence, and marks clearly where it
doesn't.

| | |
|---|---|
| [`long-horizon/HARNESS.md`](long-horizon/HARNESS.md) | The pinned stack, what a kill-test pass looks like field by field, the five structural pieces to copy, and what running unattended actually does to an agent |
| [`long-horizon/MEMORY.md`](long-horizon/MEMORY.md) | Memory across processes, how to prove it, and what it costs as it grows |
| [`long-horizon/BEHAVIOR.md`](long-horizon/BEHAVIOR.md) | Grading conduct separately from output, and the plan to wire it in |
| [`long-horizon/research/`](long-horizon/research/) | Dated source research behind all three |

**Use it when** you are building or reviewing a Tier B/C coded agent that runs unattended. Start
with `HARNESS.md` for the pinned versions and the five pieces; add `MEMORY.md` if it needs to
remember anything across runs; reach for `BEHAVIOR.md` at eval time.

**Three things it will save you.** `@mastra/convex` **1.5.4, not 1.5.5** — 1.5.5 fails the
kill-test. The bundled package reference calls the Convex workflow table plural, but the runtime
uses `mastra_workflow_snapshot` (singular); the checked-in schema follows the runtime. And the durable-agent APIs
(`createInngestAgent`, `untilIdle`) are **not new in 1.63** — they shipped in 1.30.0 and 1.41.0
and were already present when the 26 Aug decision was made, so "we should adopt them now that
they exist" is not the argument.

**Why it is a folder and not a decision record.** The 26 Aug decision picked a harness. This is
the accumulating operational knowledge of running on it — versions that break, environment
behaviour, costs that scale, and our own measurement errors. It is expected to change, and each
file separates *verified here* from *unverified* from *false* so a plausible claim never gets
carried as a fact.

---

## Feedback

**→ Haniyah.** Failures are wanted more than compliments.

Especially: a misroute · a question you had to answer twice · a gate that should have
fired and didn't · a fast-pass run that finished without the five REPORT-1 rows · a chain
that felt finished and wasn't.

Each one becomes a case in `agent-builder/hermes/cases/adversarial.md` and, if it was a
production miss, a dated rule in `learnings` — never a Slack anecdote. That loop
is the difference between a framework and a folder of documents.
