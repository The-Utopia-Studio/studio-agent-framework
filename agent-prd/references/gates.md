> Apply the current [pipeline contract](../../agent-structure/references/pipeline.md) first. It defines the proportional evidence profile and manifest handoff; historical examples below do not override it.

## Gate 0 — Triage

Two answers here change every question that follows. Get them first.

**Ask:**

1. In one sentence, what job does this agent do?
2. Roughly how long does one run take, and does it need to survive a crash or a
   restart partway through?
3. Is the output something code can check (tests pass, endpoint returns 200, schema
   validates), something only judgement can assess (design, tone, strategy), or both?
4. Is this a new agent, a rebuild, or a stage added to an existing pipeline?

**Then classify and say the classification out loud so it can be corrected:**

**Complexity tier**
- **Tier A** — one job, under roughly ten steps, completes inside a single request. A framework loop is fine. Do not build a harness.
- **Tier B** — multi-stage, human gates, minutes to hours, must survive restarts. Own the loop; put it on a durable event log.
- **Tier C** — quality is subjective and must measurably improve over time. Requires Tier B plus an eval suite before anything else.

**Topology** — pick the simplest that fits:
- **Single loop** — one agent, one context, tools in a cycle. The right answer most of the time.
- **Pipeline / staged** — fixed sequence, deterministic transitions, human gates.
- **Orchestrator–worker** — lead agent delegates to subagents with their own context windows. Only for breadth-first work where total information exceeds one window. Costs 3–10× a single agent.
- **Parallel fan-out** — independent chunks or racing candidates, merged at the end.
- **Graph / node** — typed state, conditional edges, checkpoints, cycles. Only when there are genuinely multiple specialised roles, real branching on content, and state outliving a run.

**Push back if they reach for multi-agent or graph orchestration by default.** Ask
what specifically fails with one agent in a loop. If the answer is "it feels like it
should be several agents", record Single loop and revisit later. Multi-agent is
documented as *less effective* for tightly interdependent work — anything where the
outputs must cohere with each other rather than merely be collected.

### Implementation surface

**Ask this before anything else in the interview, because it can end the interview.**

Most "I want to build an agent" requests are misclassified one or two rungs too high.
Work down the ladder and stop at the first rung that does the job:

| Rung | What it is | Build time | Right when |
|---|---|---|---|
| **1. A skill** | A markdown file of instructions, invoked in chat | Hours | The work is a repeatable procedure a person triggers |
| **2. A project** | Instructions plus reference files, shared with a team | Hours | Same, plus shared context and consistency across people |
| **3. Managed agent surface** | Chat plus connectors plus scheduled runs — no code | Days | It must run on a cadence, read and write real systems, and a person reviews output |
| **4. Coded agent** | Own loop, durable execution, event log, eval suite | Weeks | Output feeds another system automatically, or volume/reliability demands are real |

**Ask:**

1. Does a person trigger each run, or must it fire on its own?
2. Does it only need to *read* other systems, or also *write* to them?
3. Does its output go to a human who reviews it, or straight into another system?
4. How many runs per week?
5. What does "I can't set it up" currently mean in practice — you can't scope it, you
   can't get it access, or the output isn't reliable enough to trust?

**The two questions that genuinely push work from days to weeks** are unattended
scheduling and write access. Reading is nearly free. Writing is where auth,
permissions and idempotency live, and it is usually most of the build.

**If rung 3 or below fits, say so plainly and stop.** Do not produce a full engineering
PRD for something that is a skill plus a scheduled task. Produce a short version:
Gates 0, 1, 1B, 2 and 8, plus a setup checklist. Tell the user which gates you are skipping
and why. Volunteering that someone needs less than they asked for is the most valuable
thing this skill can do.

**Verify capability before designing around it.** For any managed surface, confirm what
the connectors actually do — specifically whether each one can *write* as well as read —
before the design assumes it. A design that assumes write access it does not have fails
at the last step, after all the work.

**Record:** tier, topology, implementation surface, runtime home, talk surface, tool identity, one-sentence job, and the reason for
each choice.

