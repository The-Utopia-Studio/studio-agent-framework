# Agent PRD — linear-digest

**Status:** Draft
**Tier:** A (labeled) — with Tier-B-grade durability requirements grafted on, deliberately. See Gate 0 override below.
**Topology:** Single loop, human-gated pause
**Owner:** Haniyah Umair
**Date:** 2026-08-25
**Supersedes:** —

**Context:** Test vehicle for The Studio's harness bake-off. Leg 1 of 3 — this PRD is
re-implemented unchanged on Claude Agent SDK and Deep Agents. Tool logic must be
portable plain functions so the same functions can be reused across all three legs;
only the harness wiring differs.

---

## 0. Surface-ladder override (recorded, not applied)

| | Organic ladder verdict | Chosen |
|---|---|---|
| Implementation surface | **Rung 3** — managed surface (Cowork/connectors + scheduled run + human review would deliver this job as specified) | **Rung 4 — coded**, deliberate override |
| Complexity tier | A — one job, <10 steps, single request | A, labeled, with a Tier-B durability requirement (crash-resume, no LLM re-fire, check-first idempotency) grafted on for the bake-off |
| Topology | Single loop | Single loop, human-gated pause |

**Reason for the override:** the job itself is intentionally simple. Task simplicity
is a control variable so the bake-off measures *harness* behavior — approval-pause
granularity, crash resume, storage escape hatches, trace attribution — rather than
task complexity. Building this at the rung the job actually warrants (3) would give
nothing to compare across Mastra, Claude Agent SDK, and Deep Agents.

**Gate 4 (evaluation design) note:** every grader in the Gate 2 task bank below is
deterministic — counts, string checks, SQL-readable state, byte-comparison of
persisted vs. presented args, trace field presence. Per the framework's own rule
("skip only if every grader is deterministic"), Gate 4 collapses: there is no
separate weighted rubric. Gate 2's deterministic graders **are** the evaluation
design. No digest-quality rubric was requested and none is added — see Open
Question 3.

---

## 1. Job

**One sentence:** Reads open issues from one Linear project and posts one
status-grouped digest to Slack, with human approval gating the post.

**Input:** a Linear project ID. `fetch_linear_issues` returns at most 5 open
issues, each with exactly: `id`, `title`, `status`, `assignee`, `updatedAt`. No
other fields are fetched.

**Output:**
- Primary: one Slack message to `#agent-test` (via webhook), grouped by status,
  2–3 lines per group.
- Secondary, written on **every** run regardless of outcome: a local JSON record
  — `{ run_id, digest_text | null, slack_response | null, outcome, approver,
  timestamp }` — written outside the framework's own storage.

**Non-goals:**
- No scheduling — manual trigger only
- No dedup across runs
- No multi-project support
- No Linear writes
- No Slack edits or deletes

**Failure severity:** Low blast radius — test channel, fully reversible. Validation
*strictness* is high regardless, because the golden cases double as harness-
comparison probes across three SDKs. Every check is a hard pass/fail even though
the downstream consequence of a wrong post is trivial.

**If a human must act on the output:** not applicable. Non-goals explicitly
exclude scheduling and dedup, so every invocation is a fully independent, manually
triggered run with no cross-run reproposal logic. A prior decline or approval has
no bearing on a later run against the same project.

---

## 1B. Run sequence — agent checklist

