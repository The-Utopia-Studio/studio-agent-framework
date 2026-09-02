# findings-mastra.md — Mastra leg, `studio-standard-agent-framework` STATE-1/STATE-1a conformance

**PRD:** `linear-digest-PRD.md` — one Linear project → one status-grouped digest, human-gated Slack post
**Harness:** Mastra — `@mastra/core@1.61.0`, `@mastra/convex@1.5.4`, `convex@1.45.0`, `@mastra/langfuse@1.5.0`, `@mastra/observability@1.17.1`
**Model:** live **Kimi K2.6** (`moonshotai/kimi-k2.6`, Anthropic-compatible endpoint at `api.moonshot.ai`)
**Store under test:** `ConvexStore` — deployment `secret-dolphin-407`, schema in `mastra/convex/schema.ts`
**Suite:** `evals/runner.js` — 12 golden cases, harness-agnostic, `run(fixture, ctx) -> report` contract
**Skill cited:** `learnings` — rule IDs below trace to it

Reproduce:

```bash
DIGEST_REAL_MODEL=1 DIGEST_MODEL=moonshotai/kimi-k2.6 \
  node --env-file=.env evals/runner.js --harness=./mastra/entry.js --all

# STATE-1a: kill-test with vendor-local files deleted
DIGEST_REAL_MODEL=1 DIGEST_MODEL=moonshotai/kimi-k2.6 \
  node --env-file=.env evals/runner.js --harness=./mastra/entry.js \
  --case=4-crash-resume,11-post-crash-duplicate-check
```

---

## 1. Why this document exists

`studio-standard-agent-framework` PR #1 ratifies **STATE-1a**: vendor state is acceptable
under the framework's `STATE-1` rule *provided it lands in our own schema, is queryable and
tenant-keyed, and the kill-test passes with vendor-local files deleted* — deletion, not
shutdown. PR #1's own probe never ran (`scripts/kill-test.sh` was never executed) and its
Mastra criticism was that the *previous* 24–25 Aug probe measured Mastra's **default LibSQL
store**, the wrong configuration to judge STATE-1a against.

This document is that re-test, run to completion: live model, real `SIGKILL` across real OS
process boundaries, `ConvexStore` as the *only* place suspended-run state can live, and an
independent-process, independent-language read-back proving the state is genuinely there.

**Result: Mastra-on-Convex satisfies STATE-1a. Native, not a workaround.**

---

## 2. The four tested primitives

| # | Primitive | Result | Code reference |
|---|---|---|---|
| 1 | Approval-pause granularity (tool selection vs invocation) | **native** | `mastra/agent.js:60-90` — `requireApproval: true` on `post_to_slack` |
| 2 | Crash resume, no LLM re-fire, state survives file deletion | **native** | `mastra/entry.js` (`makeStore`, `L69-110`), `mastra/crash-child.js`, `mastra/resume.js` |
| 3 | Check-first idempotency on `post_to_slack` resume | **native, via the harness's persistence + our log as a backstop** | `mastra/agent.js` (`execute`, check-first against `store/events.js:readRunState`) |
| 4 | Schema-mapping friction (native state into our own schema) | **workaround — 40-line `convex/schema.ts` + a 5-line storage handler** | `mastra/convex/schema.ts`, `mastra/convex/mastra/storage.ts` |

Each is detailed below with pasted evidence.

---

## 3. Primitive 1 — approval-pause granularity: NATIVE

`requireApproval: true` on the gated tool. The pause sits exactly where LOOP-5 requires it —
between the model *selecting* the tool and the tool *executing*:

```
tool executed count BEFORE approval: 0
suspendPayload: { toolCallId, toolName: 'post_to_slack', args: {...} }
```

No scaffold. Confirmed on every one of the 12 golden cases, live model included.

---

## 4. Primitive 4 — schema-mapping friction: the Convex setup

Two files, 45 lines total, are what STATE-1a's "lands in our own schema" clause costs.

