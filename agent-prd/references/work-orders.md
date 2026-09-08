> Apply the current [pipeline contract](../../agent-structure/references/pipeline.md) first. It defines the proportional evidence profile and manifest handoff; historical examples below do not override it.

## Part two — Work orders

Produce this **only after the PRD clears its hard gates.** Confirm with the user that
the PRD is approved before starting.

**Work orders are required at every rung, including rung 1 and 2.** Do not skip them
because the build has no code. A setup checklist is not work orders — checklists list
prerequisites (get access, chase the account, confirm the format), and the actual
construction ends up compressed into a single line like "create the three jobs". That
line is the entire build, and it has no sequence and no acceptance test. If you find
yourself deciding the checklist covers it, that is the signal to write the orders.

What changes by rung is the *shape*, not the discipline:

| Rung | Orders look like | Still required |
|---|---|---|
| 1–2 (skill, project) | Write the instructions, assemble reference files, test on real cases | One concern each, acceptance test each |
| 3 (managed surface) | Configure connectors, write prompts, hand-run, then schedule | Same |
| 4 (coded) | Contracts, baseline, durability, evaluator, memory | Same |

### Refusal rule

If a gate is unmet, do not write work orders. Say which gate, why it blocks, and offer
to close it. Specifically:

| Missing | Why work orders are impossible |
|---|---|
| Eval tasks | No acceptance tests, so no work order can be verified |
| Exit conditions | The loop milestone has no definition of done |
| Event schema / save points | The durability milestone cannot be specified |
| Thresholds on criteria | The evaluator milestone has no pass bar |
| Tool inventory | Integration orders cannot be scoped or sequenced |

Note that a rung-3 PRD legitimately skips several of those gates. Skipped gates remove
the *milestones that depended on them* — they do not remove the requirement for orders.

### Two rules that make work orders useful rather than decorative

**1. Every work order carries a runnable acceptance test.** No test, no work order.
"Set up the research engine" is not a task. "Research engine returns at least twenty
deduplicated signals for the sparse-input stress case, each with a source URL — test at
`evals/research.test.ts`" is a task. The test comes from the PRD's task bank, so if a
work order has no test, either the bank is thin or the order is not real work.

For non-coded rungs, the test is an observable outcome rather than a command — "the
pasted row lands in the correct cells with no rearranging", "fire on demand and the mail
arrives at every address on the list". **"It's configured" is not an acceptance test.**

**2. Milestones enforce the build order, they do not restate the product roadmap.**
A product roadmap is ordered by feature value. A build order is ordered by what makes
the next step verifiable. These are different sequences and conflating them is why
scaffolding gets built before there is any way to tell whether it helps.

### Milestone spine — coded builds (rung 4)

Adapt the contents, keep the sequence and the exits.

| # | Milestone | Exit condition |
|---|---|---|
| **M0** | Contracts and evals | The suite runs and **fails honestly**. Input/output types exist. Event schema defined. |
| **M1** | Naked baseline | One model call, minimal prompt, no scaffolding, best model. A recorded score everything later must beat. |
| **M2** | Durability | Process killed mid-run; it resumes rather than restarting. Artifact survives. Exact harness pins and the lockfile are committed. |
| **M3** | Evaluator | Output and behaviour evaluators run over the canonical event stream; thresholds enforced; no unconditional pass. |
| **M4** | Memory | Tiers live, retrieval budgeted, tenancy tested adversarially. |
| **M5** | Learning loop | Outcomes feed the playbook. Only after M0–M4 hold. |

Tier A stops at M1. Tier B runs M0–M4. Only Tier C reaches M5.

**M0 and M1 are the two people skip and the two that matter most.** M0 is skipped
because writing tests before code feels backwards. M1 is skipped because it feels like
throwaway work — but without a naked baseline, nobody can ever say whether the prompt
scaffolding, the retrieval layer or the critic earned its place, and every one of them
becomes permanent by default.

### Milestone spine — skills, projects and managed surfaces (rungs 1–3)

| # | Milestone | Exit condition |
|---|---|---|
| **S0** | Unblock | Every input the build needs exists and is reachable from the account that will run it. |
| **S1** | Dry run | Each job has been run **by hand** and produced output worth automating. |
| **S2** | Schedule and wire | Jobs run unattended and report every time, including clean runs. |
| **S3** | Supervised cycle and handover | One full cycle with no intervention, and the owner can change it unaided. |

**S1 is the equivalent of M1 and gets skipped for the same reason** — hand-running feels
like a rehearsal rather than work. But scheduling an unproven prompt just delivers
mediocre output on a cadence, and the longer the interval the longer that takes to
surface. At fortnightly, two months.