| # | Step | Trigger | Auto / Pause |
|---|---|---|---|
| 1 | Operator manually triggers the run | Person | Auto (starts run) |
| 2 | `fetch_linear_issues(project_id)` → up to 5 open issues | Step 1 | Auto |
| 3 | Check issue count; if 0, branch to the empty path | Step 2 | Auto (decision) |
| 4 | LLM drafts digest text and selects `post_to_slack` with full args | Step 3 (yes branch) | Auto |
| 5 | **Persist the selected tool call (name + full args) to SQLite** — before the pause | Step 4 | Auto — critical save point |
| 6 | **PAUSE** — approver reviews the full persisted args, byte-identical to what was saved | Step 5 | **Pause** |
| 7a | Approve → resume-safe check for an existing send record → `post_to_slack` executes if none found → persist Slack response immediately on receipt | Step 6 (approve) | Auto |
| 7b | Decline → no execution, terminal state `declined` | Step 6 (decline) | Auto |
| 7c | (from step 3) Empty → terminal state `nothing-to-digest` | Step 3 (no branch) | Auto |
| 7d | Step budget (10) exhausted before any terminal state → terminal state `budget-exhausted` | Any time | Auto |
| 8 | Write local JSON record + append Langfuse trace entry with git sha | Any terminal state | Auto |
| 9 | Run ends; report emitted unconditionally — never silent | Step 8 | Auto |

**Pauses:** 1 — the approval gate between tool selection and tool invocation.
**Owner:** Haniyah Umair, or the day's designated test operator acting as her
delegate. Approver identity is recorded per-run in the local JSON record.
**If a pause never resolves:** out of scope for this test vehicle — approval wait
is unbounded human latency, explicitly excluded from the run-duration budget.
The run must remain resumable indefinitely at that point; nothing expires a
pending approval.

![Run sequence](run-sequence.png)

![Systems map](systems-map.png)

---

## 2. Success and evals

**A good run looks like:** exactly one of **five** terminal states is reached
(`posted` / `declined` / `nothing-to-digest` / `budget-exhausted` / `failed`), each
independently and deterministically checkable, with a written JSON record and a
Langfuse trace carrying a git sha, in ≤10 steps.

**Ratified 2026-08-25 (leg 1, finding D-02).** This list originally named four states.
Cases 8, 9 and 10b each require a clean failure recorded *distinctly from* `declined`,
and none of the four fits — leaving only a silent exit or a mislabelled decline, both
hard failures. `failed` is therefore a first-class terminal state, carrying a
`failure_stage` discriminator of `fetch` | `validation` | `post` (CTX-3: a typed
contract with no silent defaults; packing two facts into `outcome` would be exactly the
silent default CTX-3 forbids). All three legs implement five states.

**A failed run looks like:** a silent exit, a duplicate Slack post, the LLM
re-invoked after a resume, a byte-mismatch between persisted and presented
approval args, or the step ceiling exceeded without a `budget-exhausted` report.

**Stress input:** the crash-mid-run cases (4 and 11) combined with boundary
input (oversized fetch, malformed issue fields).

### Task bank

| id | input | expect | graders | severity |
|---|---|---|---|---|
| 1-happy-path | 5 open issues | 1 approval pause with full args visible → approve → exactly 1 Slack post | deterministic | blocker |
| 2-decline | approval offered | decline → 0 posts, terminal `declined` cleanly recorded | deterministic | blocker |
| 3-empty-project | 0 open issues | no approval pause offered; terminal `nothing-to-digest` reported | deterministic | blocker |
| 4-crash-resume | SIGKILL after fetch, before approval | fresh process resumes (not restarts); LLM not re-invoked; ≤1 post; resumed approval args byte-identical to persisted args | deterministic | blocker |
| 5-sql-readable-state | any run | run state readable via raw SQL against the store, no framework API required | deterministic | major |
| 6-trace-attribution | any run | Langfuse trace for the run carries a git sha | deterministic | major |
| 7-oversized-fetch | Linear project has >5 open issues | agent truncates to 5; truncation explicitly reported, never silent | deterministic | major |
| 8-linear-api-failure | `fetch_linear_issues` errors or times out | no approval pause ever offered; clean failure report; 0 posts | deterministic | blocker |
| 9-slack-send-failure | approval granted; Slack webhook returns non-2xx | failure recorded distinctly from `declined`, in both JSON record and trace | deterministic | major |
| 10a-malformed-missing-assignee | one issue has no assignee | digest renders "unassigned" deterministically; run proceeds normally | deterministic | minor |
| 10b-malformed-missing-title | one issue has no title | fetch validation fails; clean report; 0 posts | deterministic | blocker |
| 11-post-crash-duplicate-check | process dies after approval granted, before Slack response confirmed/persisted | resume checks local state for a persisted send record before re-posting (check-first, not blind retry). A harness that can only blindly retry fails this case — recorded as a per-harness primitive-gap finding, not a spec change | deterministic | blocker |

