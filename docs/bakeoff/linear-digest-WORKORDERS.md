# Work Orders — linear-digest

**PRD:** `linear-digest-PRD.md` / `linear-digest-PRD.docx` (Draft, 2026-08-25)
**Tier:** A (labeled), with Tier-B-grade durability requirements
**Surface:** Rung 4 — coded (deliberate override; organic ladder verdict is rung 3)
**Leg:** 1 of 3 — Mastra. Tool functions must stay plain/portable for legs 2 (Claude Agent SDK) and 3 (Deep Agents).

## Ready now

WO-1, WO-2, WO-3 — no unmet dependencies.

## Blocked

| WO | Waiting on |
|---|---|
| WO-4 | WO-1, WO-2 |
| WO-5 | WO-4 |
| WO-6 | WO-4 |
| WO-7 | WO-6 |
| WO-8 | WO-5, WO-6, WO-7 |
| WO-9 | WO-8 |

## Milestones

*M-spine for a coded (rung 4) build. M3 (evaluator) is explicitly not built — Gate 4 collapsed to deterministic-only in the PRD. M5 (learning loop) is not reached — no subjective quality axis exists to optimise.*

### M0 — Contracts and evals
**Exit:** the eval suite runs against a stub and fails honestly — no errors, clean mismatches.

#### WO-1 · Portable tool functions
**Milestone:** M0
**PRD section:** §8
**Depends on:** none
**Size:** half day

**Do:** Write `fetch_linear_issues` and `post_to_slack` as plain functions with zero harness imports in their bodies.

**Scope:**
- `fetch_linear_issues(project_id)` → `{id, title, status, assignee, updatedAt}[]`, max 5, validates non-empty id/title/status per issue
- `post_to_slack(digest_text)` → Slack API response; takes a webhook URL from env, not from harness config
- Both functions importable and callable outside any Mastra context

**Out of scope:** wiring these into the Mastra tool-call interface — that's WO-4.

**Acceptance test:**
```
node -e "require('./tools/fetch_linear_issues.js')(...)" against a mock Linear fixture
Expected: returns correctly-shaped array; zero imports from '@mastra/*' anywhere in the file
```

**Files touched:** `tools/fetch_linear_issues.js`, `tools/post_to_slack.js` (new)
**Do not touch:** none protected in this PRD (§9 — no protected paths)

---

#### WO-2 · SQLite event log
**Milestone:** M0
**PRD section:** §5
**Depends on:** none
**Size:** half day

**Do:** Define the event-log schema and read/write helpers, raw-SQL-readable.
**This schema is fixed and identical across all 3 legs — do not fork it per-SDK.**

**Scope:**
- Table holding one row per event: `run_id, step_index, step_name, timestamp, tool_selected, tool_args, approver, decision, slack_response, outcome, git_sha`
- `appendEvent(runId, event)` — append-only, never updates a prior row
- `readRunState(runId)` — used by resume logic
- This schema is the sole source of truth for run state on every leg. A harness's own native persistence (e.g. Mastra's LibSQL tables) may exist alongside it, but the probes only ever query this schema — never the harness's native store.

**Out of scope:** any Mastra-specific storage adapter — this must be queryable with plain `sqlite3`. Do not adapt the schema to fit a harness's native shape more comfortably — the friction of mapping native state into this fixed schema is itself a finding (WO-9), not a problem to design away.

**Acceptance test:**
```
sqlite3 test.db "select * from events where run_id = 'test-1'"
Expected: readable rows, correct columns, no framework API required — satisfies case 5
```

**Files touched:** `store/events.js`, `store/schema.sql` (new)
**Do not touch:** none

---

#### WO-3 · Eval fixture set and runner
**Milestone:** M0
**PRD section:** §2
**Depends on:** WO-1
**Size:** one session

**Do:** Encode all 12 golden cases as fixtures (mock Linear responses, mock Slack webhook responses) plus a runner script that can point at any harness leg.

