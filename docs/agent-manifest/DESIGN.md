# Agent Manifest v1 — the checkable seam

**Status:** proposed design, 2 September 2026.  
**Scope:** rung-4 coded agents. This design does not modify the three bundled Icarus skills.

## Decision

The right framing is that a chat skill cannot mechanically enforce its own instructions. That is a property of the medium, not a repository defect. The enforceable object is the artifact handed from planning to implementation. `AgentManifest` is that object.

It is not a policy engine and not a second PRD. It is the narrow, versioned contract that records decisions a checker can inspect: audience/data profile, runtime and exact pins, identity, effects, durable state, memory choice, budgets, fixture references, required proof checks, and evidence provenance.

It must not turn a stated fact into a passing fact. Every conformance claim is `verified`, `unverified`, `corrected`, `unenforced`, or `not-applicable`. A verified claim requires an actual check; an unenforced claim requires `enforcement: none` and an explanatory note. A check always names its failure condition.

This proposal adds:

- [`agent-manifest.schema.json`](../../schemas/agent-manifest.schema.json), a Draft 2020-12 schema.
- [`tech-news-reference.agent.json`](../../examples/manifests/tech-news-reference.agent.json), a real reference profile whose runtime and raw evidence are external to this repo.
- [`approval-gated-module.agent.json`](../../examples/manifests/approval-gated-module.agent.json), an intentionally unverified approval-gated module.

## Field discipline

| Area | Decision recorded | Checker can reject | Excluded because it is not yet checkable or decision-useful |
|---|---|---|---|
| `agent` | job, owner, scope | missing owner/non-goal | persona and prompt prose |
| `lifecycle` | rung, home, surface, trigger, tool identity | schedule lacking operational controls | secrets and credential values |
| `security` | audience/data profile, principal, allowed data, tool allowlist, baseline and profile checks | undeclared tool, incomplete scope boundary, missing fellow/admin proof | actual authentication and database authorization, which the deployed runtime must enforce |
| `runtime` | harness, exact pins, workflow decision | semver range, approval with no workflow, alternative with no waiver | framework internals owned by an adapter |
| `tools` | effect, identity, idempotency, approval | outward write without idempotency/approval | natural-language tool descriptions |
| `state` | canonical store, tenancy, log, memory | non-append-only log; working memory missing deterministic write/freshness/behavior checks | duplicate memory-taxonomy fields |
| `operations` | preflight, health_statuses, spend cap | scheduled agent with no preflight; incomplete health status set; no hard cap | pager routing, not yet proven/standardised |
| `evaluation` | fixtures and behavior gate | no fixture or failure condition | subjective judge calibration until packaged |
| `conformance` | claim status and proof mechanism | impossible-to-fail “check”; verified-but-unenforced claim | pass booleans, which rot silently |
| `evidence` | whether proof is rerunnable | hidden external-only evidence | credentials, raw private traces, source data |

The schema validates declarations and checkability, not a running agent. TUS-2767’s `harness/run.js` validates the manifest, runs its selected golden fixtures through an explicitly supplied adapter, consumes the adapter report, and writes a dated result. It never executes command text from a manifest.

## Placement in the existing lifecycle

The manifest wraps the chain; it does not require edits to third-party skills.

| Stage | Reads | Writes / gate |
|---|---|---|
| `agent-builder` | — | carrier holds job, owner, home, surface, identity, rung; no wedge/traces means no manifest |
| `workflow-design` | carrier | fleet result and observable triggers; no harness choice yet |
| `agent-design` | carrier | per-agent tools, memory ownership, evaluation pointer; missing decision means incomplete draft |
| `eval-first-spec` | carrier | fixtures, thresholds, grader type; no eval means unverified, never release-ready |
| `agent-prd` | carrier + draft | **first writes `agent-manifest.json`** from confirmed decisions; schema validity is required before work orders |
| `mastra-harness` | manifest | consumes runtime/state/operations/conformance to configure scaffold and proof checks; mismatch fails the work order |
| `harness/run.ts` | manifest + adapter | writes dated conformance result; observed failure is non-zero, never coerced to pass |

The PRD is still the explanation and rationale. The manifest is its selected machine-readable subset. Do not generate a PRD from a manifest; generate harness config and a PRD checklist from it, to prevent drift.

## Existing bake-off relationship