### Graders

**Deterministic:** all 12 cases above — counts, presence/absence checks, SQL query
results, trace field checks, byte-comparison of args, report-string checks.
**Model rubric:** none. Digest phrasing/readability is explicitly out of scope for
grading (see Open Question 3).
**Human:** occasional informal spot-check of digest phrasing by Haniyah Umair —
not gating, not part of the pass/fail suite.

**Where the suite runs:** a fixed script executed identically against each of the
three harness legs (Mastra → Claude Agent SDK → Deep Agents), against shared
mock Linear/Slack fixtures.

---

## 3. Loop

**Pattern:** human-gated tool loop. The pause sits between tool *selection* and
tool *invocation* — the granularity this bake-off is specifically testing.

**Exit conditions:**
- **Verifiable:** reaching exactly one of five terminal states — `posted`,
  `declined`, `nothing-to-digest`, `budget-exhausted`, `failed` (with a
  `failure_stage` of `fetch` | `validation` | `post`) — each independently
  checkable. See the D-02 ratification note in §2.
- **Threshold:** not applicable — no subjective grading (Gate 4 collapsed).
- **Budget:** 10 steps, hard ceiling, enforced in code. Approval wait itself is
  excluded from the step/time budget (human latency).
- **Stall:** not applicable — the task is too short and deterministic for a stall
  condition; `budget-exhausted` covers the "ran out of steps" case.

**On ceiling hit:** terminal state `budget-exhausted` — reported to the operator,
run state left SQL-readable, never silent.

**Pivot policy:** not applicable — no generator/evaluator iteration; a single
deterministic attempt per run.

---

## 4. Evaluation design

Collapsed. All 12 Gate 2 tasks are deterministic; per the framework's rule, no
separate weighted rubric is built.

| Criterion | Weight | Threshold | Graded by |
|---|---|---|---|
| — | — | — | — (deterministic checks in §2 constitute the evaluation) |

**Evaluator access:** not applicable — no rendered artifact requires judgment;
state is read directly via SQL, the JSON record, and the Langfuse trace.
**Calibration:** not applicable.
**Separation:** not applicable — no generator/evaluator split needed since there
is no subjective grading. Noted explicitly rather than left blank.

---

## 5. State and durability

**Event schema:** appended per step — `{ run_id, step_index, step_name,
timestamp, tool_selected | null, tool_args | null, approver | null, decision |
null (approved/declined), slack_response | null, outcome | null (set only on the
terminal event), git_sha }`.