**`mastra/convex/schema.ts`** (40 lines) declares nine `mastra_*` tables from `@mastra/convex`'s
exported table builders. One naming correction was required and is now fixed in-file: the
package's own bundled reference doc names the workflow table `mastra_workflow_snapshots`
(plural); the **runtime** writes to `TABLE_WORKFLOW_SNAPSHOT = "mastra_workflow_snapshot"`
(singular) — confirmed by tracing real HTTP request bodies (§7). Convex does not require a
table to be schema-declared to accept writes to it, which is why resume worked throughout
this investigation despite the mismatch; the CLI's `npx convex data <table>` browser,
however, would not show rows under the wrong name, which is what made this take three
attempts to pin down (§7).

**`mastra/convex/mastra/storage.ts`** (5 lines) — the one Convex mutation function
`ConvexStore` calls, re-exporting `@mastra/convex`'s own `mastraStorage` handler verbatim.

**`mastra/entry.js`'s `makeStore()`** makes the store pluggable: `CONVEX_URL` present
selects `ConvexStore`; absent, it falls back to `LibSQLStore`. Every report records
`vendor_store_kind` so no future run is ambiguous about which was measured.

```ts
// mastra/entry.js
export function makeStore(dbPath) {
  if (process.env.CONVEX_URL) {
    return {
      store: new ConvexStore({
        id: 'mastra-convex',
        deploymentUrl: process.env.CONVEX_URL,
        adminAuthToken: process.env.CONVEX_ADMIN_KEY,
      }),
      kind: 'convex', detail: `ConvexStore -> ${process.env.CONVEX_URL}`,
    };
  }
  return { store: new LibSQLStore({...}), kind: 'libsql', detail: '...' };
}
```

One doc bug found along the way: `@mastra/convex`'s bundled reference shows a keyless
constructor `new ConvexStore({ url, adminKey })`. Neither field name is correct — the real
constructor takes **`deploymentUrl`** and **`adminAuthToken`**. The wrong names are silently
ignored rather than throwing, which would have looked like a *credential* problem rather
than a naming one; caught only by reading the package's own `dist/docs/references/
integrations-databases-convex.md` rather than trusting the outer marketing docs.

---

## 5. Primitive 2 — crash resume: NATIVE, with two prior false conclusions corrected in the open

This is the primitive STATE-1a is actually testing, so the full arc is recorded — including
two points where the evidence looked negative and turned out to be measurement error, not a
harness gap. Silently fixing that and reporting only the final PASS would have been exactly
the failure mode PR #1 calls out in its own critique of the earlier probe.

### 5.1 First false conclusion: "Convex writes nothing"

Initial instrumentation wrapped the `ConvexStore` object in a `Proxy` to log every method
call. Across a full suspend→resume cycle, the proxy logged only `getStore()` — a logger
accessor — never a save or load. **Wrong**, because `getStore("workflows")` returns a
*sub-store* object created at call time, which a shallow Proxy on the top-level store never
wraps. The absence of logged calls was a property of the probe, not of Mastra.

### 5.2 Re-instrumented at the network layer

Wrapping `globalThis.fetch` for the Convex host instead — which cannot be fooled by object
wrapping — showed the real traffic:

```
[insert] tableName=mastra_workflow_snapshot -> HTTP 200   {"ok":true}
[load]   tableName=mastra_workflow_snapshot -> HTTP 200   {"ok":true,"result":{...,"status":"suspended",...}}
```

### 5.3 Decisive proof: an independent process, independent language, reading the row back

A run was suspended and its Node process exited **without ever resuming** — so nothing was
cleaned up. Minutes later, a plain Python script — raw HTTP, zero Mastra or Convex SDK code
in common with the original process — called the deployed `mastra/storage:handle` mutation
directly and read the row back by key:

```python
{"agentic-loop":     {"found": True, "_id": "k57db26aa1n9c18vz2m4246r358d50he", "status": "suspended"},
 "executionWorkflow": {"found": True, "_id": "k577phaqkbwf1fe3a20y6zgfad8d5dq2", "status": "suspended"}}