After the rung is named, apply `learnings` and Appendix C. Do not invent a stack.
Authoring (Cursor / Claude Code) is not the runtime. Ask runtime home and talk surface separately (HOME-1).
Ladder defaults down (HOME-2). Fast-pass still reports (REPORT-1).

---

## Gate 1 — The job

**Ask:**

1. What is the single input? Name the exact object, file, or record, and list its
   required fields.
2. What is the single output? Name the exact artifact — a JSON shape, N files, a
   score, a verdict, a document.
3. Name at least three things this agent explicitly does **not** do.
4. What happens downstream if it gets this wrong — and how bad is that? Wasted tokens
   and a retry, a broken build, a founder seeing something embarrassing, or actual
   harm?
5. **If a human has to act on the output — what happens on the next run if they
   didn't?** Does the agent re-propose the same thing as if it were new?

**Reject if:** the input or output cannot be described without the words "context",
"relevant", "appropriate", or "etc."

**Why 3 matters:** the out-of-scope list becomes the forbid list in the system prompt
and is the main defence against scope creep in the output. "Not an APM, not a log
aggregator, not a Datadog replacement" is a good one.

**Why 4 matters:** severity sets how strict validation has to be. Do not let someone
build lightweight validation around a high-severity failure mode.

**Why 5 matters:** this is where idempotency lives when the durability gate is skipped.
Any design where the agent proposes and a human applies has a gap between the two, and
the agent's deduplication usually checks the *destination* — which the human hasn't
updated yet. Two skipped cycles and the same items arrive three times, and the person
reconciles by hand. The fix is usually cheap: have the agent read its own prior output
and say "previously proposed on <date>, not yet applied" rather than re-proposing.

**Record:** input contract, output contract, non-goals, failure severity, behaviour on
unacted output.

---

## Gate 1B — The run sequence (agent checklist)

**Required at every tier and every rung. Never skip this one.**

**Audience and data profile.** Record one: `internal-team`, `fellow-scoped`, `public`, or `privileged-admin`. This is separate from runtime home. Every PRD must name the authenticated/tool principal, allowed data classes, tool allowlist, audit-log route, undeclared-tool refusal, out-of-scope-data refusal, and secret-free-output eval. Add cross-tenant denial for `fellow-scoped`; add break-glass approval proof for `privileged-admin`. A manifest field records these requirements, but deployed authorization must derive identity and tenant server-side—not from model output.

This is the section people who do not build agents actually read. Everything else in
the PRD describes properties of the system; this describes what happens, in order, and
where a human comes in. When the engineering gates are skipped for a low-rung build,
this gate is doing their job.

**Ask:**

1. Walk me through one complete run, step by step, from what starts it to what ends it.
2. For each step, what triggers it — a schedule, the previous step finishing, a person,
   or something happening in another system?
3. For each step, does it run automatically or does it pause for a human?
4. For each pause: who exactly, and what are they deciding or supplying?
5. Are there steps with no ordering dependency between them — things that could run in
   either order or at the same time?

**Reject if:** a step is a property rather than an event. "It understands the brief" is
not a step. "Reads the brief and writes a validated spec" is. Every step must be
something an observer could watch happen and say afterwards whether it did.

**Enforce these:**

**Every pause names a person and a decision.** "Human review" is not a step — "Jaelene
reviews the drafted rows and pastes the ones she wants" is. A pause with no named
person is an unowned step, which in practice means it never happens.

**The last step produces the output named in Gate 1.** If the sequence ends somewhere
else, either the sequence is incomplete or the output contract is wrong. Say which.

**Count the pauses out loud.** Sequences with no pauses are fully unattended and need
the failure-reporting question answered hard. Sequences with a pause at every step are
not agents, they are a checklist with extra steps — say so.

**Ask what happens if a pause never resolves.** A person who does not respond is the
most common way a multi-step agent stalls silently.

**Record it as this table**, which is the studio's standard format — keep these four
columns and this order:

| # | Step | Trigger | Auto / Pause |
|---|---|---|---|
| 1 | Weekly task fires | Schedule — Mondays | Auto |
| 2 | Check whether this is a scan week | Step 1 | Auto — exits early if not |
| 3 | Read the source list and search the web | Step 2 | Auto |
| 4 | Deduplicate against the tracker | Step 3 | Auto |
| 5 | Review the drafted rows and paste the wanted ones | Step 4 | **Pause — Jaelene** |

