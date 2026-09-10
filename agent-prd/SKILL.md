---
name: agent-prd
description: Interview the user and produce an Agent PRD — the planning document that must exist before any agent code is written. Use when the user wants to build, scope, spec, or plan a new agent, generator, critic, pipeline stage, harness, or autonomous system; when they say "new agent", "agent PRD", "spec this agent", "plan this agent", "I want to build an agent that...", or ask what questions they should answer before starting. Also use when an existing agent is being rebuilt or a stage is being added to a pipeline. Do not use for writing agent implementation code — this skill produces a document only.
---

# Agent PRD

**Directory and harness handoff.** The PRD must produce the fields for the Agent
Directory record: job, owner, audience/data profile, runtime home, approved tools,
evaluation status, and evidence. The Directory is a registry, not permission. For
coded agents, work orders must name the deterministic harness inputs: the manifest,
exact version pins, named fixtures, and fixed pass/fail graders. That makes a release
verdict reproducible rather than a judgement call.

Turn confirmed agent decisions into a buildable PRD, work orders, and (for coded agents)
a validated AgentManifest. Load `learnings` and [the pipeline contract](../agent-structure/references/pipeline.md).
Use the intake carrier; ask only for facts that are still missing. Preserve user authorization.

## Required outputs

- `docs/agents/<id>-PRD.md`: job, non-goals, owner, input/output, run sequence, evaluation,
  runtime home, tool identity, context/memory, budget, risks, and decisions with reasons.
- `docs/agents/<id>-WORKORDERS.md`: sequenced implementation tasks with testable completion.
- Rung 4: `agent-manifest.json`, valid against [the schema](../schemas/agent-manifest.schema.json),
  plus typed input and real agent-specific evaluation fixtures in the generated repository.
- Update `build-state.json` with artifact paths, current stage, blockers, and evidence profile.

## Read only what this build needs

1. For unanswered intake questions, read [interview guidance](references/interview.md).
2. Select `prototype`, `reviewed`, or `production` evidence using the pipeline contract.
   Read relevant [engineering gates](references/gates.md); do not reopen already-confirmed choices.
3. Fill [the PRD template](assets/prd-template.md). For low-risk skills use its applicable
   sections as a short checklist; mark omitted runtime concerns not applicable with reasons.
4. For document creation, read [output formats](references/output-contract.md) and
   [diagram guidance](references/delivery.md). Follow an explicit user format preference.
5. Write [work orders](references/work-orders.md) only after the applicable planning gates pass.
6. Consult [lessons and reference tables](references/lessons-and-tables.md) only for a specific uncertainty.

## Manifest handoff — required for coded agents

Use [the reference manifests](../examples/manifests/) as shape examples, not agent evidence.
Derive the manifest from confirmed decisions. Never copy their owner, tools, tests, or proof claims
into a new agent. Validate with `node harness/run.js --manifest=<path>` from the framework checkout.
Contract validity permits implementation; an `incomplete` result means runtime proof remains.
Record the manifest content hash on the carrier. The implementation stage must consume this exact
manifest, and update it with reviewed decisions before changing runtime configuration.

## Gates and completion

Every build names a useful job, a concrete output, owner, evaluation, identity, and the smallest
implementation profile that can deliver it. Coded builds additionally define typed I/O, bounded
execution, applicable durable state, external-effect semantics, and memory ownership.
Unanswered safety or correctness decisions block the affected work; label a draft as a draft.
A production release requires observed evidence for every applicable check, not merely a valid manifest.

When implementation is authorized, hand the carrier, PRD, manifest, and ready work orders to
`mastra-harness`. Do not ask again for permission already supplied by the user. When only planning
was requested, deliver the requested artifacts and name the next stage.
