# Harness decision record — `<agent-name>`

Fill this in **before** writing code, from the PRD and work order. Two decisions, each with a
reason checked against the criteria in [`SKILL.md` §1](SKILL.md). **An empty cell fails the
gate** — "we'll decide later" becomes "we defaulted", and both defaults are wrong for some
agents.

Work order: `<id / link>` · PRD: `<link>` · Date: `<YYYY-MM-DD>` · Decided by: `<name>`

---

## What this agent is

| | |
|---|---|
| One-sentence job | |
| Trigger | Agent Inventory request · signal/webhook · schedule |
| Tier | A (skill/project — **stop, no harness needed**) · B · C |
| Module | Product · GTM · Investments · studio-internal |
| Sub-module, if any | |

---

## Decision 1 — does it need a Mastra workflow?

**The question: does losing work mid-flight cost anything?**

| | |
|---|---|
| **Verdict** | **workflow** · **no workflow** |
| Which criterion row applies | |
| What one lost run actually costs | |
| Is a human approving anything? | yes → workflow is not optional · no |
| Does state accumulate across steps? | |

If **no workflow**: the agent is `Agent.generate()` on a trigger, and that is a legitimate,
tested answer — 46 cycles over 41 hours through three sleep boundaries with no workflow at all.
Skip §6's snapshot work and set `expect.workflow = false` in `doctor`.

If **workflow**, map the design onto the primitives:

| Design artefact | Workflow id | Notes |
|---|---|---|
| Master / orchestrator | | `createWorkflow` |
| Sub-module → nested workflow | | own snapshot row, independently resumable |
| Steps calling an agent | | one owned decision each |
| Suspension point(s) | | `resume({ step: ["<nested-id>", "<step-id>"] })` |

---

## Decision 2 — which memory channels?

**Fewest that answer the question.** They compete; each one added makes the model less likely to
maintain the ones that cost it effort.

| Channel | On? | Why this agent needs it — or why it doesn't |
|---|---|---|
| working memory | yes / no | |
| `semanticRecall` | yes / no | |
| `lastMessages` (n) | | |
| module memory layer | yes / no | *what is true about the world* — a different owner |

| | |
|---|---|
| Resource id (memory is per **resource**, not thread) | |
| Working-memory template (bounded — sections + a hint each) | |
| **If semanticRecall is ON:** is the working-memory write deterministic? | **must be yes** |

> If both working memory and semantic recall are on and the write is left to the model, it will
> stop writing. Measured. That is not a risk, it is the observed behaviour.

**Question ownership** — fill one line per channel that is on, and check no two say the same
thing:

| Channel | The one question it owns |
|---|---|
| | |

---

## What gets built

| Piece | Needed? | File |
|---|---|---|
| preflight | **always** | `scaffold/preflight.js` |
| workflow skeleton | if Decision 1 = workflow | `scaffold/harness.js` |
| deterministic memory write | if Decision 2 has working memory | `scaffold/memory.js` |
| freshness check | if Decision 2 has any durable memory | `scaffold/freshness.js` |
| doctor | **always** | `scaffold/doctor.js` |
| `BEHAVIOR.md` | **always** | beside the agent |

```js
// doctor config, from the decisions above
doctor({
  pins:     { '@mastra/convex': '1.5.4', '@mastra/core': '1.63.2' },
  deps:     [ /* every host this agent needs — one host does not prove the network */ ],
  resource: '<resource-id or null>',
  expect:   { memory: /* Decision 2 */ false, workflow: /* Decision 1 */ false },
})
```

---

## Proof this actually works

Not "it ran once". Each line needs a result, not a tick.

| Check | Result |
|---|---|
| `doctor` exits 0 | |
| Durable state read back over **raw HTTP, zero SDK** | |
| *If workflow:* started, `kill -9`'d, resumed in a fresh process from the runId alone | |
| *If memory:* write timestamp **advances** across cycles | |
| *If memory:* `updateWorkingMemory` **offered and called** — from the provider request | |
| *If memory:* recall tested with the **other channels disabled** | |

> The last row is the one people skip. Test recall with everything else off, or you are measuring
> semantic recall and calling it working memory — a mistake that cost this project two days.