Where the design has several distinct jobs rather than one sequence, produce one table
per job with the job name as a heading. Do not merge them into a single table; the
whole value of this view is that a reader can follow one run at a time.

---

## Gate 2 — Success and the first ten eval tasks

**This is the gate people skip and the one that pays for the whole document.** Do not
let it be deferred. Without it, every later section is unverifiable opinion.

**Ask:**

1. Describe one run that would count as clearly good. Be specific enough that two
   people would independently agree it passed.
2. Describe one that would clearly fail, and name the exact failure signature.
3. What are the last three outputs you rejected from something similar, and why?
4. What is the single input that stresses this agent hardest? (The awkward archetype,
   the sparse brief, the edge-case tenant.)

**Then build the task bank with them.** Aim for ten now, twenty within the week.
Sources, in order of value:

- Bugs already fixed in the predecessor system. Each one is a regression test.
- The manual checks they already run before calling something done.
- Support or Slack complaints, if the thing has users.
- Cases where the behaviour should **not** fire. One-sided evals produce one-sided
  agents — if you only test that it searches when it should, you get something that
  searches for everything.

**For each task capture:**

```
id:        short-slug
input:     the exact input, or a path to it
expect:    what a pass looks like, concretely
graders:   deterministic | model-rubric | human
severity:  blocker | major | minor
```

**Then split the graders:**

- **Deterministic** — build succeeds, types check, schema validates, required routes exist, a specific value appears in the output, no banned import present. Free, fast, objective. Use wherever it is possible at all.
- **Model rubric** — for subjective dimensions. One judge per dimension, not one judge scoring everything. Needs calibration against a human.
- **Human** — occasional spot checks to calibrate the model graders. Name the person.

**Say this explicitly if they resist:** twenty to fifty tasks drawn from real failures
is a strong start — hundreds are not needed. Early on each change has a large,
obvious effect, so small samples are enough to see it. And evals get harder to write
the longer you wait: right now the requirements translate directly into test cases;
later you are reverse-engineering criteria from a live system.

**Record:** ten or more eval tasks with graders, the stress input, and the definition
of a pass.

---

## Gate 3 — The loop

**Ask:**

1. Which loop pattern is this? (Offer the options in Appendix B.)
2. What closes the loop — what specific condition means "done"?
3. What is the ceiling: steps, tokens, wall-clock, cost per run?
4. What happens when the ceiling is hit before "done"? Who is told, and what state is
   the artifact left in?
5. If scores stop improving but nothing has failed, what then?

**The hard rule to enforce here:** a healthy loop needs **at least one verifiable or
threshold condition, plus at least one budget or stall condition.** Four kinds exist:

- **Verifiable** — a test passes, the build succeeds. Cheapest and most trustworthy.
- **Threshold** — every graded criterion clears its bar. For subjective work.
- **Budget** — step, token, or time ceiling. A safety net, not a success condition.
- **Stall** — no improvement across N rounds; stop and escalate rather than spend more.

**Reject "cap it at N rounds then accept the best attempt."** That is a timeout
wearing a success condition's clothes. `maxSteps` in an SDK is the same thing: a
runaway guard, not a definition of done.

**Also ask, if the loop iterates on quality:** should the generator be allowed to
*abandon* its current direction and try something different, or only refine? For
subjective work, instruct it to decide after each evaluation — refine if scores are
trending, pivot if they are not.

**Record:** loop pattern, exit conditions (all applicable kinds), budgets, escalation
path, pivot policy.

---

## Gate 4 — Evaluation design

Skip only if every grader in Gate 2 is deterministic.

**Ask:**

1. What are the three to five criteria the output is graded on?
2. Which of those is the model already good at by default, and which is it bad at?
3. What is the hard threshold for each — the score below which the round fails?
4. Does the evaluator look at the **rendered artifact** or at the code that produced
   it?
5. Who calibrates the evaluator, and against what examples?

**Enforce these:**

