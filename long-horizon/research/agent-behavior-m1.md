# Agent Behavior standard — research + M1 decision

**31 Aug 2026.** Summarises the M1 research for the framework's own use. Full source:
[agentbehavior.dev](https://agentbehavior.dev) ·
[braintrustdata/agentbehavior](https://github.com/braintrustdata/agentbehavior) · launched
~29 Jul 2026 by Braintrust + Basis.

Framework-facing conclusions are in [`../BEHAVIOR.md`](../BEHAVIOR.md). This file is the
research and the judgement calls behind it.

---

## The core idea

Long-horizon agents need **process supervision**, because outcomes alone are insufficient —
and a recorded trajectory carries enough signal to judge conduct. A `BEHAVIOR.md` is a grading
standard for that conduct, deliberately separated from anything the agent reads at runtime.

The standard's own non-goal is the sharpest part of it: *"Clients SHOULD NOT inject all
behavior specs into runtime prompts unless intentionally building a behavior-conditioned
agent."* Specs are **pure eval artefacts**.

## The six decision outputs

1. **Directory convention** — `.agents/behaviors/<slug>/BEHAVIOR.md` at repo root, per the
   standard exactly, so future tooling that scans the convention works unmodified.
2. **Trajectory source of truth** — tool calls (name, args, result, duration), blocked/prevented
   calls tagged `blocked: true` and excluded from violation scoring, loop stage transitions, and
   errors/retries/escalations.
3. **Judge strategy — hybrid, self-built.** Adopt the predicate vocabulary and true/false/na
   convention; deterministic predicates first, semantic LLM checks only where judgement is
   genuinely needed.
4. **Integration point** — extend the existing evaluator, not a separate `behavior-eval`
   package, because the combined gate needs both scorers emitting a comparable shape.
5. **Initial spec targets** — five: `sandbox-before-exec`, `effect-fence-escalation`,
   `compound-loop-honesty`, `tool-failure-recovery`, `budget-awareness`.
6. **Inventory schema** — `behaviorSpecs: string[]`,
   `behaviorCompliance: {specSlug, verdict, lastRunAt, evidence?}[]`, `behaviorPassRate: number`.

## On `behavior-judge`: adopt the vocabulary, not the dependency

`behavior-judge` is the upstream reference implementation for compiling specs into deterministic
plus semantic rules. Honest assessment: a **single-developer project**, built the week of the
standard's launch, no published depth beyond the repo description.

The predicate surface — `ordering` / `pairing` / `required` / `forbidden` / `count` — is small
and well specified, which cuts both ways: it is exactly why vendoring is unnecessary. Cheaper to
implement five functions over our own trajectory format than to take an unmaintained package
into a runtime dependency. Revisit if it gains contributors and releases.

## Why the specs had to be fact-checked against source

The first drafts were written from project notes rather than from reading the code. Checked
line-by-line afterwards, **four of five needed correction** — which is the transferable lesson,
not the individual fixes:

- one cited a ticket ID that **does not exist**; the mechanism it described was real, so the
  reference was re-pointed at the actual file
- one was named after **marketing copy** ("money fence") rather than the name used in the code
  ("Effect fence")
- one referenced a system appearing in **2 files, both copies of one generated diagram**
- one asks a judge to find a confirmation event that **may not exist** — see below

A spec that names something a grader cannot resolve is not gradeable. Fact-check references
against source before authoring, not after.

**Also a naming collision worth knowing:** "Compound" means a **loop stage** in one repo and a
**memory tier** (Working / Episodic / Compounding) in the other. Same word, two meanings, one
repo apart. Disambiguate it in any shared doc.

## The one spec that was genuinely blocked

`sandbox-before-exec`. The real gate rejects a request missing `requireSandbox: true` and
creates the sandbox **before** the run starts. It is a structural precondition *upstream* of
the trajectory, not an event inside one — so as drafted the spec would either fail every
trajectory or be ungradeable.

M1's recommendation was to hold it pending the trajectory event format. **We have since solved
the same shape** with a network preflight: have the precondition emit a record where it already
makes its decision. See [`../BEHAVIOR.md`](../BEHAVIOR.md) §5 — it no longer needs to wait.

## Relationship to the Jack & Jill agent-builder skill

Not a competing standard — a persona/scaffolding layer that generates a different set of files:

| File | What it is | Overlap |
|---|---|---|
| `SOUL.md` | personality, voice, signature phrases | none — pure persona |
| `AGENTS.md` | operating manual: triggers, permissions, escalation | this is runtime instruction content, the exact thing a `BEHAVIOR.md` is **not** |
| `MEMORY.md` | durable cross-session knowledge | adjacent to our `atelier-learnings` / lessons pattern |
| `BOOTSTRAP.md` | one-time first-run orientation | no equivalent here |

Worth borrowing: their "specific over generic" quality bar when authoring spec bodies, which is
structurally the same complaint the standard's own quality criteria make about vague specs.
Not worth adopting: a parallel Q&A flow — `agent-prd`, `agent-design` and `atelier-learnings`
already cover this ground.

`BOOTSTRAP.md` — a first-run-only orientation file, archived once the agent is configured — is a
genuine gap here and a legitimate small addition later. Noted, not scoped.

## What M1 leaves open

- **Root vs. nested** `.agents/` placement, where a repo already has an `.agents/skills/`
  convention under an app directory.
- **Sign-off on the judgement calls** in each spec — what counts as a violation, what "material"
  means for a spend threshold — from whoever owns the code being graded.
- **The one-trajectory question**, which M1 does not raise: a single run can produce more than
  one trajectory, and a judge needs one. See [`../BEHAVIOR.md`](../BEHAVIOR.md) §8.