**Scope:**
- One fixture file per case (1, 2, 3, 4, 5, 6, 7, 8, 9, 10a, 10b, 11)
- Runner takes a harness entrypoint as an argument, executes all 12, reports pass/fail per case

**Out of scope:** implementing the harness itself — this runs against a stub for M0.

**Acceptance test:**
```
node runner.js --harness=./stub.js
Expected: all 12 cases report FAIL with a legible mismatch message, zero cases ERROR — "fails honestly"
```

**Files touched:** `evals/fixtures/*.json`, `evals/runner.js` (new)
**Do not touch:** none

---

### M1 — Naked baseline
**Exit:** case 1 (happy path) passes end-to-end on the Mastra leg with no more scaffolding than the harness itself requires. This is the scaffolding-overhead number legs 2 and 3 are compared against.

#### WO-4 · Wire the Mastra harness — happy path
**Milestone:** M1
**PRD section:** §1B, §3
**Depends on:** WO-1, WO-2
**Size:** full day

**Do:** Build the single loop in Mastra: fetch → LLM tool-selection → persist-before-pause → human-gated pause → branch on approve.

**Scope:**
- Mastra tool wrapping around WO-1's plain functions
- `post_to_slack` configured `requireApproval: true`, pause between selection and invocation
- Selected tool call (name + full args) persisted to the WO-2 event log immediately on selection, before the pause is surfaced
- 10-step ceiling enforced in code

**Out of scope:** decline / empty / budget-exhausted paths (WO-5), crash resume (WO-6/7).

**Acceptance test:**
```
evals/runner.js --harness=./mastra/entry.js --case=1-happy-path
Expected: 1 approval pause with full persisted args visible, approve -> exactly 1 Slack post, JSON record + trace written
```

**Files touched:** `mastra/entry.js`, `mastra/agent.js` (new)
**Do not touch:** none

---

#### WO-5 · Remaining terminal-state paths
**Milestone:** M1
**PRD section:** §1, §1B
**Depends on:** WO-4
**Size:** full day

**Do:** Implement `declined`, `nothing-to-digest`, `budget-exhausted`, and the boundary-input cases.

**Scope:**
- Decline path → 0 posts, terminal `declined`
- Empty-project path → no pause offered, terminal `nothing-to-digest`
- Budget-exhausted → 10-step ceiling hit before any terminal state, reported, run state left readable
- Oversized fetch (>5 issues) → truncate to 5, report truncation explicitly
- Linear API failure → clean report, 0 posts, no pause ever offered
- Slack send failure → recorded distinctly from `declined`
- Malformed issue fields: missing assignee → "unassigned"; missing title → validation failure

**Out of scope:** crash/resume behavior (WO-6/7).

**Acceptance test:**
```
evals/runner.js --harness=./mastra/entry.js --case=2-decline,3-empty-project,7-oversized-fetch,8-linear-api-failure,9-slack-send-failure,10a-missing-assignee,10b-missing-title
Expected: all listed cases pass
```

**Files touched:** `mastra/agent.js`
**Do not touch:** none

---

### M2 — Durability
**Exit:** process killed mid-run resumes rather than restarts; artifact survives; no duplicate sends.

#### WO-6 · Crash resume before approval
**Milestone:** M2
**PRD section:** §5
**Depends on:** WO-4
**Size:** full day

**Do:** Implement resume semantics for a kill between tool-selection-persist and approval.

**Scope:**
- On resume, read the persisted tool call from WO-2's event log
- Do not re-invoke the LLM
- Assert the args presented for approval on resume are byte-identical to the persisted args

**Acceptance test:**
```
evals/runner.js --harness=./mastra/entry.js --case=4-crash-resume
Expected: fresh process resumes (not restart); 0 additional LLM calls; <=1 post; byte-identical args assertion holds
```

**Files touched:** `mastra/resume.js` (new)
**Do not touch:** `mastra/agent.js`'s selection logic — resume reads, it does not re-decide

---

#### WO-7 · Check-first idempotency on post
**Milestone:** M2
**PRD section:** §5
**Depends on:** WO-6
**Size:** half day