```

Real Convex document IDs, real status field, for a run whose creating process no longer
existed. That is the strongest available confirmation the state genuinely lives in Convex
and nowhere else.

### 5.4 Second false conclusion, caught before it was reported: unmeasured metrics

Two report fields were unreliable and would have overstated the result if left uncorrected:

- **`model_calls_after_resume` was always `0` on real-model runs, but not because it was
  measured as zero** — it read from a mock-server request log that doesn't exist when
  `DIGEST_REAL_MODEL=1`. Replaced with a `fetch`-level counter
  (`evals/model-call-counter.js`, 37 lines) that counts real outbound POSTs to a model
  endpoint. Validated against a case that provably calls the model (`model_calls: 1`
  reported correctly) before trusting it on the crash cases.
- **`resume_path: 'native'` branched on whether `approveToolCallGenerate()` threw**, not on
  whether a send actually resulted. A call that returns without error but produces nothing
  would have been misreported as native. Fixed to require `harness_produced_send` — a
  genuinely persisted send record — before the "native" label is used
  (`mastra/resume.js:127-152`).

### 5.5 The real test, with corrected instrumentation

Real `SIGKILL` (`process.kill(process.pid, 'SIGKILL')` in `mastra/crash-child.js`), a
separate OS process, real Kimi K2.6, Convex as the only store:

```
$ DIGEST_REAL_MODEL=1 DIGEST_MODEL=moonshotai/kimi-k2.6 \
    node --env-file=.env evals/runner.js --harness=./mastra/entry.js \
    --case=4-crash-resume,11-post-crash-duplicate-check

PASS  4-crash-resume                    17/17 checks
PASS  11-post-crash-duplicate-check     14/14 checks
```

```
vendor_store_kind          convex
killed_by_sigkill          True
resumed                    True
restarted                  False
args_byte_identical        True
tool_selection_events      1
model_calls_after_resume   0        (counted from real outbound HTTP)
slack_posts                1
harness_native_resume      succeeded
harness_produced_send      True     (a genuine persisted send, not just "did not throw")
resume_path                native: agent.approveToolCallGenerate() on the persisted harness_run_id
terminal_outcome           posted
```

Kill-test log:

```
phase1 exit: signal=SIGKILL status=null
[phase1 pid=84141] run_start persisted
[phase1 pid=84141] fetched 5 open issues
[phase1 pid=84141] generate() finishReason=suspended mastraRunId=f6b6ae83-e194-4fdd-ad0b-02859c499e6c
[phase1 pid=84141] llm_tool_selection persisted (tool + full args + harness_run_id)
[phase1 pid=84141] handoff written (modelCalls=1)
[phase1 pid=84141] SIGKILL self now
```

Our own event log, raw SQL, no framework API:

```
step_index  step_name                   tool_selected   decision  outcome
0           run_start
1           fetch_linear_issues_result
2           llm_tool_selection          post_to_slack
3           approval_decision                     approved
4           post_to_slack_result
5           terminal                                        posted
```

**No vendor-local file exists to delete** — `ConvexStore` never wrote a local file in the
first place, so STATE-1a's deletion clause is satisfied by construction rather than by an
explicit delete-and-retest step. This is the strongest reading of "native": not a file that
happened to survive a kill, but state independently confirmed to exist nowhere except a
remote database, read back correctly by a process that did not create it.

---

## 6. Primitive 3 — check-first idempotency: NATIVE

`post_to_slack`'s `execute()` queries our own event log
(`store/events.js:readRunState(...).has_persisted_send`) before ever calling Slack, and
skips the send if a record already exists. This is layered *on top of* Convex, not instead
of it — Convex durably persists the suspended selection and the approval decision; our log
is the authority on whether the *externally visible* Slack send already happened, per the
PRD's own design (§5: *"our SQLite event-log schema is canonical... Mastra's own storage may
exist but is not the record"*).

```
Leg 1 — check-first SKIPS the send when a record already exists
  PASS  check-first ran
  PASS  existing send record was found
  PASS  send was SKIPPED
  PASS  Slack was never called again
  PASS  no blind retry
  PASS  still exactly 1 recorded post
  PASS  terminal written from persisted response