**The generator never grades itself.** Agents confidently praise their own mediocre
work, worst of all on subjective tasks where no test exists. A skeptical standalone
evaluator is far more tractable to tune than a self-critical generator. If the design
has one agent doing both, flag it as a defect in the PRD.

**Weight the criteria toward what the model is bad at.** Competence dimensions —
technical correctness, basic craft — tend to come free. The failure mode is usually
blandness or genericness, so weight the criteria that catch it.

**Give the evaluator eyes.** If the artifact is visual or interactive, the evaluator
must navigate the real thing — a deployed URL, a running app — not read the source.
Bugs that survive review are almost always ones nobody actually looked at.

**Calibrate with few-shot examples and score breakdowns**, or scores will drift
between runs and diverge from the user's taste.

**Record:** criteria with weights and thresholds, evaluator access method, calibration
examples and owner.

---

## Gate 5 — State, durability and human gates

Skip for Tier A. Mandatory for Tier B and C.

**Ask:**

1. What is the event schema? What gets appended, and when?
2. Where is the artifact saved, and at what point in the run?
3. What happens if the process dies at each stage — can it resume, or does it restart?
4. Which steps are automatic and which require a person?
5. What is the timeout budget, step by step, with a worst-case total?
6. Does any step mutate an earlier record?
7. For an unattended run, which event records `duration_ms`, a prevented action
   (`blocked`, `blocked_by`), and the preflight verdict before work starts?

**Enforce these:**

**Save before the expensive step, not after.** If the artifact is written after the
critic runs, a critic failure or a timeout destroys the work. Save immediately after
validation; everything downstream is optional because the artifact already exists.

**Resume, do not restart.** The loop should read the last event and continue. This is
only possible if the durable log lives outside the process running the loop — which is
also what makes crash recovery, eval transcripts, and observability free.

**Humans are high-latency tools.** A review gate is a structured tool call that
suspends the loop, not a special case in the orchestrator. Ask specifically whether
the pause must happen *between tool selection and tool invocation* — that is the
granularity approval actually needs, and most orchestrators cannot do it.

**Never mutate a prior attempt's record.** A retry creates a new row pointing back at
the old one.

**Steps must be idempotent.** A durable engine will retry them. Ask what happens if
step 4 runs twice — if the answer is "it pushes to GitHub twice", that is a bug
waiting for a bad network day.

**Every state transition needs a matching exit in both the success path and the catch
path**, or runs get stuck in "running" forever.

**Map the worst case.** Sum the step estimates at the 95th percentile, not the median
— model latency can be three times its median. If the worst case approaches the
platform ceiling, the run must be split across invocations.

**Record:** event schema, save points, resume behaviour per stage, timeout table with
worst case, auto vs human map, idempotency notes. For background work, include
`duration_ms`, `blocked`, `blocked_by`, and a `precondition_checked` event; those facts cannot
be reconstructed honestly from an error string after the run.

---

## Gate 6 — Context and authority

**Ask:**

1. What is preloaded into every call, and what is pulled on demand via tools?
2. For each significant decision the agent makes, what is the single source of truth,
   and what is the fallback if it is absent?
3. Where in the prompt could the agent read an example and treat it as an instruction?
4. What is the context budget, and what is the assembled size at the largest
   realistic input?
5. What is available but must be excluded?

**Build the authority table with them.** One row per decision type:

| Decision | Source of truth | Fallback if absent |
|---|---|---|
| e.g. fonts | brief.visualSystem.typography | archetype default table |

**Then hunt authority gaps.** Every concrete example, table, or named value placed
after a "use the source of truth" rule is a place the model may confirm the example
instead of reading the source. Each fallback block must be gated in the prompt:

```
Only if [source field] is absent, use the following.
If [source field] is present, use it exactly. These fill gaps; they do not override.
Priority: [source 1] → [source 2] → these rules → defaults.
```

**Enforce the preload/pull split.** Preload only the small invariant core. Everything
else — skills, reference docs, brand material, prior artifacts — should be a tool
call. Context is a finite attention budget, and recall degrades measurably as the
window fills. Anything held across every iteration of a loop is paid for on every
iteration.

