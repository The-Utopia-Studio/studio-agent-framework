> Apply the current [pipeline contract](../../agent-structure/references/pipeline.md) first. It defines the proportional evidence profile and manifest handoff; historical examples below do not override it.

## The Agent PRD template

Produce exactly this structure. Keep the section numbers. Omit a section only if the
tier makes it genuinely inapplicable, and say so rather than deleting it.

````markdown
# Agent PRD — <Agent Name>

**Status:** Draft | Approved
**Tier:** A | B | C
**Topology:** single loop | pipeline | orchestrator–worker | parallel fan-out | graph
**Owner:**
**Date:**
**Supersedes:**

---

## 1. Job

**One sentence:**

**Input:** <exact object, with required fields>

**Output:** <exact artifact — shape, count, format>

**Non-goals:**
- <not this>
- <not this>
- <not this>

**Failure severity:** <wasted tokens | broken build | user-visible embarrassment | harm>
and what that implies for validation strictness.

**If a human must act on the output:** <what happens on the next run if they didn't>

---

## 1B. Run sequence — agent checklist

*One table per job. Keep these four columns.*

### <Job name, if more than one>

| # | Step | Trigger | Auto / Pause |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |

**Pauses:** <count, and who owns each>
**If a pause never resolves:** <what happens, who is told>

![Run sequence](run-sequence.png)

![Systems map](systems-map.png)

---

## 2. Success and evals

**A good run looks like:** <specific enough for two people to agree>

**A failed run looks like:** <exact failure signature>

**Stress input:** <the hardest realistic case>

### Task bank

| id | input | expect | graders | severity |
|---|---|---|---|---|
| | | | | |

### Graders

**Deterministic:** <list of mechanical checks>
**Model rubric:** <dimensions, one judge each>
**Human:** <who, how often, on what>

**Where the suite runs:** <script, CI, on every change to what>

---

## 3. Loop

**Pattern:** <tool loop | plan-execute-verify | generator–evaluator | contract-first | reflexion | fan-out/fan-in | jury | human-gated | outer optimisation>

**Exit conditions:**
- Verifiable: <or "none — subjective task">
- Threshold: <criteria and bars>
- Budget: <steps / tokens / wall-clock / cost>
- Stall: <no improvement across N rounds → action>

**On ceiling hit:** <who is told, what state the artifact is in>

**Pivot policy:** <may the generator abandon a direction, or only refine>

---

## 4. Evaluation design

| Criterion | Weight | Threshold | Graded by |
|---|---|---|---|
| | | | |

**Evaluator access:** <deployed URL / rendered artifact / source — and why>
**Calibration:** <few-shot examples, who owns them>
**Separation:** confirm the generator does not grade its own output.

---

## 5. State and durability

**Event schema:** <fields appended, and when>
**Durable store:** <named>
**Save point:** <exactly where, and why it is before the expensive step>

### Timeout budget

| Step | p50 | p95 | Notes |
|---|---|---|---|
| | | | |

**Worst case total:** <and whether it fits the platform ceiling>

### Recovery

| Stage | If it dies here | Resume or restart |
|---|---|---|
| | | |

### Auto vs human

**Automatic:** <steps>
**Human gate:** <steps, and the pause mechanism>

**Idempotency:** <which steps are retried, and what makes them safe>

---

## 6. Context and authority

### Authority table

| Decision | Source of truth | Fallback if absent |
|---|---|---|
| | | |

**Authority gaps and their gating text:** <each example block that needs an "only if absent" prefix>

### Context budget

| Item | Size | Preloaded or pulled | Priority |
|---|---|---|---|
| | | | |

**Assembled total at largest realistic input:** <vs the ceiling>

**Excluded despite being available:** <and why>

**Pre-run field validation:** <which fields are checked for empty / truncated / sentinel, and the assertion that the value reached the prompt>

---

## 7. Memory

| Tier | What it holds | Store | Lifetime | Read path |
|---|---|---|---|---|
| Working context | | — | one call | assembled per call |
| Episodic | | | | |
| Semantic | | | | |
| Procedural | | | | |

**Write rules:** <append-only, provenance, diff-before-edit, failures captured>
**Contradiction policy:** <how resolved, and whether the conflict is surfaced>
**Never remembered:** <list>
**Tenancy:** <key, index, enforcement>

---

## 8. Tools and integrations

| Tool | Does | Returns | Notes |
|---|---|---|---|
| | | | |

**Ambiguity check:** <any pair a human could confuse, and how it was resolved>
**External APIs:** <rate limits, failure modes>
**Secrets:** <what, where — and confirmation they are not in the wrong place>
**Credential failure behaviour:**
**Fan-out and cost caps:** <enforced where>

---

## 9. Guardrails

### Validator checklist

```
CHECK:
IN:
THROW:
```

**Hallucination watch list:** <five most likely for this task>
**Protected paths:** <never written or modified by this agent>
**Escalation cost:** validator free → evaluator $X → build failure Y min → production ∞

---

## 10. Build order

**Before any code:** <eval tasks written, schema defined, criteria written>
**First milestone:** <baseline with no scaffolding, and the number it must beat>
**Then:** <ordered, each item verifiable>
**Observability from commit one:** <tracing tool, what is logged>
**Done means:** <the specific condition>

---

## 11. Open questions

| # | Question | Why it matters | Owner | By |
|---|---|---|---|---|
| | | | | |

**Blocking:** <any question that must be answered before starting>

---

## 12. Decisions and rationale

| Decision | Chosen | Alternatives considered | Why |
|---|---|---|---|
| Tier | | | |
| Topology | | | |
| Loop pattern | | | |
| Memory store | | | |

*Each scaffold component in this design encodes an assumption about what the model
cannot do on its own. Record the assumption so it can be retested when the model
changes.*
````

---

