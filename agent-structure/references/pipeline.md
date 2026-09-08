# Studio build pipeline contract

Current contract: 2026-09-07. This governs the seven existing stages and agent-structure.
User instructions and existing authorization remain controlling. Follow this contract over
conflicting historical examples in bundled skills. Standalone stage calls load it as well.

## One persisted carrier

At intake create `build-state.json`: schema_version `1.0.0`, agent_id, job, owner, rung,
profile (`skill`, `managed`, `coded`), evidence_profile, runtime_home, talk_surface, tool_identity,
implementation_authorized, stage, blockers (array), decisions (object), and artifacts (object of
relative paths). Persist updates between stages; do not rely on the conversation alone.
Artifact keys: workflow, agent_spec, eval_contract, prd, work_orders, manifest (coded only).
Also retain data profile, input/output, source evidence, and context/memory choices in decisions.
Do not invent unknown answers. Save incomplete intake as a draft with explicit blockers.

## Stage transitions

| Stage | Must consume | Must produce / prove |
|---|---|---|
| Intake | User request and existing artifacts | Carrier, smallest rung, security/data scope, authorization |
| Workflow | Carrier | Solo verdict or explicit bounded workflow; skip a fleet without need |
| Agent design | Carrier + workflow | Role, typed tools and identity, optional memory with reasons |
| Evaluation | Confirmed job + examples | Profile-specific fixture plan, graders, cost, failure conditions |
| PRD | Prior artifacts | PRD + work orders; coded agents also emit valid AgentManifest |
| Structure | Rung + manifest if coded | Repository profile, real files and dependency boundaries |
| Implementation | Validated contract + authorized work | Working artifact; actual agent-specific checks |
| Verification | Generated artifact + its checks | Observed results, blockers, operational owner |

Never mark implementation complete because a PRD or scaffold exists. If the user requested
implementation, continue when applicable gates pass. Stop after planning only when that was the
request or a specific missing decision blocks dependent work. Re-evaluate rung and evidence if
scope gains persistence, autonomous actions, sensitive data, or greater impact.

Coded agents: validate the manifest before implementation; consume it when configuring packages,
storage, memory, tools, budget and proof checks. Emit a new hash after reviewed design changes.
`node harness/run.js --manifest=<path>` validates declarations and reports runtime checks incomplete.
For release, use `--release --checks=<actual-agent-proof-module>` plus applicable package/adapter
checks. Modules are explicitly supplied by the operator, never executed from manifest strings.
Analogous bake-off fixtures cannot establish the generated agent's safety or output quality.

## Evidence proportional to risk

| Profile | Eligible use | Minimum useful evidence |
|---|---|---|
| prototype | Reversible, reviewed internal skill; no autonomous external writes or private cross-user access | 3 representative examples, 1 boundary/refusal example, explicit human review; label provisional |
| reviewed | Real operational assistance with a human committing every action | 10 cases across normal, edge, and refusal behavior, real examples where available, named reviewer, budget and identity checks |
| production | Autonomous/consequential effects, sensitive multi-user data, durable background service | Full eval-first-spec production bar (20+ cases, 14 real inputs), per-risk security and recovery checks, actual-agent evidence |

These counts are Studio starting gates, not statistical confidence guarantees. Repeat trials and
sample production behavior as appropriate to the failure rate being claimed. Synthetic adversarial
cases are useful when explicitly labeled. Do not fabricate real evidence. Missing examples block
production promotion, not a clearly labeled prototype. Cost estimates may be assumptions at prototype
stage; measured cost per completed outcome is required before claiming production economics.

## Rule and dependency handling

`learnings` is the current rule set; archived examples do not override it. Memory is optional;
load only the invariant core and selected material. Working summaries may be rebuilt; versioned
procedures and source evidence retain provenance. Do not force an agent to use a memory-write tool
when deterministic code owns the write.

Optional external skills (wedge-five-questions, refine-flywheel, domain design skills) are not
bundled requirements. If unavailable, perform the needed narrow step inline: establish a real user
and example workflow before production planning; after launch, collect failures, review changes,
and rerun evaluations. Never pretend an absent skill loaded, and do not block solely on its name.

## Check saved state and completion

Run `node harness/pipeline.js <agent-repo>/build-state.json` from the framework checkout before
advancing. `stage` is the stage being entered; its required previous artifacts must exist. Before
structure for a coded build, record `manifest_hash` as SHA-256 of `JSON.stringify(parsedManifest)`.

To enter `complete`, all profiles add `artifacts.deliverable` (the built entry file) and
`artifacts.evaluation_result` (JSON). The evaluation result contains `agent_id`, `evidence_profile`,
`status: passed`, a named `reviewer`, `artifact_hash` (SHA-256 of the deliverable bytes), and `cases`.
Each case has unique `id`, `status: PASS`, `band` (typical/edge/adversarial/must-refuse), and
`source` (real/synthetic). Meet the selected profile's count and coverage; these fields record
reviewed evidence and must never be invented to satisfy the checker. Coded builds additionally
require `artifacts.conformance` from the release runner, with passing actual-agent fixture evidence.
A valid carrier proves these records agree; it does not authenticate a dishonest reviewer.