**Verify sources are actually populated.** Do not assume a field has a value because
the schema says it should. Ask for a validation step that checks critical fields are
present, non-empty, not truncated, and not sentinel values before the run starts, and
that asserts the value actually landed in the assembled prompt.

**Record:** authority table, identified gaps and their gating text, context budget
table, exclusion list, pre-run field validation.

---

## Gate 7 — Memory

Walk the four tiers explicitly. Most memory problems are category errors — four
different things called "memory", stuffed into one store, and injected into every
prompt.

**Ask, per tier:**

1. **Working context** — what is assembled per call? (Curated, never accumulated.)
2. **Episodic** — what does the event log record, and who reads it back?
3. **Semantic** — what durable facts and decisions persist, scoped to what tenant?
4. **Procedural** — what learned how-to persists: patterns that worked, banned
   phrasings, composition plans?

**Then:**

5. What must the agent **not** remember? (Raw transcripts, superseded versions, prior
   prompt revisions, anything that creates contradictions.)
6. How does something enter semantic memory — only from human decisions, or also from
   the agent's own outcomes?
7. How does memory get read: retrieved by relevance, or injected wholesale?
8. What happens when two entries contradict each other?

**Enforce these:**

**Retrieve, do not inject.** Give each stage a search tool over memory rather than
preloading all of it, with a fixed token allowance filled by relevance. If the
allowance overflows, the ranking is wrong — do not raise the ceiling.

**Append only, with provenance.** Never rewrite or delete. Corrections supersede. Each
entry carries source, timestamp, and what it affects. An agent-inferred entry must
never outrank a human decision.

**Write the diff before applying a human edit**, so a later regeneration cannot
silently revert it.

**Capture failures, not only successes.** A memory layer that records only what worked
cannot stop the agent repeating a mistake, and knowing what to abandon is most of the
value.

**Structured entries, not prose blobs.** Prose cannot be deduplicated, superseded, or
audited. If memory is refined over time, refinement must emit small identified deltas
merged deterministically — never a full rewrite of the whole blob, which erodes detail
run over run.

**Never compress the playbook to save tokens.** Shrinking retained content is how
domain insight gets lost. Retrieve less; do not compress what you keep.

**Every memory table keys off the tenant id, indexed.** Never a freeform name string.

**Record:** the four tiers with store, lifetime and read path for each; write rules;
exclusion list; contradiction policy.

---

## Gate 8 — Tools and integrations

**Ask:**

1. List every tool the agent can call, with one line on what each does.
2. For each pair that seems close: could a competent engineer say with certainty which
   one applies in a given situation?
3. What external APIs are involved, and what are their rate limits and failure modes?
4. What secrets are needed, and where do they live?
5. What does the agent read from and write to — repos, buckets, databases?
6. What happens when a credential is missing or expired?
7. **What scheduling, trigger and approval primitives does the target platform actually
   offer** — and does this design assume any that don't exist?

**Enforce these:**

**Verify primitives, don't assume them.** This is the most common cause of a plan that
survives review and fails on the day someone builds it. Check the real options before
the design depends on them:

- **Cadences.** Platforms offer a fixed menu — typically hourly, daily, weekly, weekdays,
  manual. Fortnightly, monthly, quarterly and "N days before X" usually are *not* on it.
  A design specifying an unavailable cadence needs the workaround written down: run at
  the nearest available frequency and have the prompt check the date and exit early,
  anchored to a fixed reference date so it doesn't drift.
- **Triggers.** Most connectors have no event triggers at all — nothing fires when a row
  changes or a file lands. If the design says "when X happens", confirm that's possible
  or convert it to a poll.
- **Write access per connector, not per product.** A connector that reads a system does
  not necessarily write to it, and the gap is rarely documented where you'd look. Check
  the specific operation the design needs — append a row, update a cell, send as this
  identity — not just whether the integration exists.
- **Approval mechanisms.** If a human gate is in the design, find the actual mechanism.
  Some platforms have one built in; on others it means a person triggers the next step.
- **Identity.** Which account does this run as, and does everything it needs live on that
  account? Notes, recordings and files are often scoped to the user who created them, not
  the workspace — which can change *who* invokes a job, not just how.