**Do:** Implement resume semantics for a kill between approval and Slack-response persistence.

**Scope:**
- On resume, query WO-2's event log for an existing persisted send record before calling Slack again
- If found, skip the send and proceed to writing the terminal outcome from the persisted response
- If this harness's replay model cannot express check-first (only blind retry), record that as a named finding in WO-9 rather than forcing a workaround that contradicts the harness's actual primitives

**Acceptance test:**
```
evals/runner.js --harness=./mastra/entry.js --case=11-post-crash-dup-check
Expected: pass (check-first confirmed) or a named FINDING entry if the harness can only blindly retry — either is a valid close for this WO, but a silent duplicate is not
```

**Files touched:** `mastra/resume.js`
**Do not touch:** none

---

### M4 — Memory
**Exit:** tiers live as specified, tenancy holds, validator checklist runs as an automated gate.

*(M3 — evaluator — is not built. Gate 4 collapsed in the PRD: every grader is deterministic, so there is no separate evaluator milestone for this agent.)*

#### WO-8 · Tenancy + automated validator gate
**Milestone:** M4
**PRD section:** §7, §9
**Depends on:** WO-5, WO-6, WO-7
**Size:** half day

**Do:** Confirm tenancy scoping and turn the §9 validator checklist into an automated gate on every suite run, not a manual read-through.

**Scope:**
- Confirm all events are scoped under `resource=utopia-studio, thread=digest-test`
- Automate all 5 validator checks from PRD §9 (args-match, single-send, single-LLM-call, malformed-issue-reject, terminal-state-reached) as assertions the runner executes on every case, not just the happy path
- Regression-test the validator itself: deliberately break one invariant (e.g. force a duplicate send) and confirm the validator catches it

**Acceptance test:**
```
evals/runner.js --harness=./mastra/entry.js --all
Expected: all 12 cases pass or produce a named finding; validator assertions fire on at least one deliberately-broken build
```

**Files touched:** `evals/validators.js` (new), `evals/runner.js`
**Do not touch:** none

---

#### WO-9 · Leg 1 findings write-up
**Milestone:** M4 (closing)
**PRD section:** §8, §12
**Depends on:** WO-8
**Size:** half day

**Do:** Write the Mastra findings summary — which primitives existed natively vs. needed a workaround, with the exact workaround code — as the template for legs 2 and 3.

**Scope:**
- One entry per tested primitive: approval-pause granularity (tool-selection vs. invocation), crash resume (no LLM re-fire), check-first idempotency, **and schema-mapping friction** (how much of Mastra's native state model had to be manually translated into the fixed WO-2 schema vs. falling out naturally)
- For each: "native" or "workaround", and if workaround, the code that implements it
- This document is what legs 2 and 3 get compared against

**Acceptance test:**
```
findings-mastra.md exists, names a result (native | workaround | unmet) for each of the 4 tested primitives, with code references for any workaround
```

**Files touched:** `findings-mastra.md` (new)
**Do not touch:** none

## Deferred

| Item | Why deferred | Revisit when |
|---|---|---|
| M3 — evaluator | Gate 4 collapsed; all graders deterministic | Only if a subjective criterion (e.g. digest phrasing) is added to scope — Open Question 3 |
| M5 — learning loop | No subjective quality axis to optimise; Tier A labeling caps here for that reason | Not expected to apply to this test vehicle |
| Legs 2 (Claude Agent SDK) and 3 (Deep Agents) | Sequential bake-off — this WORKORDERS.md is the template, re-run per leg | After WO-9 closes leg 1 |

## Standing rules for every session

- Read the PRD (`linear-digest-PRD.md`) before starting any WO
- One concern per session
- Acceptance test passes before the order is closed
- Commit with a one-line description
- Do not touch: no protected paths in this PRD (§9) — but never let `post_to_slack` gain edit/delete capability, and never add a Linear-write tool (non-goals, §1)
- Invariant that must hold on every order: the approval pause always sits between tool *selection* and tool *invocation* — never move it earlier (before args exist) or later (after the send)
