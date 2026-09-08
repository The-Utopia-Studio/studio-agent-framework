> Apply the current [pipeline contract](../../agent-structure/references/pipeline.md) first. It defines the proportional evidence profile and manifest handoff; historical examples below do not override it.

## Appendix A — Traps that produced this document

Each of these cost real sessions. Ask about them by name when the design gets close.

1. **Prompts inlined or compiled at build time.** Edits to the prompt file had no
   effect at runtime because the loader returned stale bundled strings. Three runs
   went out with the wrong rules. → Read prompt content at runtime, or assert a
   content hash so staleness is loud.

2. **Truncated source fields.** A palette field contained `"primary:"` — a broken YAML
   fragment — for three consecutive runs, so the agent silently invented its own
   palette each time. → Validate critical fields are non-empty and non-truncated
   before the run.

3. **Authority gaps.** A fallback font table sat after a "use the brief's fonts" rule.
   The model read the table and confirmed the wrong font instead of copying from the
   brief. → Gate every fallback with "only if absent".

4. **Saving after the expensive step.** The artifact was written after the critic ran;
   a timeout killed the action first. No artifact, no deploy, generation wasted. →
   Save straight after validation.

5. **Unawaited async calls.** A missing `await` on a mutation left a dangling promise
   and timed out the whole run. → Await everything.

6. **Non-critical work blocking the critical path.** A scheduled embedding job threw
   inside the save path and took the save down with it. → Wrap non-essential work in
   try/catch; it must never block persistence.

7. **A recompile step skipped on the retry path.** The brief was not recompiled after
   a brand direction changed, so the generator used the previous approval's fonts. →
   Every path that changes an upstream artifact must trigger the recompile.

8. **Section ordering in the prompt.** Route requirements loaded after the archetype
   pack, so the model had already committed to a layout before reading what each page
   needed. → Source of truth first, requirements before vocabulary.

9. **Generic validator messages.** "Invalid file" produced the same mistake on three
   retries. → Say what to fix and how.

10. **No version control until week three.** No rollback, no diff, no recovery from a
    bad session. → `git init` before the first line of code; commit after every
    session.

11. **A round cap standing in for a quality gate.** "Two revise rounds then accept
    best effort" means the loop always passes eventually. → Pair every budget with a
    real success condition.

12. **The generator grading itself.** Self-assessment reliably skews positive, badly
    so on subjective work. → Separate the evaluator, and tune it to be skeptical.

---

## Appendix B — Reference tables for the interview

Read these to the user when they need the options.

### Complexity tiers

| | Tier A | Tier B | Tier C |
|---|---|---|---|
| Shape | One job, <10 steps, one request | Multi-stage, human gates, minutes–hours | Subjective quality, must improve over time |
| Loop | Framework loop fine | Own the loop, single-step over a durable log | Generator/evaluator plus an outer optimisation loop |
| Durability | Not needed | Required | Required, plus held-in/held-out splits |
| Memory | Message array plus a managed tool | All four tiers | Add reflection over the playbook |
| Evaluation | Spot checks plus tracing | 20–50 task suite in CI | The suite is the optimisation target |
| Do not | Build a harness | Let a framework hide control flow | Start here |

### Topologies

| Shape | Good for | Fails at | Cost |
|---|---|---|---|
| Single loop | Almost everything | Work exceeding one context window that cannot be chunked | Baseline |
| Pipeline / staged | Stable order, auditability, human gates | Revisiting an earlier stage, branching on content | Baseline |
| Orchestrator–worker | Breadth-first, many independent paths | Tightly interdependent work, coherence across outputs | 3–10× single agent |
| Parallel fan-out | Independent chunks, racing candidates | Chunk B depending on chunk A | Linear in branches |
| Graph / node | Real branching, several specialists, cross-session state | Simple tasks — the structure becomes maintenance | Baseline plus orchestration |

*A loop is already a graph — one whose path returns to an earlier node. A loop is one
node; a graph is several. The question is how many nodes the problem actually has.
Usually one. What the graph framing is right about — typed state instead of a loose
dictionary, explicit conditional edges instead of transitions buried in code,
persistent checkpoints — can all be had inside a single-agent loop.*

### Loop patterns

| Pattern | What closes it | Reach for it when |
|---|---|---|
| Tool loop (ReAct) | Model stops calling tools, or a step ceiling | Default, Tier A |
| Plan–execute–verify | Every planned item verified | Knowable shape; model under-scopes |
| Self-critique | Agent declares itself satisfied | Cheap polish only — weakest pattern |
| Generator–evaluator | All criteria clear thresholds | Subjective quality, unreliable self-assessment |
| Contract-first | The agreed contract is satisfied | High-level spec needing testable claims |
| Reflexion | Success, or the lesson stops changing | Failures are informative and recoverable |
| Fan-out / fan-in | All branches returned and merged | Independent chunks, racing approaches |
| Jury | Consensus or threshold | Grading only, never generation |
| Human-gated | Human responds; loop resumes from the log | Irreversible or taste-dependent decisions |
| Outer optimisation | No regression on held-in **and** held-out | Tier C only, once evals exist |

### Memory tiers

| Tier | Holds | Lifetime | Read path |
|---|---|---|---|
| Working context | Current window | One call | Assembled per call, never accumulated |
| Episodic | Full-fidelity event log | Forever, per run | Positional slices on demand |
| Semantic | Durable facts and decisions | Forever, per tenant | Retrieved by relevance, tenant-scoped |
| Procedural | Learned how-to | Forever, per system | Pulled by name, small always-on core |

### Exit conditions

| Kind | Example | Role |
|---|---|---|
| Verifiable | Tests pass, build succeeds, 200 response | Best. Use wherever it exists |
| Threshold | Every criterion at or above bar | Necessary for subjective work |
| Budget | Step, token, time, or cost ceiling | Safety net, never a success condition |
| Stall | No improvement across N rounds | Stop and escalate rather than spend |

---