**Durable store:** SQLite, one common schema (WO-2), **identical across all
three legs** — raw-SQL-readable, no framework-proprietary API required (golden
case 5). This schema is the sole source of truth for run state. A harness's own
native persistence (e.g. Mastra's LibSQL-backed tables) may coexist, but it is
never authoritative and the probes never query it. Each leg's build includes
mapping its native state model into this common schema — how much friction that
mapping produces is itself recorded evidence, not incidental overhead (§6, §12).

**Save point:** immediately upon LLM tool-selection (name + full args), **before**
the approval pause — this is the step-5 save point in §1B, and it precedes the
most consequential step (the actual Slack send). A second save point sits
immediately upon receipt of the Slack response (success or failure), before any
further processing.

### Timeout budget (confirmed 2026-08-25)

| Step | p50 | p95 | Notes |
|---|---|---|---|
| `fetch_linear_issues` | 2s | 10s | operator ceiling |
| LLM draft + tool selection | 15s | 60s | operator ceiling |
| Persist selection to SQLite | <100ms | 1s | local write |
| Approval wait | — | unbounded | excluded from run-duration budget, per operator |
| `post_to_slack` | 2s | 10s | operator ceiling |
| Persist Slack response | <100ms | 1s | local write |
| JSON record + Langfuse trace write | <200ms | 2s | local write + network |

**Worst case total (excluding approval wait):** ≈ 84s at p95. Comfortably inside
any reasonable platform ceiling.

### Recovery

| Stage | If it dies here | Resume or restart |
|---|---|---|
| Before fetch | No state yet | Restart — nothing to resume |
| After fetch, before LLM selection | Issues only in working context, not persisted | Restart — re-fetch is cheap and side-effect-free |
| After LLM selection persisted, before approval | Tool call + args durable | **Resume** — read persisted selection, do not re-invoke the LLM (case 4) |
| After approval granted, before Slack response persisted | Approval decision durable; send outcome unknown | **Resume** — check for a persisted send record first; send only if none exists (case 11) |
| After Slack response persisted | Terminal outcome not yet written | **Resume** — write terminal outcome + JSON record + trace from the persisted response; do not re-send |
| After terminal outcome written | Run complete | — |

### Auto vs human

**Automatic:** fetch, LLM draft/selection, all persistence, Slack send, JSON
record, trace write.
**Human gate:** the single approval pause between tool selection and invocation.

**Idempotency:** `post_to_slack` is the only step with an externally visible
effect. Resume behavior is **check-first**: query local state for an existing
persisted send record before calling Slack again. A harness that can only blindly
retry (no check-first primitive) fails golden case 11, and that failure is itself
a recorded finding for that harness — not grounds to change the spec.

**Residual duplicate window — documented 2026-08-25 (leg 1, case 11).** Check-first keys
off a *persisted* send record. There is therefore a window that check-first cannot close:
if the process dies after Slack accepts the POST but before `post_to_slack_result` is
appended, a resume finds no record and sends again — one duplicate message in the channel,
still one row in the event log. This is the behavior this section specifies ("send only if
none exists"), so all three legs implement it as written; leg 1 confirmed it empirically.

The guarantee is therefore **at-least-once, not at-most-once**, and that is acceptable
*only* because the blast radius is one test channel (§1 failure severity).

**Before this design reaches a production channel, a pre-send intent record is required:**
append a `post_to_slack_attempt` event carrying the tool args *before* calling Slack, and
extend check-first so that finding an attempt with no result means "outcome unknown — do
not re-send". That converts the guarantee to at-most-once, at the cost of a new
unknown-outcome terminal state. Not implemented here, deliberately, because it would
change the spec the three legs are being compared against (LOOP-6: a durable engine WILL
retry steps; the retry must never double-execute a side effect).

---

## 6. Context and authority

### Authority table

| Decision | Source of truth | Fallback if absent |
|---|---|---|
| Which issues to include | `fetch_linear_issues` response (id/title/status/assignee/updatedAt) | none — a failed fetch is a clean failure, no fallback data |
| Grouping key for the digest | `issue.status`, verbatim from Linear | none |
| Approver identity | recorded per-run in the local JSON record at approval time | Haniyah Umair, default |
| Max issues per run | hard-coded 5 | none — overflow is truncated and explicitly reported (case 7) |
| Run state representation | the common WO-2 SQLite schema, identical across all 3 legs | none — a harness's own native store (e.g. Mastra's LibSQL tables) may exist alongside but is never read by the probes |

### Context budget

| Item | Size | Preloaded or pulled | Priority |
|---|---|---|---|
| System prompt (role, output format, non-goals) | small, fixed | preloaded | required |
| Up to 5 issues (5 short fields each) | small, bounded | pulled (tool result) | required |
| Prior run history | none | excluded | — |

**Assembled total at largest realistic input:** trivially small. Not a
meaningful constraint for this test vehicle.

**Excluded despite being available:** the full Linear issue payload (description,
comments, labels, etc.) — only the five named fields are ever fetched, by design
(§1 input contract).

**Pre-run field validation:** every fetched issue must have non-empty `id`,
`title`, `status`. A missing `assignee` is tolerated and rendered "unassigned"
(case 10a). A missing `title` fails validation (case 10b).

---

## 7. Memory

| Tier | What it holds | Store | Lifetime | Read path |
|---|---|---|---|---|
| Working context | current run's fetched issues + drafted digest | in-process | one call | assembled per call |
| Episodic | full event log per §5 schema | SQLite | forever, per run | positional read on resume; raw SQL for inspection |
| Semantic | not used | — | — | — |
| Procedural | not used | — | — | — |

**Write rules:** append-only event log; a resume never rewrites a prior event, it
appends new ones.
**Contradiction policy:** not applicable — semantic/procedural are unused, so
there are no cross-run facts to contradict.
**Never remembered:** no cross-run memory of prior declines or approvals against
the same project — explicit non-goal, no dedup.
**Tenancy:** `resource=utopia-studio`, `thread=digest-test` — a single fixed scope
for this bake-off. Not designed for multi-tenant use (multi-project is explicitly
out of scope).

---

## 8. Tools and integrations

| Tool | Does | Returns | Notes |
|---|---|---|---|
| `fetch_linear_issues` | Reads up to 5 open issues from one Linear project | `{id, title, status, assignee, updatedAt}[]` | Read-only, no approval gate |
| `post_to_slack` | Posts one grouped digest message to `#agent-test` via webhook | Slack API response | `requireApproval: true` — pause sits between tool selection and invocation |

**Ambiguity check:** only two tools, unambiguous — one read, one gated write,
clearly named.
**External APIs:** Linear API (standard rate limits — not a concern at 1 project,
≤5 issues per run); Slack incoming webhook (standard limits, one message per run).
**Secrets:** direct API keys — a Linear personal API key and a Slack webhook URL —
held as environment variables on the runtime executing the harness, not via a
shared Composio identity. This is a deliberate choice so tool identity stays
portable across all three SDK legs.
**Credential failure behaviour:** a missing or expired key produces a clean
failure report at the fetch or post step (cases 8/9) — never a silent exit.
**Fan-out and cost caps:** not applicable — single loop, no sub-agents, 10-step
hard ceiling enforced in code, not just prompted.

**Platform-primitive verification:** not applicable in the scheduling/trigger
sense — manual trigger only, scheduling is an explicit non-goal. The one
primitive genuinely under test is the approval mechanism: each of the three
harnesses must support pausing between tool selection and tool invocation with
the selected args visible. A harness that cannot express that granularity is
itself a bake-off finding.

---

## 9. Guardrails

### Validator checklist

```
CHECK:  post_to_slack args persisted to SQLite match the args presented at approval, byte-for-byte
IN:     approval payload vs. event log
THROW:  "Approval payload drift: presented args do not match persisted tool_args for run <run_id>"

CHECK:  exactly one Slack send recorded per run
IN:     event log post_to_slack outcomes
THROW:  "Duplicate send detected for run <run_id>: found <n> Slack POSTs, expected <=1"

CHECK:  LLM invoked exactly once per run (no re-fire on resume)
IN:     event log LLM-call events
THROW:  "LLM re-invoked on resume for run <run_id>: expected exactly 1 tool-selection event"

CHECK:  every issue object has non-empty id, title, status
IN:     fetch_linear_issues response
THROW:  "Malformed issue in fetch response: missing <field> - failing run per Gate 6 validation"

CHECK:  run reaches exactly one of {posted, declined, nothing-to-digest, budget-exhausted, failed}
IN:     final event log state
THROW:  "Run <run_id> ended without a recorded terminal state - silent exit is a hard failure"

CHECK:  a `failed` outcome carries a failure_stage of fetch | validation | post
IN:     terminal event
THROW:  "Run <run_id> recorded outcome=failed with no failure_stage - a failure must be
        distinguishable from a decline and from the other failure stages"
```

**Hallucination watch list:**
1. Inventing an assignee name when the field is absent (must render "unassigned", not a guess)
2. Fabricating a Slack response payload when the send actually failed
3. Re-drafting the digest text on resume instead of reading the persisted decision
4. Treating a truncated fetch (>5 issues) as the complete set, silently
5. Reporting `nothing-to-digest` when the fetch actually failed — masking a failure as an empty result

**Protected paths:** none — this test vehicle has no Linear-write or Slack-edit
tool at all (§1 non-goals); nothing outside the one Slack channel and the local
SQLite store is reachable.

**Escalation cost:** validator (free, deterministic) → evaluator (not
applicable, Gate 4 collapsed) → harness-comparison report (the actual deliverable
of the bake-off) → production (not applicable — test vehicle only).

---

## 10. Build order

**Before any code:** all 12 eval tasks written (this PRD), event schema defined
(§5), SQLite schema drafted for this leg.

**First milestone:** the rung-4 equivalent of a naked baseline — golden case 1
(happy path) passing end-to-end on the Mastra leg with no more scaffolding than
the harness itself requires. This is the number the other two legs are compared
against for *scaffolding overhead*, not output quality — there is no output
quality axis in this PRD (Gate 4 collapsed).

**Then:** durability (cases 4, 11) → tenancy/memory confirmation → findings
write-up → repeat the identical milestone sequence for legs 2 and 3.

**Observability from commit one:** Langfuse tracing; every run's trace carries a
git sha (case 6) — non-negotiable from the first commit, since it is one of the
bake-off's own comparison axes.

**Done means:** all 12 golden cases pass, identically defined, on all three
harness legs — with a named per-harness note on any primitive gap (e.g. a harness
that cannot express check-first resume, §5).

---

## 11. Open questions — resolved 2026-08-25

| # | Question | Resolution |
|---|---|---|
| 1 | Identical schema across legs, or native per SDK? | **Identical.** The WO-2 event-log schema is ours, not the harness's — each leg maps its native state into it. Mastra's own LibSQL tables may exist alongside but are never authoritative and are never queried by the probes. The friction of that mapping is deliberately part of the test: it is recorded evidence for §6 (authority) and §12 (rationale), not incidental build cost. |
| 2 | Timeout defaults in §5 — confirm or override? | **Confirmed as proposed.** No changes to the §5 timeout table. |
| 3 | Does any reviewer grade digest phrasing? | **No.** Confirmed — spot-checks stay informal and non-gating for the entire bake-off. Gate 4 stays collapsed across all three legs. |

**Blocking:** none. All three were refinements, now closed — this PRD is fully
buildable with no outstanding decisions.

---

## 12. Decisions and rationale

| Decision | Chosen | Alternatives considered | Why |
|---|---|---|---|
| Implementation surface | Rung 4 (coded), override | Rung 3 (managed) — the organic ladder verdict | Bake-off tests harness durability/approval-gate primitives directly; task simplicity is a deliberate control variable |
| Tier label | A, with Tier-B-grade durability grafted on | Relabel as Tier B | Operator's explicit framing; recorded as a tension rather than silently reclassified |
| Loop pattern | Human-gated tool loop | Plan–execute–verify | Only one tool call needs gating; a full plan-verify loop is unneeded ceremony for one write |
| Idempotency on `post_to_slack` resume | Check-first | Blind retry (accept duplicates) | Operator specified check-first as the spec; blind retry is an unmet-primitive finding per harness, not an acceptable behavior |
| Gate 4 (evaluation design) | Collapsed — no rubric | Add a digest-quality rubric dimension | All 12 golden cases are deterministic; a rubric would grade something nobody asked to have graded |
| Memory tiers used | Working context + episodic only | Add semantic memory for cross-run dedup | Explicit non-goal — no dedup, no scheduling, no cross-run state |
| Event-log schema | One common schema (WO-2), identical across all 3 legs, authoritative | Per-leg native schema, mapped only at the reporting stage | Forcing each harness to map its native state into an external authoritative schema surfaces primitive-fit friction directly — that friction is Gate 6 evidence, not overhead to minimise |

*Each scaffold component in this design encodes an assumption about what the
harness cannot do on its own. Record the assumption so it can be retested when
the harness (or the model) changes.*