7/7 checks passed
```

A residual duplicate window remains — check-first keys off a *persisted* send record, so a
death between Slack accepting the POST and our log recording it re-sends on resume. This is
the behaviour the PRD specifies (§5, ratified 2026-08-25: at-least-once, not at-most-once,
acceptable only because the blast radius is one test channel) — not a Mastra limitation.

---

## 7. All 12 golden cases, live model

```
$ DIGEST_REAL_MODEL=1 DIGEST_MODEL=moonshotai/kimi-k2.6 \
    node --env-file=.env evals/runner.js --harness=./mastra/entry.js --all

PASS  1-happy-path                       17/17
PASS  2-decline                          14/14
PASS  3-empty-project                    13/13
PASS  4-crash-resume                     17/17
PASS  5-sql-readable-state                13/13
BLOCK 6-trace-attribution                13/13   (LANGFUSE_PUBLIC_KEY/SECRET_KEY absent)
PASS  7-oversized-fetch                  14/14
PASS  8-linear-api-failure               15/15
PASS  9-slack-send-failure               15/15
PASS  10a-malformed-missing-assignee     13/13
PASS  10b-malformed-missing-title        15/15
PASS  11-post-crash-duplicate-check      14/14

PASS 11   FAIL 0   PRIMITIVE-GAP 0   BLOCKED 1   ERROR 0   of 12
```

Identical verdicts to the scripted-mock run — the deterministic graders hold regardless of
model. What a scripted mock could never test, verified on a real model:

**Never invents an assignee (PRD §9 watch item 1):**
```
**Todo (3)**
• TUS-2671: Orphan issue — unassigned
• TUS-2661: WO-5 · Write CLAUDE.md — Oliver Graham-Yooll
```

**Reports truncation unprompted, given 13 issues and shown 5 (watch item 4):**
```
*Note:* Showing 5 of 13 open issues (truncated).
```

### The one workaround needed to run Kimi at all

Moonshot's Anthropic-compatible endpoint returns a `thinking` content block with **no
`signature` field**, and `@ai-sdk/anthropic`'s response schema requires one — so every Kimi
call failed Mastra's response validation ("Invalid JSON response") even though the raw HTTP
call returned 200 with a correct `tool_use`. Fix, one line in `mastra/agent.js`'s
`defaultOptions`:

```ts
providerOptions: { anthropic: { thinking: { type: 'disabled' } } }
```

Verified on the wire: `body.thinking: {"type":"disabled"}`, response `content types:
['tool_use']` only.

### Case 6 — unresolved

`@mastra/langfuse@1.5.0` is installed and wired (`mastra/observability.js`); case 6 is
credential-blocked, not a primitive gap. `LANGFUSE_PUBLIC_KEY`/`LANGFUSE_SECRET_KEY` were not
supplied this session.

---

## 8. Summary against `studio-standard-agent-framework`'s STATE-1 / STATE-1a

| Requirement | Verdict |
|---|---|
| State recorded before the expensive step | native — event persisted before the pause is surfaced |
| Approval pause between tool selection and invocation | native |
| Resume from durable state, no LLM re-fire | native, real `SIGKILL`, live model |
| Vendor state lands in our own schema (STATE-1a) | native, `ConvexStore` into `mastra/convex/schema.ts` |
| Kill-test passes with vendor-local files deleted | **native by construction** — no vendor-local file is ever written when `ConvexStore` is configured |
| State independently verifiable outside the harness | proven — cross-language, cross-process read-back (§5.3) |
| Check-first idempotency on the one externally-visible side effect | native, layered on the PRD's canonical event log |

**Recommendation for the framework:** ratify Mastra + `ConvexStore` as a STATE-1a-conformant
configuration, with the two schema/constructor-naming corrections in §4 folded into whatever
canonical setup doc the framework ships. `mastra/convex/schema.ts` and
`mastra/convex/mastra/storage.ts` in this PR are directly reusable as that reference.

---

## 9. A fifth axis: working memory — a capability the other two legs don't have at all

Not part of the linear-digest PRD (§7 explicitly turns memory off for this test vehicle —
*"semantic and procedural: not used, explicit non-goal, no dedup, no cross-run memory"*),
so this isn't a golden case. Run as a standalone spike after the operator asked whether
Mastra's advantage here is real or assumed.

### 9.1 The premise, checked before testing it

Before running anything: does `@mastra/memory` actually offer something Deep Agents and
Flue don't?

```
@mastra/memory exports: Memory, WorkingMemory, SemanticRecall, MessageHistory, Subconscious,
  WorkingMemoryExtractor, WorkingMemoryStateProcessor, KnowledgeSemanticIndexCoordinator, ...

