# FINDINGS — linear-digest, leg 1 of 3 (Mastra)

**Harness:** Mastra — `@mastra/core@1.61.0`, `@mastra/libsql@1.21.1`, `@mastra/observability@1.17.1`, `@mastra/langfuse@1.5.0`, `zod@4`
**Model:** `openai/gpt-5.6-terra` via Mastra's model router, hitting the OpenAI **Responses API**. No `ai-sdk` package is a direct dependency (see D-06). Originally built on `anthropic/claude-sonnet-4-6`; switched on operator instruction 2026-08-25 (see D-15).
**Runtime:** Node v26.3.0, macOS (darwin 25.5.0)
**Commit at time of suite run:** `9b6dfcb7d2144339af2ef389d215681b9414e8ac`
**PRD:** `linear-digest-PRD.md` (Draft, 2026-08-25) · **Work orders:** `linear-digest-WORKORDERS.md`
**Rules cited from:** `atelier-learnings` skill (`.claude/skills/atelier-learnings/SKILL.md`)

Reproduce:

```bash
node --env-file=.env evals/runner.js --harness=./mastra/entry.js --all
```

---

## 1. Golden-case results

Mock-fixture suite, all 12 PRD §2 task-bank cases. `checks` counts fixture expectations **plus** the
seven §9 validator assertions, which run on every case (WO-8), not just the happy path.

| # | Case | Verdict | Checks | Key evidence |
|---|---|---|---|---|
| 1 | happy-path | **PASS** | 17/17 | 1 pause, args byte-identical, exactly 1 post |
| 2 | decline | **PASS** | 14/14 | 0 posts, terminal `declined` |
| 3 | empty-project | **PASS** | 12/12 | 0 pauses offered, 0 model calls, terminal `nothing-to-digest` |
| 4 | crash-resume | **PASS** | 16/16 | real `SIGKILL`, native resume, 0 model calls after resume |
| 5 | sql-readable-state | **PASS** | 12/12 | raw `sqlite3` read, no framework API |
| 6 | trace-attribution | **BLOCKED-NO-CREDENTIAL** | 12/12 | git sha on 32 real Mastra spans; **no Langfuse trace id** — `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` absent |
| 7 | oversized-fetch | **PASS** | 13/13 | 13 open → 5 used, truncation reported |
| 8 | linear-api-failure | **PASS** | 14/14 | terminal `failed`/`fetch`, 0 pauses, 0 posts |
| 9 | slack-send-failure | **PASS** | 14/14 | terminal `failed`/`post`, distinct from `declined` |
| 10a | missing-assignee | **PASS** | 12/12 | renders `unassigned`, no invented name |
| 10b | missing-title | **PASS** | 14/14 | validation rejection, 0 pauses, 0 posts |
| 11 | post-crash-duplicate-check | **PASS** | 13/13 | check-first, no blind retry, ≤1 post |

```
PASS 11   FAIL 0   PRIMITIVE-GAP 0   BLOCKED 1   ERROR 0   of 12
```

Full raw output: `evidence/full-suite-mock.txt`.

**There are no PRIMITIVE-GAP rows.** Every behaviour the PRD requires turned out to be
expressible in Mastra. Two things that looked like gaps during the build were not — see
D-04 (`stopWhen`) and D-05 (exporter hook name); both were documentation problems, and
both are recorded rather than smoothed over.

---

## 2. Per-case evidence

### Case 1 — happy path · PASS

