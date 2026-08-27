# Decision — Mastra + Convex, and the path into the Product Framework

**Date:** 26 August 2026  
**Status:** Accepted  
**Scope:** Tier B/C coded agents. Skills, projects, and managed surfaces remain lighter-weight paths.

## Decision

**Mastra + ConvexStore is the Studio standard harness for coded agents.**

This is not a choice between Mastra and Convex. They do different jobs:

| Layer | Standard role |
|---|---|
| Mastra | Runs the agent loop, tool selection, approvals, and resume flow |
| Convex / ConvexStore | Holds canonical, tenant-keyed durable state, append-only event history, and business data |
| Langfuse | Records model traces, tool activity, and cost |

Mastra's local/default LibSQL state is not approved as canonical production state. A
qualifying coded agent uses `ConvexStore` and proves its own recovery with a hard kill
and a fresh process.

## Why this is the Studio standard

The decision follows the Mastra-on-Convex STATE-1a conformance result:

- a live Kimi K2.6 run was suspended before an external tool action;
- its process was terminated with `SIGKILL`;
- a fresh process resumed the persisted run from Convex;
- no model call was repeated after resume;
- no duplicate Slack action was produced; and
- an independent process read the suspended state directly from Convex.

The full evidence and corrected-measurement history remain in
[`docs/bakeoff/findings-mastra.md`](../bakeoff/findings-mastra.md). The decision does
not claim that Mastra is universally superior. It makes Mastra the Studio default
because it meets the required durability standard in the tested configuration.

## What remains required

Selecting a standard does not remove per-agent engineering discipline. Every Tier B/C
agent still needs:

- an explicit job, owner, runtime home, talk surface, and tool identity;
- golden and adversarial evaluations separate from the generator;
- a canonical Convex event log and idempotent external actions;
- a hard-kill, fresh-process recovery test; and
- a dated, evidence-backed waiver if it uses another harness.

## Product Framework relationship

The Agent Framework and the Studio Product Framework have different responsibilities.

| System | Owns |
|---|---|
| Agent Framework | Intake, rung selection, workflow/agent design, eval-first specification, PRDs, work orders, and runtime rules |
| [Studio Product Framework](https://github.com/The-Utopia-Studio/studio-product-framework) | Product UI, identity, Convex control plane, billing, sandboxing, deployment, observability, and reusable application capabilities |

The Agent Framework remains the canonical repository for the methodology. The Product
Framework should later expose it as an Agents module, rather than copying the rules into
another repository.

The intended integration seam is:

```text
Agent Framework intake
  → rung decision + PRD + eval plan
  → Product Framework Agents module
  → Convex action: identity, policy, rate limit
  → Effect fence when money, inference, or delivery is critical
  → Mastra loop + ConvexStore
  → durable events, outcomes, approvals, and traces
```

`@studio/ai-runtime` is not replaced by Mastra. Its sandbox, model-gateway, and metering
responsibilities remain Product Framework concerns. Mastra is the agent-orchestration
layer. A future vertical must verify this seam before it becomes a packaged runtime
capability.

## UI direction

A UI will make the framework usable by more people, but it should be a **front door and
operating surface**, not a second framework or a generic chat dashboard.

The eventual Utopia OS Agents module should let a fellow:

1. start with “I want an agent” and complete a short intake;
2. receive the smallest appropriate path: skill, project, managed surface, or coded agent;
3. review the generated specification, evaluations, owner, permissions, and cost/risk;
4. launch or hand off a coded agent built on the approved starter; and
5. see its runs, approvals, outcomes, failures, and learnings in one registry.

Until that module exists, the repository skills are the authoring interface. The first
product-module scope should define the handoff contract: the exact intake record, PRD,
agent manifest, registry entry, and run-event shape shared between the two frameworks.

## Revisit condition

Revisit this decision only if the current configuration no longer passes the required
conformance tests, or another harness demonstrates a better result against the same suite
and operational requirements.