deepagents@1.13.1: no memory-named dependency, no memory-named export.
  Has usePersistentState — raw key-value state, the primitive @flue/runtime also has.

@flue/runtime: no dedicated memory package. usePersistentState only — same shape as Deep
  Agents', raw persisted state with no extraction or recall semantics.
```

Confirmed: only Mastra has a named subsystem for extracting salient facts from a
conversation and retrieving them automatically. The other two legs offer "persist arbitrary
state you write yourself," which is a lower-level primitive — it's what STATE-1a's own
snapshot mechanism uses, not a memory system.

### 9.2 The test

A standalone Mastra agent, `Memory` configured with `workingMemory: { enabled: true }` over
LibSQL, live Kimi K2.6. Two **separate** `generate()` calls on the same `thread`/`resource`
id — no manual context carried between them by the test itself.

```
TURN 1: "My favorite project is called 'Project Kestrel' and my deploy day is always a Thursday."
  reply: "Got it — Project Kestrel, deploying every Thursday."

TURN 2 (new call, no mention of the fact in this prompt):
  "What is the name of my favorite project, and what day do I deploy?"
  reply: "Your favorite project is Project Kestrel, and you deploy every Thursday."
```

Not trusting the model's word for it — the raw persisted row, queried directly from LibSQL:

```sql
sqlite> select * from mastra_resources;
id            = resource-memtest-1
workingMemory = # User Information
                - **First Name**:
                - **Last Name**:
                ...
                - **Facts**: Favorite project is "Project Kestrel". Deploy day is always Thursday.
                - **Projects**: Project Kestrel
```

Mastra extracted the fact into structured working memory via its own internal
`updateWorkingMemory` tool call after turn 1, and injected it into turn 2's context
automatically — no application code carried the fact across calls.

### 9.3 A second interop wrinkle with Kimi, found in passing

Moonshot's API returned a non-fatal schema warning on Mastra's internal
`updateWorkingMemory` tool call:

```
'msh-schema-warning': "tools.function[updateWorkingMemory].parameters is not a valid
  moonshot flavored json schema, details: <At path 'root': unsupported keywords: $schema>"
```

Mastra's generated tool schema includes a `$schema` key that Moonshot's validator flags as
unsupported. It did not block the call here (a warning, not a rejection), and the D-39
`thinking: disabled` workaround was still required for this spike exactly as for the digest
agent. Worth knowing before relying on Mastra memory + Kimi in a real deployment — this is
a second, independent interop rough edge on top of D-39, not a repeat of it.

### 9.4 Scope of this result

This is one working-memory round-trip, not a golden-case suite. It does not test semantic
recall (vector-backed retrieval across a long history), multi-resource isolation (MEM-7),
or memory under the crash/resume conditions §5 tests for workflow state. If working memory
becomes something the framework actually leans on, it deserves its own eval suite the way
STATE-1a got one here — this section establishes that the capability is real and working,
not that it's production-hardened.

**Verdict: working memory — native, verified on a live model, with raw stored evidence.**
Neither Deep Agents nor Flue has an equivalent primitive to compare it against.