The bake-off already supplies a real execution contract: every leg implements `run(fixture, ctx) -> report`, and one runner grades shared fixtures. The manifest is not a replacement or a superset.

```text
PRD decisions → AgentManifest → selected checks + fixture refs
                                      ↓
                       adapter: run(fixture, ctx) -> report
                                      ↓
                         shared bake-off / behavior graders
                                      ↓
                         dated conformance result
```

The manifest consumes the bake-off contract through `evaluation.adapter_contract` and adds per-agent facts the generic bake-off correctly does not know: owner, identity, pins, memory choice, cost cap, and evidence status. TUS-2767 fits this design exactly: it becomes the manifest consumer, not a rival manifest format.

See [`SECURITY-PROFILES.md`](SECURITY-PROFILES.md) for the distinction between internal-team, fellow-scoped, public, and privileged-admin agents. Runtime home is a separate decision: an agent can run in Utopia OS without being fellow-facing.

## Concrete failures it prevents—and does not

| Observed failure | Relevant fields | Catching gate | What it catches | Limit |
|---|---|---|---|---|
| Nine green cycles with no durable-memory write | `state.memory.deterministic_write`, `freshness_check`, `write_behavior_check`, `behavior_eval` | `mastra-harness`; then runner/compiler | Design cannot declare working memory without timestamp and offered-and-called checks; runner later catches stale/missing writes | JSON cannot observe timestamps or provider requests. The real reference is therefore `unenforced` until a runner exists. |
| Docs asserted core 1.63.2/exact convex 1.5.4 while package had 1.61.0/caret | `runtime.packages[].version` and pin check | schema then `harness/run.ts` | Schema rejects `^1.5.4`; runner compares manifest to package and lockfile | It cannot stop prose drift unless docs/checklists are generated from the manifest. |
| DarkWake caused 44-minute hang, `failed` instead of `offline`, orphaned snapshots | scheduled trigger; `operations.preflight`, `health_statuses`, preflight record check | schema then adapter test | Schedule without preflight is invalid; all four statuses are mandatory; runner can demand a preflight event | It cannot prove preflight ran before workflow or clean snapshots without an instrumented trace. |

This is why the manifest is a completeness and drift-control mechanism, not a substitute for the memory, pin, or DarkWake tests. The pin is directly checkable once the runner exists. The memory and DarkWake safeguards remain runtime evidence.

## Build sequence and adoption bar

1. **Week 1: schema and negative validation tests.** Reject a semver range, a scheduled agent without preflight, an outward write with `not-needed` idempotency, and a verified claim with no enforceable check.
2. **Week 1: TUS-2767 minimal runner.** Compare pins against `package.json` and lockfile; run the existing behavior test and mock bake-off; emit verified/failed/unenforced rather than a boolean.
3. **Next: one current coded agent.** Have `agent-prd` wrapper material produce a manifest without changing Icarus source skills.
4. **Then CI.** Run only self-contained schema/mock tests, and label external-only evidence rather than promoting it to a 12/12 live pass.
5. **Later: evidence bundles.** Redacted traces/events, reproducible environment instructions, and a credentialed long-running test are a separate evidence-product effort.

Call it adopted only when two coded agents with opposite workflow decisions have reviewed manifests, the runner fails the three intentionally bad cases above, reports evidence provenance honestly, and the PRD checklist is generated from the manifest.

## Priority order for this repo now

1. **Resolve licence/redistribution rights.** Agreed: this is above CI because the pack is already distributed as a zip and the LICENSE explicitly makes bundled Icarus coverage conditional.
2. **Make live evidence reproducible—or label it external-only.** This is above ordinary CI. Mock CI proves regression protection, not the 41-hour or live 12/12 claims.
3. **Schema plus validator.** This gives TUS-2767 a stable input and stops design/runtime drift.
4. **Runner over existing checks.** It changes declarations into observed results.
5. **CI over those runnable checks.** CI is valuable only if it preserves the provenance boundary instead of laundering external evidence into a green repository badge.

The manifest is adjacent to reproducibility, not a remedy for it. It can force every claim to state `third-party-rerunnable`, `internal-rerunnable`, `external-only`, or `not-run`. It cannot recreate missing agent code, raw traces, credentials, or the original long-running environment. That work belongs above normal CI because it supports the framework’s strongest claims.