**S3 is the milestone nobody writes down.** If the person who will own the process cannot
edit the prompt, change the criteria, pause a job, or interpret a failure report without
the builder, then the handover did not happen and the builder is now permanent
infrastructure. This needs its own order with its own acceptance test — *the owner makes
a real change unaided* — not a line in a summary.

**Unattended jobs need an unconditional report.** Silence on success is how scheduled
work dies: a broken schedule goes unnoticed until someone happens to need the output, and
a zero-result run is indistinguishable from a run that never fired. One line per run
costs nothing.

### Work order format

Each order is one session, one concern. If it cannot be described in one sentence, it
is too large — split it.

```markdown
### WO-<n> · <short title>

**Milestone:** M<n>
**PRD section:** §<n> <name>
**Depends on:** WO-<n>, WO-<n>
**Size:** one session | half day | full day

**Do:** <one sentence, imperative>

**Scope:**
- <specific, checkable>
- <specific, checkable>

**Out of scope:** <what a keen agent might do and must not>

**Acceptance test:**
```
<command to run, or the exact check>
Expected: <observable result>
```

**Files touched:** <paths, or "new">
**Do not touch:** <protected paths from PRD §9>
```

### Sequencing rules

- **Dependencies are explicit.** Any order that can start immediately is marked so; the
  rest name what they wait on.
- **One concern per order.** Multi-concern sessions produce interleaved changes that are
  hard to review, hard to revert, and tend to introduce new bugs while fixing old ones.
- **Every order ends in a commit** with a one-line description. If the change cannot be
  described in one line, the scope was too large.
- **Types clean before commit.** Whatever the local equivalent is — run it, and make it
  part of the acceptance test rather than a hope.
- **Protected paths carry forward** from PRD §9 into every order's "do not touch".
- **Order within a milestone by what unblocks the most**, not by what is most
  interesting.
- **If someone other than the builder will own this**, the final order is that person
  making a real change unaided. Not a walkthrough, not documentation — a change.

### WORKORDERS.md template

````markdown
# Work Orders — <Agent Name>

**PRD:** `<path>` (approved <date>)
**Tier:** A | B | C
**Surface:** skill | project | managed | coded

## Ready now

<WO ids with no unmet dependencies>

## Blocked

| WO | Waiting on |
|---|---|

## Milestones

*Use the M-spine for coded builds, the S-spine for skills, projects and managed surfaces.*

### M0 — Contracts and evals
**Exit:** the eval suite runs and fails honestly.

<work orders>

### M1 — Naked baseline
**Exit:** <recorded baseline score> — the number scaffolding must beat.

<work orders>

<...M2–M5, or S0–S3, as applicable...>

## Deferred

| Item | Why deferred | Revisit when |
|---|---|---|

## Standing rules for every session

- Read the PRD and any repo rules file first
- One concern per session
- Acceptance test passes before the order is closed
- Commit with a one-line description (coded builds)
- Do not touch: <protected paths>
- <any invariant from the PRD that must hold on every order — e.g. never writes to X, field Y always blank>
````

---

## Worked fragment

The fidelity to aim for. This is Gate 2 and Gate 3 for a design critic, abbreviated.

> **Input:** `{ deployUrl: string, brief: FinalBrief, archetype: Archetype }` — brief
> must contain non-empty `visualSystem.palette` and `visualSystem.typography`.
>
> **Output:** `{ verdict: "pass" | "fail", scores: Record<Criterion, number>,
> findings: Finding[] }` where every `fail` carries at least one finding with a file
> or selector reference.
>
> **Non-goals:** does not fix anything, does not touch the repo, does not judge copy
> accuracy against the PRD.
>
> **Failure severity:** a false pass reaches a founder. Strict.
>
> **Task bank (extract):**
>
> | id | input | expect | graders | severity |
> |---|---|---|---|---|
> | about-page-mockups | Grove deploy, CONSUMER_HEALTH | fails with a finding naming the mockup component on /about | deterministic + rubric | blocker |
> | archetype-sameness | Grove and Meridian deploys | flags structural similarity above threshold | rubric | blocker |
> | clean-pass | reference site known good | passes with no blocker findings | deterministic | major |
> | palette-drift | brief palette vs rendered CSS | fails when hero background is not in the brief palette | deterministic | major |
>
> **Loop:** generator–evaluator. Exit on **threshold** — all four criteria at or above
> bar. **Budget** — 3 rounds or $2.00. **Stall** — if the aggregate score moves less
> than 3 points between rounds, stop and escalate to the design lead with the best
> attempt attached. No unconditional accept.

---