**Fewer tools, unambiguously scoped.** Bloated tool sets with overlapping purposes are
one of the most common failure modes. If a human cannot definitively pick the right
tool, the agent cannot either. Merge or rename.

**Tool output must be token-efficient.** A tool that returns a 40KB blob poisons the
context for every subsequent turn.

**Errors get compacted back into context**, not thrown into a crash. The agent should
see a summarised failure and be able to self-heal.

**Cap fan-out in code, not in a prompt.** No recursive spawning, a bounded branch
count, and a per-run cost ceiling enforced by the orchestrator. Asking a model nicely
not to spawn subagents is not a control.

**Record:** tool inventory, ambiguity resolutions, rate limits, secret locations,
credential failure behaviour, fan-out and cost caps, and the platform-primitive
verification with any workarounds it forced.

---

## Gate 9 — Guardrails and known killers

**Ask:**

1. What patterns in the output break the build or the deploy?
2. What are the five most likely hallucinations for this specific task?
3. What is the cost of catching each class of issue late rather than early?
4. What must never be written or modified by this agent?
5. Is there a tenancy boundary, and how is it enforced?

**Build the validator checklist.** Every entry must be a specific string or structural
check, never a guideline:

```
CHECK:  the exact pattern to look for
IN:     which files or fields
THROW:  the exact error message
```

**The error message is part of the fix.** "Invalid file" tells the model nothing and
produces the same mistake three times. "Invalid Hero.tsx: ref callback returns a
value. Change `ref={(el) => el && (x = el)}` to `ref={(el) => { if (el) x = el; }}`"
tells it exactly what to do.

**Deterministic before judgement, always.** Structural and syntactic checks belong in
the validator, which is free. Design, brand, and content checks belong in the
evaluator, which is not. Never mix them: a validator doing taste is brittle, and an
evaluator doing syntax is expensive.

**Record:** validator checklist with actionable messages, hallucination watch list,
protected files, tenancy enforcement, escalation cost table.

---

## Hard gates before the PRD is written

Do not produce the document until all of these are true. If one cannot be satisfied,
write the PRD anyway but put the unmet gate at the very top of Open Questions,
flagged as blocking.

- [ ] Input and output are each described in one unambiguous sentence with concrete fields
- [ ] At least three non-goals are listed
- [ ] The run-sequence table exists, every pause names a person, and the last step produces the Gate 1 output
- [ ] The run-sequence and systems-map diagrams exist and are rendered images where the environment allows
- [ ] The stage-3 eval contract meets the selected evidence profile in the pipeline contract. Record provisional evidence honestly; do not apply the full production case count to low-risk skill prototypes
- [ ] At least one grader is deterministic
- [ ] The loop has a verifiable or threshold exit condition, not only a ceiling
- [ ] A budget or stall condition exists, with a named escalation path
- [ ] For Tier B/C: the durable state store is named and the resume behaviour is defined per stage
- [ ] For Tier B/C: the save point is before the most expensive step
- [ ] Every decision type has a named source of truth
- [ ] All four memory tiers are addressed, even if the answer is "not used"
- [ ] The generator and the evaluator are separate
- [ ] Every "I don't know" is in Open Questions with an owner
- [ ] **HOME-1:** Runtime home (OS / Vercel / local) AND talk surface (OS UI / Slack / schedule / CLI) both named
- [ ] **ID-1:** Tool identity named (studio shared Composio / team shared / fellow / service API)
- [ ] **STATE-1 / LOOP-2:** For Tier B/C, kill-and-fresh-process resume from Convex log only — vendor state file is not required
- [ ] **HORIZON-7:** For unattended Tier B/C, the event contract contains duration, blocked-action,
      and preflight facts so behaviour can be graded from the canonical trajectory
- [ ] **CTX-2 / CTX-2b:** Context route named (pull on demand; prefetch-into-log only if already known)
- [ ] **REPORT-1:** Fast-pass still contains home, surface, identity, and any blocker — not a silent complete
- [ ] **Ship-out:** GitHub path (or OS library id) for code/skills/prompts
- [ ] Load `learnings` and cite any waived rule IDs in Open Questions

---