Intercepted approval payload (Mastra's `suspendPayload`, i.e. exactly what the approver sees):

```json
{
  "toolName": "post_to_slack",
  "toolCallId": "toolu_mock_1",
  "args": {
    "digest_text": "*In Progress*\n- TUS-2670 WO-14 · Handover: Jaelene makes a real change unaided (Haniyah Umair)\n- TUS-2658 WO-2 · Verify connector blast radius matches the design (Haniyah Umair)\n\n*In Review*\n- TUS-2660 WO-4 · Stand up the quarterly meeting date list (Haniyah Umair)\n\n*Todo*\n- TUS-2661 WO-5 · Write CLAUDE.md (Oliver Graham-Yooll)\n- TUS-2663 WO-7 · Hand-run the R1 scan once (Oliver Graham-Yooll)"
  }
}
```

`tool_args` as persisted to SQLite **before** the pause, read back and byte-compared:

```
{"digest_text":"*In Progress*\n- TUS-2670 WO-14 · Handover: Jaelene makes a real change unaided (Haniyah Umair)\n- TUS-2658 WO-2 · Verify connector blast radius matches the design (Haniyah Umair)\n\n*In Review*\n- TUS-2660 WO-4 · Stand up the quarterly meeting date list (Haniyah Umair)\n\n*Todo*\n- TUS-2661 WO-5 · Write CLAUDE.md (Oliver Graham-Yooll)\n- TUS-2663 WO-7 · Hand-run the R1 scan once (Oliver Graham-Yooll)"}
```

```
args_byte_identical      True
approval_pauses          1
tool_selection_events    1
model_calls              2      (1 to select + 1 to conclude after the tool result)
slack_posts              1
terminal_outcome         posted
```

Event log, raw SQL:

```
{"step_index": 0, "step_name": "run_start",                  "tool_selected": null,            "decision": null,       "outcome": null}
{"step_index": 1, "step_name": "fetch_linear_issues_result",  "tool_selected": null,            "decision": null,       "outcome": null}
{"step_index": 2, "step_name": "llm_tool_selection",          "tool_selected": "post_to_slack", "decision": null,       "outcome": null}
{"step_index": 3, "step_name": "approval_decision",           "tool_selected": null,            "decision": "approved", "outcome": null}
{"step_index": 4, "step_name": "post_to_slack_result",        "tool_selected": null,            "decision": null,       "outcome": null}
{"step_index": 5, "step_name": "terminal",                    "tool_selected": null,            "decision": null,       "outcome": "posted"}
```

Full: `evidence/case1-happy-path.txt`

### Case 4 — crash resume · PASS

Kill-test log. Phase 1 runs in a child process that **SIGKILLs itself** — an uncatchable
kill, not a graceful exit (LOOP-2: *"prove crash-resume by killing the process mid-run;
that is a test, not a nice-to-have"*).

```
phase1 exit: signal=SIGKILL status=null
[phase1 pid=66932] run_start persisted
[phase1 pid=66932] fetched 5 open issues
[phase1 pid=66932] generate() finishReason=suspended mastraRunId=30cc2150-6a58-40ca-9911-2d64c6662978
[phase1 pid=66932] llm_tool_selection persisted (tool + full args + harness_run_id)
[phase1 pid=66932] handoff written (modelCalls=1)
[phase1 pid=66932] SIGKILL self now
```

What the fresh process recovered:

```
child_signal                     SIGKILL     <- real kill
killed_by_sigkill                True
resume_read_from                 WO-2 SQLite event log (not the harness store)
resumed                          True
restarted                        False       <- no re-fetch, no re-selection
args_byte_identical              True
tool_selection_events            1           <- PRD §9 metric: exactly one, never re-fired
tool_reselected_after_resume     False
model_calls_after_resume         0
slack_posts                      1
terminal_outcome                 posted
harness_native_resume            succeeded
resume_path                      native: agent.approveToolCallGenerate() on the persisted harness_run_id
```

Full: `evidence/case4-crash-resume.txt`

### Case 5 — SQL-readable state · PASS

Raw `sqlite3` CLI against the store. No framework API in the path.

```
$ sqlite3 /tmp/wo2test.db "select * from events where run_id = 'test-1'"
event_id  run_id  step_index  step_name                   tool_selected  decision  approver       outcome  sha      resource       thread
--------  ------  ----------  --------------------------  -------------  --------  -------------  -------  -------  -------------  -----------
1         test-1  0           run_start                                                                    de57c4c  utopia-studio  digest-test
2         test-1  1           fetch_linear_issues_result                                                   de57c4c  utopia-studio  digest-test
3         test-1  2           llm_tool_selection          post_to_slack                                    de57c4c  utopia-studio  digest-test
4         test-1  3           approval_decision                          approved  Haniyah Umair           de57c4c  utopia-studio  digest-test
5         test-1  4           post_to_slack_result                                                         de57c4c  utopia-studio  digest-test
6         test-1  5           terminal                                                            posted   de57c4c  utopia-studio  digest-test
```

Append-only is enforced by the database, not by convention (MEM-3, LOOP-6) — proved through
the CLI, not the JS layer:

```
$ sqlite3 /tmp/wo2test.db "update events set outcome='declined' where run_id='test-1';"
Error: stepping, events is append-only: UPDATE is forbidden (MEM-3, LOOP-6) (19)
$ sqlite3 /tmp/wo2test.db "delete from events where run_id='test-1';"
Error: stepping, events is append-only: DELETE is forbidden (MEM-3, LOOP-6) (19)
```

Full: `evidence/wo2-case5-raw-sql.txt`

### Case 6 — trace attribution · BLOCKED-NO-CREDENTIAL

```
BLOCK 6-trace-attribution  (34ms)  12/12 checks
       BLOCKED on missing credentials: LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY
```

**What is verified.** A custom exporter stamps the git sha onto every span Mastra emits.
32 span events for a single run, with a real Mastra `trace_id`:

```json
{"event_type":"span_started","trace_id":"b7d8e2a5fd87c95ed914eb5a8ec609ec","span_id":"65ff00a631e77c9e","span_name":"agent run: 'linear-digest'","span_type":"agent_run","git_sha":"6e64bd20047c6494625d90d4b428dab34d34a542","resource":"utopia-studio","thread":"digest-test","at":"2026-08-25T08:34:37.564Z"}
{"event_type":"span_started","trace_id":"b7d8e2a5fd87c95ed914eb5a8ec609ec","span_id":"16f09041e500bcf6","span_name":"llm: 'claude-sonnet-4-6'","span_type":"model_generation","git_sha":"6e64bd20047c6494625d90d4b428dab34d34a542","resource":"utopia-studio","thread":"digest-test","at":"2026-08-25T08:34:37.580Z"}
```

**What is not verified.**

```
langfuse_exporter_wired      True      <- the code path exists, mastra/observability.js
langfuse_exporter_active     False     <- inert: no keys
langfuse_trace_id            None
mastra_trace_id              0fcb5a863e92c0116c399df7a3176dbb
blocked                      ['LANGFUSE_PUBLIC_KEY', 'LANGFUSE_SECRET_KEY']
```

The PRD's grader is *"Langfuse trace for the run carries a git sha."* No Langfuse trace
exists, so this is **not** a PASS. It is also **not** a PRIMITIVE-GAP: Mastra can express
it — `LangfuseExporter` is wired and would activate on the presence of two env vars. The
blocker is a credential, and the operator instructed *"ignore langfuse ... ill add it
later"*. See W-02.

Full: `evidence/case6-trace-attribution.txt`

### Case 7 — oversized fetch · PASS

```
issues_used                  5
truncation_reported          True
truncation_mentions_total    13
slack_posts                  1
```

Truncation is computed in the portable fetch function and injected into the prompt as a
`<truncation>` block, so the digest cannot silently present a truncated list as complete
(PRD §9 hallucination watch item 4).

### Cases 8 / 9 / 10b — the three failure paths · PASS

```
case 8   terminal_outcome=failed  failure_stage=fetch       approval_pauses=0  slack_posts=0
         error_message = "Linear API returned 503"
case 9   terminal_outcome=failed  failure_stage=post        approval_pauses=1  slack_posts=1
         error_message = "slack 404: no_service"     distinct_from_declined=True
case 10b terminal_outcome=failed  failure_stage=validation  approval_pauses=0  slack_posts=0
         error_message = "Malformed issue in fetch response: missing title - failing run per Gate 6 validation"
         error_names_field = title
```

Case 8 and 10b record `approval_pauses=0` and `model_calls=0` — the fetch runs before the
model turn, so a failed or empty fetch **cannot** reach the approval gate. See D-01.

### Case 10a — missing assignee · PASS

```
renders_unassigned    True
invented_assignee     False
terminal_outcome      posted
```

`assignee` is normalised to the literal string `unassigned` inside
`tools/fetch_linear_issues.js`, not at render time. The model never sees a null and so
cannot invent a name — that moves PRD §9 hallucination watch item 1 from a prompt
instruction to a data guarantee, which is what makes this grader deterministic.

### Case 11 — check-first idempotency · PASS

The fixture's crash point lands *before* the send, so it only proves "check-first found
nothing and sent once":

```
persisted_send_found_on_resume   False
check_first_performed            True
slack_posts                      1
blind_retry                      False
child_signal                     SIGKILL
```

That is half the requirement. The half that actually prevents a duplicate — resume when a
send record **does** exist — is asserted separately in
`evals/acceptance/wo7-checkfirst.js`, with a Slack impl that fails the test if it is ever
called:

```
WO-7 acceptance — check-first SKIPS the send when a record already exists

  PASS  check-first ran
  PASS  existing send record was found
  PASS  send was SKIPPED
  PASS  Slack was never called again
  PASS  no blind retry
  PASS  still exactly 1 recorded post
  PASS  terminal written from persisted response

7/7 checks passed
slack fetch impl invocations on resume: 0  (must be 0)
```

**Residual window — now ratified into the PRD.** Check-first keys off a *persisted* send
record. If a process dies after Slack accepts the POST but before `post_to_slack_result`
is appended, resume finds no record and sends again — one duplicate message in Slack, still
one row in our log. The guarantee is therefore **at-least-once, not at-most-once**.

This is the behaviour PRD §5 specifies (*"send only if none exists"*), so it is implemented
as written and not silently "improved". **Documented in PRD §5 on 2026-08-25** with the
production gate stated explicitly: before this design reaches a production channel, a
pre-send `post_to_slack_attempt` intent record is required, with check-first extended so
that an attempt with no result means *"outcome unknown — do not re-send"*. That converts the
guarantee to at-most-once at the cost of a new unknown-outcome terminal state (LOOP-6).

---

## 3. WO-9 — the four primitives under test

| Primitive | Verdict | Detail |
|---|---|---|
| **Approval-pause granularity** (tool selection vs invocation) | **NATIVE** | `requireApproval: true` on `createTool`. Spike proof: `tool executed count BEFORE approval: 0`, while `suspendPayload` already carries `{toolCallId, toolName, args}`. This is exactly the granularity LOOP-5 says approval actually needs, and it required no scaffolding. |
| **Crash resume, no LLM re-fire** | **NATIVE + one undocumented option** | Survives a real `SIGKILL` and resumes in a fresh process via `approveToolCallGenerate({runId, toolCallId})`. Byte-identical args, no tool re-selection. But a bare resume makes **1 extra model call** to conclude the loop; reaching `model_calls_after_resume: 0` required passing `stopWhen: () => true` — see D-04. |
| **Check-first idempotency** | **WORKAROUND (ours, by necessity)** | Mastra has no check-first primitive, and warns in its own runtime output that it *cannot* de-duplicate concurrent resumes (see below). Implemented inside the gated tool's `execute`, against our event log. Code: `mastra/agent.js`, the `readRunState(...).has_persisted_send` branch. |
| **Schema-mapping friction** | **LOW, but non-zero — one forced column** | Our 11 fixed WO-2 columns needed **one** harness-specific addition, `harness_run_id`, because Mastra mints its own `runId` and `approveToolCall({runId})` is the only way to resume a suspended run. Nothing else about Mastra's state model leaked in. Mastra's own LibSQL tables live alongside at `<db>.mastra.db` and are never queried by any probe. |

Mastra's own words on why check-first cannot be delegated to it:

```
[Workflow agentic-loop] shouldPersistSnapshot excludes the "running" status, so
concurrent resume() calls for run 6a0485e1-1f5f-421d-81c6-65fb009ce317 cannot be
de-duplicated. Concurrent resumes may execute downstream steps more than once.
```

Emitted during every cross-process resume. Full: `evidence/mastra-concurrent-resume-warning.txt`.

### TOOL-3 framework-fit gates

The skill's adoption gate, answered from this build:

| Gate | Answer |
|---|---|
| Does it hide the loop? | **Partly.** `generate()` runs the agentic loop internally; you get `finishReason: 'suspended'` and resume by id, not a `while` you own. Stop conditions are reachable but only through `stopWhen`, whose condition helpers are unexported. Consistent with STACK-3's warning that Tier-B approval-gated work wants raw fetch — see W-03. |
| Is what it stores queryable from outside it? | **Its own store, unverified — irrelevant here.** We never made Mastra's LibSQL tables authoritative. Our SQLite log is plain `sqlite3`-readable (case 5), satisfying MEM-8 by construction rather than by trusting the harness. |
| Can it pause between tool selection and tool invocation? | **Yes, natively.** The single strongest result in this leg. |
| Eval and versioning story? | **Weak on both.** No mock-model or test-double package ships with it, so the deterministic suite needed a local Anthropic-compatible server (D-03). Docs disagreed with the installed code in three places (D-04, D-05, D-07). |

---

## 4. Deviations, waivers, and PRD conflicts

Every item here was raised before or during the build. Nothing was deviated silently.

| id | Item | Rule | Status |
|---|---|---|---|
| **W-01** | SQLite event log instead of Convex | **STACK-1** violated | **Waived by the PRD itself** (§5, Open Question 1): the schema must be identical and raw-SQL-readable across all three legs. |
| **W-02** | Langfuse not activated | **STACK-4** violated, and the pre-flight item *"Langfuse tracing live from commit one"* | **Waived by operator** — *"ignore langfuse ... ill add it later"*. Direct cost: case 6 cannot PASS. Exporter is wired in code; only keys are missing. |
| **W-03** | Framework loop for Tier-B-grade durability | **STACK-3 / LOOP-1** in tension | **Waived by the PRD's §0 override** — the bake-off exists to test this exact tension. Recorded, not resolved. |
| **D-00** | Model provider | — | Operator first said OpenAI; the supplied key was an Anthropic key (`sk-ant-…`) that OpenAI rejected with `Incorrect API key provided`. Reverted to the originally specified `anthropic/…` router. No rule covers model choice. |
| **D-01** | `fetch_linear_issues` is called by the orchestrator, not offered to the model | **LOOP-1**, **TOOL-1** | PRD §8 lists it as a tool; §1B makes it step 2 (Auto) with the zero-issue decision at step 3, *before* the model turn at step 4. Cases 3/8/10b require that no pause can ever be offered on an empty or failed fetch — only guaranteeable if the fetch precedes the model. §1B wins. `post_to_slack` is the single registered Mastra tool; no dead wrapper was left behind. |
| **D-02** | A **fifth** terminal state, `failed`, with a `failure_stage` discriminator | **CTX-3** | **RATIFIED INTO THE PRD 2026-08-25.** §2 now names five states with a ratification note, §3's exit conditions updated, and §9 gained a new check — *"a `failed` outcome carries a failure_stage of fetch \| validation \| post"* — automated as validator `V8-failure-stage-named`. Originally a PRD internal inconsistency: §2 named four states while cases 8/9/10b each demand a failure distinct from `declined`. |
| **D-03** | Local Anthropic-compatible mock model for the fixture suite | **EVAL-5**, **EVAL-4** | Mastra ships no test double. `ANTHROPIC_BASE_URL` is honoured, so the suite drives Mastra's real code path against a scripted endpoint. Makes the digest fixed and model calls countable, which is what §2's "deterministic graders" and §9's invocation count require. Live runs do not use it. |
| **D-04** | `stopWhen: () => true` on resume | — | Without it, resume makes 1 extra model call and case 4's *"LLM not re-invoked"* fails. `stopWhen` is accepted by the loop but `@mastra/core@1.61.0` exports **no** condition helper (`stepCountIs` and friends are internal), so a bare predicate is the only route. Documentation gap, not a primitive gap. |
| **D-05** | Exporter hook is `_exportTracingEvent`, not `_exportEvent` | — | The package's own source comment documents `_exportEvent`. Implementing the documented name **fails silently** — the run reports success while exporting zero spans, with only `[Observability] tracing handler error … this._exportTracingEvent is not a function` on stderr. A silent-success failure mode worth knowing about. |
| **D-06** | `@ai-sdk/*` present transitively | — | *"No ai-sdk packages"* is satisfiable only at the direct-dependency level. `@mastra/core` hard-depends on six: `@ai-sdk/provider-v5/v6/v7` and `@ai-sdk/provider-utils-v5/v6/v7`. Unavoidable. |
| **D-07** | Model id | — | Mastra's docs example shows `anthropic/claude-sonnet-4-6`; `create-mastra`'s own template shipped `openai/gpt-5.6-terra`, a suffixed id the docs do not list. `anthropic/claude-sonnet-4-6` is accepted by the router and is what this leg uses. |
| **D-08** | Two schema columns beyond WO-2's eleven: `resource`, `thread` | **MEM-7** | MEM-7 requires tenant-keyed, indexed tables; WO-8 requires events scoped to `resource=utopia-studio, thread=digest-test`; WO-2's column list has neither. Added with an index, identical across all three legs. |
| **D-09** | Two more columns: `failure_stage`, `error_message` | **CTX-3** | Required by D-02. Packing two facts into `outcome` would be exactly the silent default CTX-3 forbids. |
| **D-10** | One more column: `harness_run_id` | — | The schema-mapping friction Open Question 1 predicted. See WO-9 table. |
| **D-11** | Model-call count vs tool-selection count graded separately | — | PRD §9's throw message defines the metric as *"expected exactly 1 tool-selection event"*, not one model call. Mastra makes 2 model calls per completed run (select, then conclude). Both metrics are graded; neither is hidden behind the other. |
| **D-12** | `requestContext` available but unused | — | `execute(input, execOpts)` exposes `mastra, memory, runId, requestContext, actor, workspace, browser, observe, writer, tracing, loggerVNext, metrics`. A clean per-run DI channel therefore **exists**; we used a module-scoped context because the runner is one-run-per-process and `requestContext` is undocumented for this version. A choice, not a missing primitive. |
| **D-13** | `create-mastra` scaffolded a full "Agent Harness" template | **TOOL-1**, **EVAL-4** | Shell tools, workspace, memory, schedules, web search — far past the PRD's two-tool contract. Stripped to minimum before wiring. Anyone reproducing this leg should expect to delete most of the scaffold. |
| **D-14** | Model router caches the provider per process | — | Re-assigning `ANTHROPIC_BASE_URL` between runs in one process has **no effect**; later runs keep dialling the first URL. Cost real debugging time (a suite that hung with zero output). The suite now stands up one endpoint before the first agent is constructed. |
| **D-15** | Provider switched from Anthropic to OpenAI | — | Operator instruction 2026-08-25: *"we dot have any antrjopic api only open ai"*. The supplied `sk-ant-api0…` key returns HTTP 401 from both the raw REST API and the router. Model is now `openai/gpt-5.6-terra` (`create-mastra`'s own template default; see D-07), overridable via `DIGEST_MODEL`. This **restores** cross-leg comparability risk in the opposite direction from D-00: leg 2 (Claude Agent SDK) is Anthropic-only, so leg 1 and leg 4 now run on OpenAI while leg 2 cannot. The deterministic graders are model-independent; tool-selection behaviour is not. |
| **D-16** | Mastra's OpenAI provider uses the **Responses API**, not Chat Completions | — | Discovered by pointing `OPENAI_BASE_URL` at a logging stub: `POST /responses` with `{model, input[], tools[{type:'function',name,description,parameters}], tool_choice}`. The mock model had to grow a second wire format — `output[{type:'function_call', call_id, name, arguments}]` — because an Anthropic-shaped reply is simply not understood. Anyone assuming Chat Completions will build the wrong stub. |
| **D-17** | `OPENAI_BASE_URL` is honoured, same as `ANTHROPIC_BASE_URL` | — | Confirmed: the mock endpoint intercepts before any network call, so the entire 12-case deterministic suite runs with **no real model credential**. Verified the wire format actually served: `openai-responses /responses \| model: gpt-5.6-terra`, 2 calls per completed run. D-14's per-process provider caching applies identically. |
| **DEVIATION-NO-RULE-ID** | *(none outstanding)* | — | The `atelier-learnings` skill was eventually supplied as `atelier-learnings.skill` (a zip) and extracted to `.claude/skills/atelier-learnings/SKILL.md`, so all deviations above carry real rule IDs where a rule applies. |

---

## 5. Live leg — NOT RUN

Cases 1–6 against real Linear and real Slack **did not run.** One credential blocks them.

**Linear — verified working.** Real fetch against project `b7e846f6-63cb-4498-ba22-32c55a2bea05` ("Marketing Agents"):

```
open issues : 13 -> truncated to 5 (truncated=true)
[
  { "id": "TUS-2670", "title": "WO-14 · Handover: Jaelene makes a real change unaided",
    "status": "In Progress", "assignee": "Haniyah Umair", "updatedAt": "2026-08-21T14:48:29.656Z" },
  { "id": "TUS-2658", "title": "WO-2 · Verify connector blast radius matches the design",
    "status": "In Progress", "assignee": "Haniyah Umair", "updatedAt": "2026-08-21T14:48:19.301Z" },
  ...
]
```

**Slack — target verified, never posted to.** `#agent-test` = `C0B987LTH63`, private, not
archived. The webhook is channel-locked at creation, which is the mechanical blast-radius
control. **No live Slack message was sent in this session.**

**Model — rejected.**

```
$ curl https://api.anthropic.com/v1/messages -H 'x-api-key: $ANTHROPIC_API_KEY' ...
{"type":"error","error":{"type":"authentication_error","message":"API key is invalid."},"request_id":null}
```

Key shape is correct — 108 chars, `sk-ant-api0…` prefix, no whitespace, not truncated —
and it is rejected identically by the raw REST API and by Mastra's router, so this is the
key itself (revoked, expired, or from a disabled workspace), not a wiring fault.

Full: `evidence/live-credentials.txt`

**Coverage the live leg could never have given, regardless of credentials:**

| Case | Why it has no live target |
|---|---|
| 3 (empty project) | Both candidate projects have open issues |
| 10a (missing assignee) | All 13 issues in Marketing Agents are assigned |
| 10b (missing title) | Real Linear data will not produce an empty title |

Live case 1 would also have exercised case 7 simultaneously, since Marketing Agents has 13
open issues and every run truncates — so a live "happy path" is not a clean 5-in/5-out
observation. Flagged when the project was chosen.

---

## 6. What legs 2 and 3 inherit unchanged

- `tools/fetch_linear_issues.js`, `tools/post_to_slack.js`, `tools/errors.js` — zero harness imports, verified by `evals/acceptance/no-harness-imports.js`
- `store/schema.sql`, `store/events.js` — the fixed event-log schema, 11 WO-2 columns + 5 documented extensions (D-08/09/10)
- `evals/fixtures/*.json` (12), `evals/runner.js`, `evals/validators.js`, `evals/mocks.js`, `evals/mock-model.js`
- The harness contract: `run(fixture, ctx) -> report`, loaded by dynamic import so CJS and ESM legs load identically

**Scaffolding-overhead baseline (M1).** Case 1 passes with: 1 Mastra tool wrapper, 1 agent
definition, 1 orchestrator, and 1 module-scoped run context. The approval pause, the
suspend/resume, and the cross-process snapshot are all harness-native. Everything we had to
build ourselves is durability *accounting* — the event log, check-first, terminal-state
bookkeeping — not durability mechanism.

---

## 7. Open items for the operator

1. **Supply a working model key** to run live cases 1–6. Everything else for the live leg is verified and in place.
2. **Langfuse keys** would move case 6 from BLOCKED to a real PASS or FAIL. It is the only case still unresolved.
3. **Decide D-02** — ratify the fifth terminal state `failed` in the PRD, or specify how cases 8/9/10b should map onto the four.
4. **Decide the case 11 residual window** (§2) — leave PRD §5's send-if-no-record semantics, or add a pre-send intent record for at-most-once.
5. **Rotate two credentials.** The Slack webhook URL and the Slack Verification Token (value redacted from this file; it was pasted into the working session and is recorded in the operator's own transcript) both entered the session in clear text.
6. **Pre-flight items still unchecked** (LOOP-9 / the skill's own checklist): Langfuse tracing from commit one (W-02); generator/evaluator separation is *not applicable* here, since Gate 4 is collapsed and no subjective grading exists (EVAL-1/EVAL-2 waived by the PRD, §4).

---
---

# FINDINGS — linear-digest, leg 4 of 4 (Flue)

**Harness:** Flue — `@flue/runtime@2.0.3`, `@flue/cli@2.0.3`, `@earendil-works/pi-ai@0.84.3`, `valibot`
**Model:** custom Pi provider `mock/digest-mock` (`openai-completions`) against the local mock endpoint for the deterministic suite; Pi's built-in `openai` provider for live runs
**Runtime:** Node v26.3.0, macOS (darwin 25.5.0) · **Persistence:** `sqlite('<case>.db.flue.db')`
**Docs read in full:** `guide/durability`, `guide/tools`, `guide/agent-hooks`, `guide/models`, `reference/events`, `reference/agent-api`, `reference/data-persistence-api` (95-page corpus, read via `npx flue docs read`)

Reproduce:

```bash
node --env-file=.env evals/runner.js --harness=./flue/entry.js --all
```

Everything reused unchanged from leg 1: `tools/*` (verified zero harness imports by `evals/acceptance/no-harness-imports.js`), `store/*` (same schema, five terminal states), `evals/*` (same 12 fixtures, same runner, same validator gate). Only `flue/` is new.

---

## L4.1 Golden-case results

| # | Case | Verdict | Checks | Key evidence |
|---|---|---|---|---|
| 1 | happy-path | **PASS** | 17/17 | 1 pause via the scaffold, args byte-identical, exactly 1 post |
| 2 | decline | **PASS** | 14/14 | interceptor skipped `next()`, 0 posts, terminal `declined` |
| 3 | empty-project | **PASS** | 13/13 | 0 pauses, 0 model calls, terminal `nothing-to-digest` |
| 4 | crash-resume | **PASS** | 17/17 | real `SIGKILL`, native reconciliation, `model_calls_after_resume: 0` |
| 5 | sql-readable-state | **PASS** | 13/13 | our log raw-readable **and** Flue's own stream raw-readable |
| 6 | trace-attribution | **PRIMITIVE-GAP** | 13/13 | git sha on 27 Flue events, but **no Langfuse exporter exists at all** |
| 7 | oversized-fetch | **PASS** | 14/14 | 13 open → 5 used, truncation reported |
| 8 | linear-api-failure | **PASS** | 15/15 | terminal `failed`/`fetch`, 0 pauses, 0 posts |
| 9 | slack-send-failure | **PASS** | 15/15 | terminal `failed`/`post`, distinct from `declined` |
| 10a | missing-assignee | **PASS** | 13/13 | renders `unassigned`, no invented name |
| 10b | missing-title | **PASS** | 15/15 | validation rejection, 0 pauses, 0 posts |
| 11 | post-crash-duplicate-check | **PASS** | 14/14 | check-first, no blind retry, ≤1 post |

```
PASS 11   FAIL 0   PRIMITIVE-GAP 1   BLOCKED 0   ERROR 0   of 12
```

Raw output: `evidence/full-suite-flue.txt`. Per-case metrics: `evidence/flue-per-case.txt`.

---

## L4.2 Per-case evidence

### Cases 1 & 2 — the make-or-break approval probe

**Flue has no approval primitive.** `defineTool`'s authoritative contract (`reference/agent-api`) is:

```ts
defineTool(options: {
  name: string; description: string;
  input?: ToolInputSchema; output?: ToolOutputSchema;
  harness?: boolean; durable?: boolean;
  run(context): ...
}): ToolDefinition
```

No gating flag. Searching the 95-page corpus for `requireApproval`, `human-in-the-loop`, `interrupt`, `approve`, `confirm before running tool`, `suspend resume pause await human` returns **no approval page** — the top hits are `guide/tools` and `reference/agent-api`.

Flue's own answer is **conditional tools**: gate a tool's *presence* on `usePersistentState`, so `publish_release` doesn't exist until `record_approval` fires. That is the wrong granularity for this PRD — it approves a **capability**, not *this call with these arguments*, because the tool isn't mounted to be selected yet. LOOP-5 draws the line exactly here: *"check whether the pause can happen between tool selection and tool invocation; that is the granularity approval actually needs."*

**Verdict: SCAFFOLDED — 34 executable lines** (`flue/approval-gate.js`, 68 lines total, 34 comment/blank).

The scaffold composes two documented primitives that were not designed for approval:

- `observe()` — the `tool_start` event carries `{toolCallId, toolName, args}`
- `instrument()`'s `FlueExecutionInterceptor` — wraps tool execution with a `next` continuation; *"Interceptors run on the execution path: a slow interceptor slows the agent"* and *"Not calling it skips the wrapped work and the rest of the chain; the interceptor's return value becomes the operation's result."*

Whether this works at all depends entirely on event ordering, which is undocumented. Measured:

```
APPROVE PATH
  EVENT turn  output.content types=["toolCall"]
  EVENT tool_start toolCallId=call_mock_1 args={"digest_text":"..."}
  INTERCEPT tool toolName=post_to_slack toolCallId=call_mock_1 argsKnown=true args={"digest_text":"..."}
  INTERCEPT awaited 251ms BEFORE calling next() -- invocation deferred
  >>> TOOL RUN  #1 toolCallId=call_mock_1 args={"digest_text":"..."}
  tool executions: 1

DECLINE PATH
  INTERCEPT tool toolName=post_to_slack toolCallId=call_mock_1 argsKnown=true args={"digest_text":"..."}
  INTERCEPT DECLINING: skipping next() entirely
  tool executions: 0
```

`tool_start` fires **before** the interceptor and carries the args, so the gate sees full args, can defer invocation indefinitely, and can decline without the tool ever running. Case 1 result:

```
approval_pauses                  1
approval_args_visible            True
gate_intercepted_before_run      True
args_byte_identical              True
tool_selection_events            1
model_calls                      2
slack_posts                      1
terminal_outcome                 posted
flue_submission_id               sub_01M0W7RSKAM9FA0198R7PRDV82
flue_events_observed             27
```

Event log, raw SQL — identical shape to leg 1:

```
{'step_index': 0, 'step_name': 'run_start',                  'outcome': None}
{'step_index': 1, 'step_name': 'fetch_linear_issues_result',  'outcome': None}
{'step_index': 2, 'step_name': 'llm_tool_selection', 'tool_selected': 'post_to_slack', 'outcome': None}
{'step_index': 3, 'step_name': 'approval_decision', 'decision': 'approved', 'outcome': None}
{'step_index': 4, 'step_name': 'post_to_slack_result',        'outcome': None}
{'step_index': 5, 'step_name': 'terminal',                    'outcome': 'posted'}
```

**Caveat recorded, not smoothed over.** The scaffold sits on an ordering guarantee the docs never state and on `instrument()`, whose documented purpose is tracing adapters. `tool_start` is described as firing *"when execution begins"* — it happens to precede the interceptor, but nothing promises it will keep doing so. A Flue release that reorders these two would break the approval gate **silently**: the interceptor would see `argsKnown=false` and the gate would pause on an empty payload. `evals/validators.js` V1 (args-match) is what would catch it.

### Case 4 — crash resume · PASS

```
phase1 exit: signal=SIGKILL status=null
[phase1 pid=74978] run_start persisted
[phase1 pid=74978] fetched 5 open issues
[phase1 pid=74978] dispatched submissionId=sub_01M0W7YXZYDGPEFVNCJY0M9CVJ
[phase1 pid=74978] interceptor ctx: submissionId=undefined conversationId=conv_01M0W7YXZZVER7JPBVCT4QT0QP
[phase1 pid=74978] llm_tool_selection persisted (tool + full args) — SAVE POINT before the pause
[phase1 pid=74978] handoff written (modelCalls=1)
[phase1 pid=74978] SIGKILL self now: crash point = after selection persisted, before approval
```

```
child_signal                       SIGKILL
killed_by_sigkill                  True
resumed                            True
restarted                          False
args_byte_identical                True
tool_selection_events              1
tool_reselected_after_resume       False
model_calls_after_resume           0
slack_posts                        1
terminal_outcome                   posted
harness_native_resume              succeeded
resume_path                        native: fresh Flue runtime reconciled the interrupted submission on startup
```

Two things were required to get here, both recorded as D-rows:

- **`durable: true` on the gated tool (D-24).** Without it Flue's recovery settles an interrupted ordinary call with an *unknown-outcome error the model sees* — and the model may then re-select the tool, which would break PRD §9's "exactly 1 tool-selection event". `durable: true` makes recovery **re-execute** the call instead.
- **`terminate: true` on the tool result (D-25).** Without it Flue makes a concluding model call after the tool result and `model_calls_after_resume` is 1. `terminate: true` is *documented* — "ends the agent's turn once the current tool batch settles". Mastra needed an **undocumented** `stopWhen` predicate for the identical problem.

**Wall clock: 30.4s, against Mastra's 0.6s.** Recovery is triggered by startup reconciliation plus periodic lease scans, and the scan cadence dominates. Correctness is equal; time-to-recover is ~50× worse at this scale. That is a real operational difference, not measurement noise — case 11 reproduced it at 30.7s.

### Case 5 — SQL-readable state · PASS, and this is where Flue wins

Our canonical log is raw-readable exactly as in leg 1. The new result is that **Flue's own durable stream is raw-readable too**:

```
$ sqlite3 runs/1-happy-path.db.flue.db ".tables"
flue_agent_submissions                    flue_conversation_stream_batch_chunks
flue_attachment_chunks                    flue_conversation_stream_batches
flue_attachments                          flue_conversation_streams
flue_conversation_fold_checkpoint_chunks  flue_meta
flue_conversation_fold_checkpoints        flue_submission_chunks
```

```
submission_id = sub_01M0W7RSKAM9FA0198R7PRDV82
  session_key = agent-session:["LinearDigest","digest-1-happy-path-...","default","default"]
         kind = dispatch
       status = settled
attempt_count = 1
 max_attempts = 10
     owner_id = owner_01M0W7RSK9HPY7DPW8VJQQ48BD
```

The full tool call, with arguments, recovered from Flue's own stream by raw SQL plus a JSON parse — no framework API:

```json
{
  "type": "assistant_tool_call",
  "id": "record_01M0W7RSQB8J11AWH4TBP3KP3S",
  "conversationId": "conv_01M0W7RSKC1469VYD3P9A23NKP",
  "submissionId": "sub_01M0W7RSKAM9FA0198R7PRDV82",
  "attemptId": "attempt_01M0W7RSKFEM3VZNJS0W9SA4A9",
  "turnId": "turn_01M0W7RSN6AVQYGKVSG32CGTES",
  "toolCallId": "call_mock_1",
  "name": "post_to_slack",
  "arguments": { "digest_text": "*In Progress*\n- TUS-2670 WO-14 · Handover: ..." }
}
```

Record types present, all reachable by raw SQL:

```
   5  assistant_message_started        3  assistant_tool_call
   5  assistant_message_completed      3  tool_step_settled
   3  conversation_created             3  tool_outcome
   3  user_message                     3  tool_results_committed
   3  resource_snapshot                3  submission_settled
   3  agent_start_run                  2  assistant_text_delta
```

**Append-only or compacted?** Both, by design. The stream is append-only batches, and `reference/data-persistence-api` states the invariant directly: *"The stream is the sole authoritative transcript — canonical state is reconstructed by replaying it from the beginning, and an adapter must not model a second transcript in session rows, snapshots, or event streams."* Compaction machinery exists (`flue_conversation_fold_checkpoints`) but held **0 rows** at this scale, so nothing was folded or deleted in any run here. Long-lived conversations would fold; that is a retention question for a production deployment, not a defect.

**Mirroring into our schema:** trivial. Every record already carries `submissionId`, `conversationId`, `turnId`, `toolCallId` and a timestamp, so a mirror is a projection, not a reconstruction.

Full evidence: `evidence/flue-case5-native-stream.txt`.

### Case 6 — trace attribution · PRIMITIVE-GAP

```
GAP   6-trace-attribution  13/13 checks
      PRIMITIVE-GAP: No Langfuse exporter exists for Flue (0 doc hits; @flue/langfuse is
      npm 404). git-sha-on-trace is achievable on Flue's own event stream, but a Langfuse
      trace id requires bridging @flue/opentelemetry to a Langfuse OTLP endpoint.
```

Verified three ways:

```
$ npx flue docs search "langfuse"        -> results: 0
$ npx flue docs | grep ecosystem/tooling -> braintrust, jetty, opentelemetry, sentry, vitest-evals
$ npm view @flue/langfuse version        -> npm error 404
$ npm view @flue/opentelemetry version   -> 2.0.3
```

This is a **stronger** negative than leg 1's. Mastra had a real `@mastra/langfuse@1.5.0` exporter wired in code and was blocked only on credentials; Flue has no Langfuse integration to wire at all. The reachable route is `@flue/opentelemetry` → a Langfuse OTLP endpoint, i.e. an extra bridge plus the same missing credentials.

What *is* verified: git sha stamped onto every observed Flue event, 27 events for one run, with `submissionId`/`conversationId` as the trace key:

```
trace_id_present     True
trace_has_git_sha    True
flue_events_observed 27
```

**Flue has no `trace_id`/`span_id` concept** — it has a typed runtime event stream with correlation ids. Spans are what the OTel adapter constructs. Recorded as D-23.

### Case 11 — check-first · PASS

```
child_signal                     SIGKILL
resumed                          True
check_first_performed            True
persisted_send_found_on_resume   False
slack_posts                      1
blind_retry                      False
tool_selection_events            1
model_calls_after_resume         0
```

As in leg 1, the fixture's crash point precedes the send, so this only proves "found nothing, sent once". The duplicate-preventing half is asserted separately in `evals/acceptance/wo7-checkfirst-flue.js`, with a Slack impl that fails the test if called:

```
Leg 4 (Flue) — check-first SKIPS the send when a record already exists

  PASS  check-first ran
  PASS  existing send record was found
  PASS  send was SKIPPED
  PASS  Slack was never called again
  PASS  no blind retry
  PASS  still exactly 1 recorded post
  PASS  terminal written from persisted response
  PASS  Flue runtime was never even started

8/8 checks passed
slack fetch impl invocations on resume: 0  (must be 0)
```

**The same residual window applies** (PRD §5, ratified). Flue narrows it slightly but does not close it: `step.do(name, fn)` is *exactly-once-recorded, at-least-once-executed*, and the docs state plainly that *"a crash in the window between a step's function finishing and its record landing re-executes that one step."* Same class of gap as ours, one layer lower. The PRD's pre-send intent record is still the fix.

### `budget-exhausted`

No golden case covers it, so it is asserted directly (`evals/acceptance/wo5-budget-flue.js`):

```
Leg 4 acceptance — budget-exhausted terminal state (DIGEST_STEP_BUDGET=2)
  PASS  terminal state is budget-exhausted
  PASS  run was reported, not silent
  PASS  no Slack post occurred
  PASS  state left SQL-readable
  PASS  ceiling recorded
5/5 checks passed
```

---

## L4.3 The four primitives under test

| Primitive | Verdict | Detail |
|---|---|---|
| **Approval-pause granularity** | **SCAFFOLDED — 34 executable lines** | No primitive exists; `defineTool` has no gating flag and no approval page exists in 95 doc pages. Reached the required granularity by composing `observe()` (`tool_start` carries args) with `instrument()`'s execution interceptor (awaiting defers invocation; skipping `next()` declines). Depends on an **undocumented ordering guarantee**. Flue's own idiom — conditional tools — approves a capability, not a call. |
| **Crash resume, no LLM re-fire** | **NATIVE** | Survives a real `SIGKILL`; a fresh runtime over the same SQLite file reconciles the interrupted submission on startup with no handle held in memory (`handle.read()` is documented re-attachable). Byte-identical args, no re-selection, `model_calls_after_resume: 0`. Needed `durable: true` (D-24) and `terminate: true` (D-25) — both documented flags. **Cost: ~30s to recover vs Mastra's ~0.6s.** |
| **Check-first idempotency** | **WORKAROUND (ours) + a real partial primitive** | Flue has no check-first, and warns that an interrupted ordinary call settles with an unknown-outcome error. But `step.do()` is a genuine exactly-once-*recording* primitive Mastra has no equivalent for. We still implement check-first against our own log, because `step.do` is scoped to one tool call and cannot answer "did a previous *run* already send?". |
| **Schema-mapping friction** | **ZERO forced columns** | Nothing about Flue's state model had to enter our schema. `harness_run_id` (added for Mastra's `runId`) was reused for Flue's `toolCallId` — the column already existed, so leg 4 added no new columns. Flue's own stream stays at `<db>.flue.db` and no probe queries it except to *prove* it is queryable (case 5). |

### TOOL-3 framework-fit gates

| Gate | Flue | Mastra (leg 1) |
|---|---|---|
| Does it hide the loop? | **Partly, and differently.** No `while` to own; you `dispatch()` and the durable coordinator runs attempts. But `terminate: true` is a documented, first-class loop-ending contract on the tool result — cleaner than Mastra's undocumented `stopWhen`. Flue also removed its `defineWorkflow` primitive in v2.0 ("Use awaited `init()` handles, durable tools, or your own orchestrator"), which pushes orchestration back to your code — LOOP-1's preference. | Partly. `generate()` runs the loop; resume by id; stop conditions only via unexported `stopWhen` helpers. |
| Is what it stores queryable from outside it? | **Yes, emphatically.** Plain SQLite, `flue_*` tables, JSON records with full tool args and a documented single-authoritative-transcript invariant. Verified by raw `sqlite3`. | Unverified — we never made its store authoritative. |
| Can it pause between tool selection and tool invocation? | **Not natively.** 34 lines of scaffold on an undocumented ordering guarantee. | **Yes, natively** — `requireApproval: true`, one flag. |
| Eval and versioning story? | **Better.** Ships `fauxProvider` (a model test double) and an `ecosystem/tooling/vitest-evals` integration; `@flue/runtime/test-utils` exports persistence-adapter contract test suites; a written migration guide for 1.0-beta → 2.0. Docs ship *in the CLI* (`flue docs read`), so they match the installed version. | **Weaker.** No test double, no eval integration; docs disagreed with installed code in three places. |

---

## L4.4 Leg-4 D-rows (docs-vs-reality and deviations)

| id | Item | Rule | Status |
|---|---|---|---|
| **D-18** | Flue has **no approval primitive** | **LOOP-5** | The central finding. `defineTool` = `{name, description, input?, output?, harness?, durable?, run}`. Zero approval/HITL/interrupt pages in 95. Flue's idiom (conditional tools) gates capability, not call. Scaffolded in 34 lines. |
| **D-19** | Flue/Pi does **not** honour `OPENAI_BASE_URL` | — | Unlike Mastra (D-17), no env route to a custom endpoint. The documented mechanism is a custom Pi provider with an explicit `baseUrl` — cleaner in principle, but a code change rather than config, and it must be registered before any agent runs. |
| **D-20** | The docs' keyless custom-provider example **does not work** | — | `guide/models` shows `resolve: async () => ({ auth: {} })` for a "keyless local server". That throws `No API key for provider` — `openai-completions`' `getClientApiKey()` requires an `apiKey` or an `authorization` header. Returning `undefined` throws a *different* error, `Provider is not configured`. Working shape: `{ auth: { apiKey: <any value> } }`. Two misleading failures from one wrong doc example. |
| **D-21** | Flue/Pi calls the model with `stream: true` | — | A single JSON body fails with `Stream ended without finish_reason`. The mock had to grow SSE support (`data: {...}` chunks + `data: [DONE]`). Mastra's `generate()` path accepted a plain JSON body, so this is a real per-harness difference in what a test double must implement. |
| **D-22** | Interceptor `ctx` has no `submissionId` at tool scope | — | `reference/events` says session scope carries `instanceId, harness, conversationId, session, operationId`. Observed: `submissionId=undefined conversationId=conv_...`. A crash-resume handoff needs the submission id, so it must be captured from the `dispatch()` receipt instead of from the interceptor. |
| **D-23** | Flue has no `trace_id`/`span_id` concept | **STACK-4** | It has a typed runtime event stream with correlation ids (`submissionId`, `conversationId`, `turnId`, `toolCallId`). Spans exist only as what `@flue/opentelemetry` constructs. We used `submissionId` as the trace key and stamped the git sha onto every event. |
| **D-24** | `durable: true` required on the gated tool | **LOOP-6** | Without it, an interrupted ordinary call settles with an unknown-outcome error *the model sees* and may re-select the tool — breaking PRD §9's single-selection invariant. This is Flue's documented, deliberate conservatism ("the runtime cannot know which of its side effects already happened"), not a bug. |
| **D-25** | `terminate: true` required for "LLM not re-invoked" | — | Without it, resume makes 1 concluding model call. **Documented**, unlike Mastra's `stopWhen` (D-04). |
| **D-26** | One Flue runtime per process | — | *"One process holds at most one Flue runtime; `start()` throws when a runtime is already configured."* The runner executes 12 cases in one process, so each case starts and stops its own runtime over its own SQLite file. Mastra allowed a fresh `Mastra` instance per run with no global constraint. |
| **D-27** | pi-ai version skew | — | Two copies in the tree: top-level `@earendil-works/pi-ai@0.84.3` (installed for `createProvider`) and `@flue/runtime → @earendil-works/pi-ai@0.83.0`. The custom provider is built from 0.84.3 objects and consumed by a runtime compiled against 0.83.0. It worked; it is an untested compatibility surface, and `guide/models` tells you to `npm install @earendil-works/pi-ai` without mentioning pinning. |
| **D-28** | Recovery latency ~30s | — | Cases 4 and 11 took 30.4s and 30.7s against Mastra's 0.6s and 0.4s. Startup reconciliation plus periodic lease scans; the scan cadence dominates. Correctness identical, time-to-recover ~50× worse at this scale. |
| **D-29** | `model_calls` demoted from graded to recorded | **EVAL-4** | Leg 1 graded `model_calls` (D-11) to catch behaviour changes. It caught a real one: on decline Mastra makes **1** model call (`declineToolCall` ends the run) while Flue makes **2** (the declined tool result goes back to the model). It is not one of PRD §2's graders — I added it — and a shared fixture cannot encode two correct values. Now recorded per leg; `tool_selection_events`, the actual §9 metric, stays graded. Fixture `notes` record the change. |
| **D-30** | No `'use agent'` directive needed for programmatic use | — | The directive is the module contract for the build/routing pipeline; `start({agents:[{agent, name}]})` accepts a plain inline function. Useful for tests, and not obvious from `guide/building-agents`. |

---

## L4.5 Head-to-head: Mastra vs Flue

> **Superseded by §X.1**, the three-way table added after leg 3 (Deep Agents) was built. Kept for the record; the two-way reasoning below still holds for the pair it compares.

| Gate / probe | Mastra (leg 1) | Flue (leg 4) |
|---|---|---|
| **Approval pause between selection and invocation** | **NATIVE** — `requireApproval: true`, one flag; `suspendPayload` carries `{toolCallId, toolName, args}` | **SCAFFOLDED — 34 lines** on an undocumented event ordering |
| Full args visible at approval | Native, in the suspend payload | Via `observe()` + interceptor correlation |
| Programmatic approve / decline | `approveToolCall()` / `declineToolCall()` | Call `next()` / skip `next()` |
| **Crash resume (real SIGKILL)** | NATIVE, `model_calls_after_resume: 0` via **undocumented** `stopWhen` | NATIVE, `model_calls_after_resume: 0` via **documented** `terminate: true` |
| Time to recover | **~0.6s** | ~30s |
| Args byte-identical after resume | Yes | Yes |
| Tool re-selected on resume | No | No |
| **Native store queryable outside it** | Unverified (never made authoritative) | **Yes — plain SQLite, JSON records, full tool args, documented single-transcript invariant** |
| Durable-step primitive | None | **`step.do()` — exactly-once-recorded** |
| **Check-first idempotency** | Ours, in the tool | Ours, in the tool (`step.do` helps but is call-scoped) |
| Residual duplicate window | Present | Present, one layer lower |
| **Langfuse trace + git sha** | Exporter exists (`@mastra/langfuse@1.5.0`), **BLOCKED on credentials** | **No exporter exists** (`npm 404`); OTel bridge required — **PRIMITIVE-GAP** |
| Trace/span model | Real `trace_id`/`span_id` | Event stream with correlation ids only |
| **Forced schema columns** | 1 (`harness_run_id`) | **0** |
| Model test double shipped | No | **Yes (`fauxProvider`)** |
| Eval integration | None | `vitest-evals` + adapter contract test suites |
| Docs accuracy | 3 disagreements with installed code | 3 disagreements, incl. a non-working headline example |
| Docs delivery | Website | **Bundled in the CLI** (`flue docs read`) — always matches the installed version |
| Model wire protocol | OpenAI **Responses** API, non-streaming accepted | OpenAI **Chat Completions**, **streaming required** |
| Custom endpoint | `OPENAI_BASE_URL` env var | Custom provider object in code |
| Runtimes per process | Unlimited | **One** |
| Suite result | 11 PASS / 1 BLOCKED | 11 PASS / 1 PRIMITIVE-GAP |

### Where each wins, and what is still unknown

**Flue wins on durability substance and on inspectability.** Its durable stream is the thing the Atelier post-mortem asked for and did not have: a plain-SQLite, append-only, single-authoritative transcript whose records carry the full tool call and arguments, readable with `sqlite3` and no framework API — satisfying MEM-8 and LOOP-2 *by construction* rather than by us building a parallel log beside it. It forced **zero** columns into our schema; `step.do()` is a real exactly-once-recording primitive with no Mastra counterpart; `terminate: true` is documented where Mastra's equivalent is not; and it ships a model test double and an eval integration where Mastra ships neither. Shipping docs inside the CLI is a small thing that mattered repeatedly — the docs I read were the docs I had installed.

**Mastra wins decisively on the one primitive this bake-off was built to test.** Approval-pause granularity is native, one flag, args in the payload, with `approveToolCall`/`declineToolCall` to resume — and it recovers in 0.6s where Flue takes 30s. On Flue the same behaviour costs 34 lines of scaffold resting on an ordering relationship the docs never promise; a release that swaps `tool_start` and the interceptor would break the gate quietly, and only our own V1 args-match validator would catch it. Mastra also has a Langfuse exporter that merely lacks keys, where Flue has none to configure. Per LOOP-9, that 34-line scaffold is a dated assumption to retest on every Flue release.

**What remains unknown.** Neither leg ran live — no working model credential in this session — so every model interaction here came from a scripted local endpoint, and nothing is known about real-model tool-selection behaviour, real latency, or real cost on either harness. Case 6 is unresolved on both: unproven on Mastra, and needing an unbuilt OTel bridge on Flue. Multi-tenancy is untested — one fixed `resource`/`thread` throughout, and Flue's "one live owner per conversation" constraint for multi-replica deployments was never exercised. Flue's compaction path never engaged (0 fold-checkpoint rows), so long-conversation retention is unknown. The 30s recovery figure is one machine, one scale, SQLite. And leg 2 (Claude Agent SDK) is Anthropic-only, so with legs 1 and 4 now on OpenAI, provider is a confound across the full bake-off (D-15).

**No overall winner is declared here.** That is the operator's call with the gate-5 human read.

---

## L4.6 Pi and the OpenClaw "host not layer" verdict

**Observed: the verdict holds for Flue, but for a narrower reason than assumed — and Pi is more capable than "layer" suggests.**

Flue's dependency on Pi is real but shallow:

```
$ npm ls @earendil-works/pi-ai @earendil-works/pi-agent-core
flue@
+-- @earendil-works/pi-ai@0.84.3
| `-- @earendil-works/pi-telemetry@0.84.3
`-- @flue/runtime@2.0.3
  +-- @earendil-works/pi-agent-core@0.83.0
  | `-- @earendil-works/pi-ai@0.83.0
  `-- @earendil-works/pi-ai@0.83.0
```

`pi-agent-core` describes itself as *"General-purpose agent with transport abstraction, state management, and attachment support"* and ships a **complete session model of its own** — 82 exports including `Session`, `InMemorySessionRepo`, `JsonlSessionRepo`, `JsonlSessionStorage`, `agentLoop`, `runAgentLoop`, `AgentHarness`, compaction settings, and built-in `createBashTool`/`createEditTool`/`createReadTool`/`createWriteTool`.

**Flue uses almost none of it.** Every symbol `@flue/runtime` imports from `pi-agent-core` is:

```
Agent
```

And Pi's session-model symbols appear **zero** times anywhere in `@flue/runtime/dist`:

```
JsonlSessionRepo    -> 0
InMemorySessionRepo -> 0
JsonlSessionStorage -> 0
AgentHarness        -> 0
runAgentLoop        -> 0
```

Flue defines its own persistence contract instead — `PersistenceAdapter` with three stores (`AgentSubmissionStore`, `ConversationStreamStore`, `AttachmentStore`), all tables `flue_`-prefixed — and states the invariant that makes the boundary explicit: *"The stream is the sole authoritative transcript... an adapter must not model a second transcript in session rows, snapshots, or event streams."*

**What this revises.** Pi is not acting as a host under Flue; it is a **layer**, and a thin one — a model-provider catalog plus the inner `Agent` primitive. Flue owns submissions, attempts, leases, the conversation stream, recovery, and compaction. So "host not layer" survives *as applied to Flue*: adopting Flue does not mean adopting Pi's session model, and Pi's session model is not what gave us the case-5 result — Flue's own `ConversationStreamStore` did.

**What this complicates.** Pi is evidently *able* to be a host in its own right — it ships session repos, an agent loop, a harness, and a filesystem/shell toolset. Flue declines that surface and keeps the model layer. So the "host not layer" framing is a statement about **how a given framework consumes Pi**, not a property of Pi itself. If OpenClaw consumes Pi's `Session`/`JsonlSessionRepo`/`agentLoop` surface, it is taking a session model and a loop — a genuinely different adoption decision from Flue's, and one that should be evaluated separately rather than inherited from this leg. Two concrete follow-ups: Pi's JSONL session store would need its own MEM-8 check (JSONL is inspectable, but it is not the same guarantee as Flue's SQL stream), and `pi-telemetry` — pulled in transitively and never exercised here — is where a Pi-level observability answer would live.

One operational note: the pi-ai version skew (D-27) is a direct consequence of this layering. Following `guide/models` and running `npm install @earendil-works/pi-ai` produced a *second*, newer copy alongside the one `@flue/runtime` bundles, and custom-provider objects crossed that boundary. It worked, and nothing in the docs says it should.

Evidence: `evidence/flue-pi-role.txt`.

---
---

# FINDINGS — linear-digest, leg 3 of 4 (Deep Agents)

**Harness:** Deep Agents — `deepagents@1.13.1` (`langchain-ai/deepagentsjs`), `langchain@1.5.10`, `@langchain/core@1.2.9`, `@langchain/langgraph@1.4.12`, `@langchain/langgraph-checkpoint-sqlite@1.0.4`, `@langchain/openai@1.5.10`, `langfuse-langchain@3.38.20`
**Model:** `ChatOpenAI` with `configuration.baseURL` pointed at the local mock (Chat Completions) for the deterministic suite; real OpenAI for live runs
**Runtime:** Node v26.3.0, macOS · **Checkpointer:** `SqliteSaver.fromConnString('<case>.db.langgraph.db')`

Reproduce:

```bash
node --env-file=.env evals/runner.js --harness=./deepagents/entry.js --all
```

Everything reused unchanged: `tools/*`, `store/*`, `evals/*` — same 12 fixtures, same runner, same validator gate. Only `deepagents/` is new.

---

## L3.1 Golden-case results

| # | Case | Verdict | Checks | Key evidence |
|---|---|---|---|---|
| 1 | happy-path | **PASS** | 17/17 | native `__interrupt__`, args byte-identical, exactly 1 post |
| 2 | decline | **PASS** | 14/14 | `{type:'reject'}` resume, 0 posts, terminal `declined` |
| 3 | empty-project | **PASS** | 13/13 | 0 pauses, 0 model calls, terminal `nothing-to-digest` |
| 4 | crash-resume | **PASS** | 17/17 | real `SIGKILL`, checkpointed resume, `model_calls_after_resume: 0`, **0.5s** |
| 5 | sql-readable-state | **PASS** | 13/13 | our log raw-readable; LangGraph's checkpoints are `type=json` and readable too |
| 6 | trace-attribution | **BLOCKED-NO-CREDENTIAL** | 13/13 | `langfuse-langchain` **exists and is wired**; only the keys are missing |
| 7 | oversized-fetch | **PASS** | 14/14 | 13 open → 5 used, truncation reported |
| 8 | linear-api-failure | **PASS** | 15/15 | terminal `failed`/`fetch`, 0 pauses, 0 posts |
| 9 | slack-send-failure | **PASS** | 15/15 | terminal `failed`/`post`, distinct from `declined` |
| 10a | missing-assignee | **PASS** | 13/13 | renders `unassigned`, no invented name |
| 10b | missing-title | **PASS** | 15/15 | validation rejection, 0 pauses, 0 posts |
| 11 | post-crash-duplicate-check | **PASS** | 14/14 | check-first, no blind retry, ≤1 post |

```
PASS 11   FAIL 0   PRIMITIVE-GAP 0   BLOCKED 1   ERROR 0   of 12
```

Raw output: `evidence/full-suite-deepagents.txt`. Per-case metrics: `evidence/deepagents-per-case.txt`.

---

## L3.2 Per-case evidence

### Cases 1 & 2 — the approval probe · NATIVE, and the richest of the three

`createDeepAgent({ interruptOn: { post_to_slack: true } })`. One option. The first `invoke()` returns with an `__interrupt__` envelope:

```json
[
  {
    "id": "d41e5a6c51db0787ff5d069240a01a0f",
    "value": {
      "actionRequests": [
        {
          "name": "post_to_slack",
          "args": { "digest_text": "No issues block found in prompt." },
          "description": "Tool execution requires approval\n\nTool: post_to_slack\nArgs: {\n  \"digest_text\": \"...\"\n}"
        }
      ],
      "reviewConfigs": [
        { "actionName": "post_to_slack", "allowedDecisions": ["approve", "edit", "reject"] }
      ]
    }
  }
]
tool executions BEFORE approval: 0
```

Three things here that neither other leg provides:

1. **`allowedDecisions: ["approve", "edit", "reject"]`** — a first-class **edit** decision. Resuming with `{type:'edit', editedAction:{name, args}}` lets the approver amend the arguments before invocation. Mastra and Flue offer approve/decline only; amending would mean re-running the model.
2. **A pre-rendered human-facing `description`** — the harness formats the approval prompt itself, tool name and pretty-printed args included. The other two hand you a raw payload to render.
3. **`respond`** as a fourth documented decision type (return a synthetic tool result directly), not exercised here.

Resume is `agent.invoke(new Command({ resume: { decisions: [{type:'approve'}] } }), config)`. Measured both ways:

```
APPROVE:  >>> TOOL RUN #1 args={"digest_text":"..."}   tool executions AFTER: 1
REJECT :  (no TOOL RUN)                                 tool executions AFTER: 0
```

Case 1 result:

```
approval_pauses                1
approval_args_visible          True
args_byte_identical            True
allowed_decisions              ['approve', 'edit', 'reject']
tool_selection_events          1
slack_posts                    1
check_first_performed          True
trace_spans_written            2
langfuse_exporter_wired        True
langfuse_exporter_active       False
```

**A checkpointer is mandatory** — HITL does not work without one, and the docs' example is `MemorySaver`, which is in-process and would lose everything on the crash cases. We use `SqliteSaver` (D-33).

### Case 4 — crash resume · PASS

```
phase1 exit: signal=SIGKILL status=null
[phase1 pid=85513] run_start persisted
[phase1 pid=85513] fetched 5 open issues
[phase1 pid=85513] __interrupt__ raised: tool=post_to_slack allowedDecisions=["approve","edit","reject"]
[phase1 pid=85513] llm_tool_selection persisted (tool + full args) — SAVE POINT before the pause
[phase1 pid=85513] handoff written (modelCalls=1)
[phase1 pid=85513] SIGKILL self now: crash point = after selection persisted, before approval
```

```
child_signal                     SIGKILL
killed_by_sigkill                True
resumed                          True
restarted                        False
args_byte_identical              True
tool_selection_events            1
tool_reselected_after_resume     False
model_calls_after_resume         0
slack_posts                      1
terminal_outcome                 posted
harness_native_resume            succeeded
resume_path                      native: fresh process resumed the checkpointed thread with Command({resume})
langgraph_thread_id              digest-4-crash-resume-85507-1787660189164
```

Resume needs only the `thread_id` and the checkpoint file — nothing in memory carries across the kill. **0.5s**, comparable to Mastra and ~60× faster than Flue.

As with the other two legs, reaching `model_calls_after_resume: 0` required a loop-ending mechanism (D-34): `modelCallLimitMiddleware({ threadLimit: 1, exitBehavior: 'end' })`. Its `exitBehavior` is documented as *"'end' will end the agent"*, so the post-tool concluding call is simply not made. This is the **best-documented** of the three mechanisms — Flue's `terminate: true` is documented but is a per-tool flag, and Mastra's `stopWhen` is an unexported predicate. It also doubles as the code-enforced budget guard LOOP-8 and LOOP-3 ask for.

### Case 5 — SQL-readable state · PASS

Our canonical log reads exactly as in the other legs. LangGraph's own checkpoint store is also readable, with a caveat.

```
$ sqlite3 runs/1-happy-path.db.langgraph.db ".tables"
checkpoints  writes

CREATE TABLE checkpoints (
  thread_id TEXT NOT NULL, checkpoint_ns TEXT NOT NULL DEFAULT '',
  checkpoint_id TEXT NOT NULL, parent_checkpoint_id TEXT,
  type TEXT, checkpoint BLOB, metadata BLOB,
  PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id)
);
CREATE TABLE writes (
  thread_id TEXT NOT NULL, checkpoint_ns TEXT NOT NULL DEFAULT '',
  checkpoint_id TEXT NOT NULL, task_id TEXT NOT NULL, idx INTEGER NOT NULL,
  channel TEXT NOT NULL, type TEXT, value BLOB,
  PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, idx)
);
```

The columns are declared `BLOB` but the stored `type` is `json`, so the content is plain text:

```
json|494
json|771
json|924
```

The tool call and its arguments are recoverable by raw SQL plus a JSON parse:

```json
[
  {
    "id": "call_mock_1",
    "type": "function",
    "function": {
      "name": "post_to_slack",
      "arguments": "{\"digest_text\":\"*In Progress*\\n- TUS-2670 WO-14 · Handover: ...\"}"
    }
  }
]
```

And — the strongest single result here — **both the approval request and the human's decision are durably recorded and raw-readable**:

```
__interrupt__|{"id":"bb9a5717...","value":{"actionRequests":[{"name":"post_to_slack","args":{"digest_text":"..."},"description":"Tool execution requires approval..."
__resume__   |{"decisions":[{"type":"approve"}]}
```

Channels present in `writes`:

```
messages                                        __interrupt__
branch:to:FilesystemMiddleware.before_agent     __resume__
branch:to:patchToolCallsMiddleware.before_agent __pregel_tasks
branch:to:model_request
branch:to:HumanInTheLoopMiddleware.after_model
```

**The caveat, stated plainly.** This is a **graph-state snapshot chain**, not a semantic event log. Records are LangChain's serialization format (`{"lc":1,"type":"constructor","id":["langchain_core","messages","AIMessage"],"kwargs":{…}}`), tool arguments are a JSON *string nested inside* JSON, and state is duplicated across snapshots — one short run produced 39 checkpoint rows, and **5 of them contained the same tool call**. So MEM-8 is satisfied, but with materially more archaeology than Flue's flat `assistant_tool_call` records. Reading it means understanding `channel_values`, `parent_checkpoint_id` chains, and LangChain's serializer.

**Append-only or compacted?** Append-only in practice: checkpoints accumulate with `parent_checkpoint_id` pointers and nothing was deleted in any run. There is no compaction machinery in the schema — which also means unbounded growth (39 rows for a 6-step run) with no built-in retention story. Flue at least ships fold checkpoints for this.

Full evidence: `evidence/deepagents-case5-native-store.txt`.

### Case 6 — trace attribution · BLOCKED-NO-CREDENTIAL

```
BLOCK 6-trace-attribution  13/13 checks
       BLOCKED on missing credentials: LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY
```

```
langfuse_exporter_wired    True
langfuse_exporter_active   False
langfuse_package           langfuse-langchain@3.38.20 (installed, wired, inert without keys)
trace_spans_written        2
trace_id_present           True
trace_has_git_sha          True
```

Deep Agents inherits LangChain's callback surface, and Langfuse ships an official LangChain `CallbackHandler` (`langfuse-langchain@3.38.20`). It is installed and wired in `deepagents/observability.js`, gated on the two env vars. So this is the **same verdict as leg 1** — a credential blocker, not a missing primitive — and a materially better position than leg 4, where no Langfuse package exists at all.

git-sha attribution is verified independently via a local `BaseTracer` subclass that stamps the sha on every run it observes.

### Case 11 — check-first · PASS

```
check_first_performed            True
persisted_send_found_on_resume   False
slack_posts                      1
blind_retry                      False
tool_selection_events            1
model_calls_after_resume         0
```

Same as the other legs, the fixture's crash point precedes the send. The duplicate-preventing half is asserted separately (`evals/acceptance/wo7-checkfirst-deepagents.js`):

```
Leg 3 (Deep Agents) — check-first SKIPS the send when a record already exists
  PASS  check-first ran
  PASS  existing send record was found
  PASS  send was SKIPPED
  PASS  Slack was never called again
  PASS  no blind retry
  PASS  still exactly 1 recorded post
  PASS  terminal written from persisted response
  PASS  harness was never even invoked
8/8 checks passed
slack fetch impl invocations on resume: 0  (must be 0)
```

Deep Agents ships `createPatchToolCallsMiddleware` (in the default stack) which *"repairs the message history automatically"* if a run is cancelled before a tool returns — history hygiene, not send idempotency. It does not answer "did a previous run already send?", so check-first still lives in our tool against our log. The PRD §5 residual window applies unchanged.

### `budget-exhausted`

```
Leg 3 acceptance — budget-exhausted terminal state (DIGEST_STEP_BUDGET=2)
  PASS  terminal state is budget-exhausted
  PASS  run was reported, not silent
  PASS  no Slack post occurred
  PASS  state left SQL-readable
  PASS  ceiling recorded
5/5 checks passed
```

---

## L3.3 The four primitives under test

| Primitive | Verdict | Detail |
|---|---|---|
| **Approval-pause granularity** | **NATIVE — and the richest of the three** | `interruptOn: { post_to_slack: true }`. `__interrupt__.value.actionRequests[0]` carries `{name, args, description}`; `reviewConfigs` carries `allowedDecisions`. `tool executions BEFORE approval: 0`. Uniquely supports **edit** (amend args before invocation) and **respond**, plus a pre-rendered human-facing description. Requires a checkpointer. |
| **Crash resume, no LLM re-fire** | **NATIVE** | Survives real `SIGKILL`; a fresh process resumes from `thread_id` + the SQLite checkpoint with `Command({resume})`. Byte-identical args, no re-selection, `model_calls_after_resume: 0` via the documented `modelCallLimitMiddleware({exitBehavior:'end'})`. **0.5s.** |
| **Check-first idempotency** | **WORKAROUND (ours)** | No check-first primitive. `createPatchToolCallsMiddleware` repairs message history after an interrupted tool call but says nothing about whether a side effect landed. Implemented against our log. |
| **Schema-mapping friction** | **ZERO forced columns** | Nothing from LangGraph's state model entered our schema. `harness_run_id` (added for Mastra) absorbed the LangGraph interrupt id; the checkpoint store stays at `<db>.langgraph.db` and no probe queries it except to prove it is queryable. |

### TOOL-3 framework-fit gates

| Gate | Deep Agents |
|---|---|
| Does it hide the loop? | **Most, but with the most levers.** The LangGraph pregel loop is fully internal — you get `invoke()` and `Command`, never a `while`. But the middleware stack is a documented, composable interception surface (21 exported middlewares; `createMiddleware` for your own), and `modelCallLimitMiddleware` gives a first-class code-enforced budget guard. More graph machinery to learn than either alternative; more supported places to intervene once learned. |
| Is what it stores queryable from outside it? | **Yes, with archaeology.** Plain SQLite, `type=json`, tool calls and the human decision recoverable by raw SQL — but it is a snapshot chain in LangChain's serializer format, duplicated across 39 rows for a 6-step run, with no compaction or retention story. |
| Can it pause between tool selection and tool invocation? | **Yes, natively, with the richest decision set** — approve / edit / reject / respond, plus a pre-rendered description. |
| Eval and versioning story? | **Strongest of the three.** LangSmith is a first-party eval/observability product, Langfuse has an official handler, `agentevals`/`openevals` exist in the ecosystem, and the middleware stack is separately testable. Also the largest surface to version against: five interlocking packages (`deepagents`, `langchain`, `@langchain/core`, `@langchain/langgraph`, checkpoint saver) each on their own release cadence. |

---

## L3.4 Leg-3 D-rows

| id | Item | Rule | Status |
|---|---|---|---|
| **D-31** | Deep Agents JS is a **separate package** from the Python one | — | `deepagents@1.13.1` from `langchain-ai/deepagentsjs`. Python docs use `interrupt_on` (snake_case); the JS API is **`interruptOn`** (camelCase). Anyone porting a Python example verbatim gets a silently ignored option — the agent would run with no approval gate at all. The most dangerous doc mismatch found in any leg. |
| **D-32** | `npm install deepagents` alone is insufficient | — | The quickstart says `npm install deepagents langchain @langchain/core`. HITL additionally needs `@langchain/langgraph` (for `Command`) and, for durable HITL, `@langchain/langgraph-checkpoint-sqlite`. Neither is mentioned on the HITL page. |
| **D-33** | Checkpointer required, and the documented default is unsafe for crash resume | **LOOP-2** | *"Checkpointer is REQUIRED for human-in-the-loop."* The docs' example is `MemorySaver`, which is in-process — a `SIGKILL` loses the interrupt and the run is unresumable. `SqliteSaver` is required for anything the PRD's case 4 tests, and the HITL page does not say so. |
| **D-34** | `modelCallLimitMiddleware({exitBehavior:'end'})` for "LLM not re-invoked" | **LOOP-3, LOOP-8** | Without it, resume makes 1 concluding model call and case 4 fails on its literal wording. `exitBehavior: 'end'` *"will end the agent"* — documented, typed, and exported, unlike Mastra's `stopWhen` (D-04). Doubles as the code-enforced budget guard. Third leg in a row where this was needed: **all three harnesses make a post-tool concluding model call by default**, and each needed a different mechanism to suppress it. |
| **D-35** | Checkpoint state is duplicated across snapshots | **MEM-8** | 39 checkpoint rows for a 6-step run, with the same tool call present in **5** of them. Readable, but a snapshot chain rather than an event log, in LangChain's `{"lc":1,"type":"constructor"}` serializer format with tool args as a nested JSON string. No compaction machinery and no retention story in the schema. |
| **D-36** | Five-package version surface | — | `deepagents@1.13.1` + `langchain@1.5.10` + `@langchain/core@1.2.9` + `@langchain/langgraph@1.4.12` + `@langchain/langgraph-checkpoint-sqlite@1.0.4`, each independently versioned. Compare Flue's `@flue/*` lockstep at 2.0.3 (with its own pi-ai skew, D-27) and Mastra's `@mastra/*` set. Largest compatibility matrix of the three. |
| **D-37** | Langfuse reachable natively | **STACK-4** | `langfuse-langchain@3.38.20` is an official LangChain callback handler — wired in `deepagents/observability.js`, inert without keys. Case 6 is therefore BLOCKED, not a PRIMITIVE-GAP. Best Langfuse position of the three legs. |
| **D-38** | `interruptOn` supports **edit** and **respond** | **LOOP-5** | Beyond approve/reject, an approver can amend the arguments (`{type:'edit', editedAction:{name,args}}`) or return a synthetic tool result (`respond`). Neither Mastra nor Flue can amend args at the gate. This is *more* than the PRD asks for and worth recording: it would let an operator fix a digest typo without re-running the model. |

---
---

# X. THREE-WAY COMPARISON — Mastra · Deep Agents · Flue

All three legs ran the **same** 12 fixtures through the **same** runner and the **same** validator gate, reusing `tools/*` and `store/*` byte-identically. Only the harness wiring differs.

```
LEG 1  MASTRA       PASS 11   FAIL 0   PRIMITIVE-GAP 0   BLOCKED 1   ERROR 0
LEG 3  DEEP AGENTS  PASS 11   FAIL 0   PRIMITIVE-GAP 0   BLOCKED 1   ERROR 0
LEG 4  FLUE         PASS 11   FAIL 0   PRIMITIVE-GAP 1   BLOCKED 0   ERROR 0
```

*(Leg 2, Claude Agent SDK, was not built. See "Not measured" below.)*

## X.1 Per-gate comparison

| Gate / probe | Mastra | Deep Agents | Flue |
|---|---|---|---|
| **Approval pause between selection and invocation** | **NATIVE** — `requireApproval: true` | **NATIVE** — `interruptOn: {tool: true}` | **SCAFFOLDED — 34 executable lines** |
| Full args visible at the gate | Yes (`suspendPayload`) | Yes (`actionRequests[].args`) | Yes, via `observe()`+interceptor correlation |
| Decision types | approve / decline | **approve / edit / reject / respond** | approve / decline |
| Can the approver amend args? | No | **Yes** (`edit`) | No |
| Human-facing prompt pre-rendered | No | **Yes** (`description`) | No |
| Scaffold lines needed | 0 | 0 | 34 |
| Rests on undocumented behaviour? | No | No | **Yes** (event ordering) |
| **Crash resume (real SIGKILL)** | NATIVE | NATIVE | NATIVE |
| `model_calls_after_resume: 0` via | `stopWhen` — **undocumented**, no exported helper | `modelCallLimitMiddleware({exitBehavior:'end'})` — **documented + typed** | `terminate: true` — **documented**, per-tool flag |
| **Time to recover** | **0.6s** | **0.5s** | 30s |
| Args byte-identical after resume | Yes | Yes | Yes |
| Tool re-selected on resume | No | No | No |
| Persistence required for resume | LibSQL store | **SqliteSaver — docs' `MemorySaver` default is unsafe** | durable adapter in `db.ts` |
| **Native store queryable outside it** | Unverified | **Yes, with archaeology** | **Yes, cleanly** |
| Native store shape | not inspected | graph-state snapshot chain, LangChain serializer, 39 rows / 6 steps, tool call duplicated ×5 | flat semantic event records (`assistant_tool_call`, `tool_outcome`, `submission_settled`) |
| Approval payload durable + readable | not inspected | **Yes** (`__interrupt__`) | Yes (in the stream) |
| Human decision durable + readable | not inspected | **Yes** (`__resume__`) | Yes |
| Compaction / retention story | n/a | **none in schema** | fold checkpoints (unused at this scale) |
| Durable-step primitive | none | none | **`step.do()` exactly-once-recorded** |
| **Check-first idempotency** | ours | ours | ours (`step.do` helps, call-scoped) |
| Residual duplicate window | present | present | present, one layer lower |
| **Langfuse + git sha** | exporter exists, **BLOCKED on keys** | official handler exists, **BLOCKED on keys** | **no package — PRIMITIVE-GAP** |
| Trace/span model | real `trace_id`/`span_id` | LangChain run tree | event stream, correlation ids only |
| **Forced schema columns** | 1 (`harness_run_id`) | **0** | **0** |
| Model test double shipped | No | via LangChain test utils | **Yes (`fauxProvider`)** |
| Eval story | none | **strongest** (LangSmith, agentevals, middleware testable) | `vitest-evals` + adapter contract suites |
| Docs↔code disagreements found | 3 | 3 (incl. **snake_case vs camelCase across languages**) | 3 (incl. a non-working headline example) |
| Docs delivery | website | website | **bundled in the CLI** |
| Package version surface | `@mastra/*` set | **5 independently-versioned packages** | `@flue/*` lockstep + pi-ai skew |
| Custom model endpoint | `OPENAI_BASE_URL` env | `configuration.baseURL` on the model object | custom Pi provider object in code |
| Wire protocol observed | OpenAI **Responses**, non-streaming OK | OpenAI **Chat Completions** | OpenAI **Chat Completions**, **streaming required** |
| Runtimes per process | unlimited | unlimited | **one** |
| Loop ownership (LOOP-1) | framework loop, resume by id | framework graph + 21-middleware interception surface | framework coordinator; `defineWorkflow` **removed** in v2, orchestration pushed to your code |

## X.2 Where each wins

**Deep Agents wins the primitive this bake-off exists to test.** Not only is the approval pause native, it is the only one of the three that lets a human **amend the arguments** at the gate (`edit`) or substitute a tool result (`respond`), and the only one that pre-renders a human-facing approval prompt. It recovers in 0.5s, its loop-ending mechanism is the best documented of the three, and both the approval request and the human's decision land durably in a raw-readable store. It also has the strongest eval and observability position — LangSmith first-party, Langfuse via an official handler.

**Flue wins on durability substance and on the quality of what it persists.** Its stream is the thing the Atelier post-mortem asked for and didn't have: flat, semantic, append-only records — `assistant_tool_call` with full arguments, `tool_outcome`, `submission_settled` — in plain SQLite, with a documented single-authoritative-transcript invariant, satisfying MEM-8 and LOOP-2 by construction. Deep Agents' store is readable but is a snapshot chain that duplicated one tool call across five of 39 rows with no retention story; Flue's is a log you can actually read. `step.do()` is a real exactly-once-recording primitive neither other harness has, it forced zero schema columns, and shipping docs inside the CLI meant the docs I read were the docs I had installed. It is also the only one that removed a workflow abstraction to push orchestration back to the caller, which is the direction LOOP-1 points.

**Mastra wins on nothing uniquely, and that is the finding.** It matches Deep Agents on native approval but with a poorer decision set, matches it on resume speed, loses to Flue on store inspectability (unverified), needs the only undocumented mechanism of the three (`stopWhen`), and is the only leg that forced a column into our schema. It is a perfectly adequate result — 11 PASS — with no axis on which it is the best of the three.

**Where Flue clearly loses:** 34 lines of scaffold for the central primitive, resting on an event-ordering relationship the docs never promise — a Flue release that reorders `tool_start` and the interceptor would break the approval gate *silently*, with only our own V1 args-match validator catching it. Per LOOP-9 that scaffold is a dated assumption to retest on every release. Plus 30s recovery and no Langfuse path at all.

**Where Deep Agents clearly loses:** the largest surface to learn and to version — five independently-released packages, a pregel graph model, and a 21-middleware stack. Its store grows unboundedly with no compaction. And its worst trap is a documentation one: the Python docs say `interrupt_on`, the JS API is `interruptOn`, and passing the Python spelling to the JS package **silently disables the approval gate entirely**. That is a production-incident shape, not an inconvenience.

## X.3 What is not measured

- **No live run on any leg.** No working model credential existed in this session. Every model interaction in all three legs came from the local mock endpoint. Nothing here says anything about real-model tool-selection behaviour, real latency, or real cost.
- **Case 6 unresolved on all three.** Unproven on Mastra and Deep Agents (credentials), needing an unbuilt OTel bridge on Flue.
- **Leg 2 (Claude Agent SDK) not built.** It is Anthropic-only, and the operator has only OpenAI credentials (D-15). With legs 1, 3 and 4 all on OpenAI, provider is currently a confound for any future leg-2 comparison, not just a missing row.
- **Digest quality graded by nobody**, by design — Gate 4 is collapsed (PRD §4), so nothing here compares output quality across harnesses. Only mechanism.
- **Single tenant throughout.** One fixed `resource`/`thread`. MEM-7 is satisfied structurally but multi-tenant isolation was never adversarially tested on any leg, and Flue's "one live owner per conversation" multi-replica constraint was never exercised.
- **One machine, one scale, SQLite everywhere.** The 30s-vs-0.5s recovery gap is a real observation, not a benchmark.
- **Scaffolding overhead not normalised.** Flue's 34 lines are counted precisely; the orchestrator, event log and check-first logic are ~identical across legs and were not separately attributed.

**No overall winner is declared.** That is the operator's call with the gate-5 human read.

---
---

# Y. STATE-1a PROBE — the kill-test with vendor state DELETED

Added 2026-08-25 after reading [`studio-standard-agent-framework` PR #1](https://github.com/The-Utopia-Studio/studio-standard-agent-framework/pull/1), which ratifies **STATE-1a**:

> vendor state is fine if it lands in our Convex schema, is queryable and tenant-keyed, and the kill-test passes **with vendor-local files deleted** — the test is deletion, not shutdown.

**Every crash test in legs 1, 3 and 4 was a shutdown test, not a deletion test.** All three resumed *through* the harness's own store — Mastra's `.mastra.db`, Deep Agents' `.langgraph.db`, Flue's `.flue.db` — which were left intact by the `SIGKILL`. So none of the results above speak to STATE-1a as written. Rather than assert what would happen, the probe was added and run.

```bash
DIGEST_DELETE_VENDOR_STATE=1 node --env-file=.env \
  evals/runner.js --harness=./<leg>/entry.js --case=4-crash-resume,11-post-crash-duplicate-check
```

The flag deletes that harness's own store (plus `-wal`/`-shm`/`-journal`) between the kill and the resume, so a resume can only come from the WO-2 canonical log.

## Y.1 Result

| Leg | STATE-1a verdict | Native resume with vendor state deleted | Observed error |
|---|---|---|---|
| **Mastra** | **PASS, via fallback** | **Fails loudly** | `Error: Agent "linear-digest" resumeGenerate() could not find a suspended run for runId "29eaa86b-…"` |
| **Deep Agents** | **PASS, via fallback** | **"Succeeds" and resumes nothing** | *no error raised* |
| **Flue** | **PASS, via fallback** | **Fails loudly** | `FlueHttpError: Agent instance "digest-4-crash-resume-…" was not found.` |

All six runs (2 cases × 3 legs) passed every graded check:

```
mastra      PASS 2   FAIL 0   PRIMITIVE-GAP 0   BLOCKED 0   ERROR 0   of 2
deepagents  PASS 2   FAIL 0   PRIMITIVE-GAP 0   BLOCKED 0   ERROR 0   of 2
flue        PASS 2   FAIL 0   PRIMITIVE-GAP 0   BLOCKED 0   ERROR 0   of 2
```

with, in every single case:

```
resume_path             workaround: replay persisted args through the portable function
resume_read_from        WO-2 SQLite event log (not the harness store)
args_byte_identical     True
tool_selection_events   1
slack_posts             1
model_calls_after_resume 0
terminal_outcome        posted
```

## Y.2 What this means

**Zero of three harnesses resume natively once their own state is gone.** Not one. The native resume primitives that legs 1, 3 and 4 all recorded as **NATIVE** are native *to a surviving vendor store* — they are not resume-from-our-schema at all. Under STATE-1a as written, the honest per-harness verdict for native resume is **unmet on all three**.

**All three nonetheless pass**, and only because of an architectural choice the PRD forced: the WO-2 event log holds the selected tool and its full arguments, and `tools/*` are plain portable functions with zero harness imports, so the run can be completed *without the harness present at all*. That is the adapter clause working — and it is the strongest available evidence that PRD §5's "our schema is the sole source of truth" was the right call rather than ceremony. The fallback was written as a **workaround** in each leg's `resume.js` and labelled as one; STATE-1a reframes it as the actual conformance path.

**The Deep Agents result is the one to worry about.** Mastra and Flue both fail loudly and unmistakably — a missing run, a missing instance. Deep Agents' `agent.invoke(new Command({resume}), config)` against a deleted checkpoint **raised no error**: `harness_native_resume` recorded `succeeded` while the run did not resume, did not reach the tool, and produced nothing. The fallback then completed the work, which is why the case still passes. Had this harness been trusted without our own log underneath it, the failure mode is a **silent restart presented as a resume** — precisely the "resumes rather than restarts" distinction LOOP-2 exists to protect, failing in the direction that no exception surfaces. Stated conservatively: the call did not throw and the run did not resume; whether it silently began a fresh thread was not instrumented here and is worth a follow-up probe.

## Y.3 Caveats on this probe

- It deletes the vendor **file**, which is the closest local analogue to STATE-1a's intent. It is not a test against a remote vendor store (Convex, Turso, a hosted checkpointer), where "deleted" would mean something different.
- Our store and the vendor store were both local SQLite in the same directory. A deployment where the canonical log is Convex and the vendor store is a Durable Object would need re-probing.
- `tool_selection_events: 1` and `args_byte_identical: True` hold because the selection was persisted before the pause. A harness whose gate fires *after* invocation could not satisfy this at all, deletion or not.
- This probe was **not** run for the other ten golden cases; they have no crash point, so vendor-state deletion has nothing to act on.
