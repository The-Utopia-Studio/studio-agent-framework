> Apply the current [pipeline contract](../../agent-structure/references/pipeline.md) first. It defines the proportional evidence profile and manifest handoff; historical examples below do not override it.

## Closing behaviour

After delivering the PRD:

1. State where it is (path) or that it is above (chat).
2. List the blocking open questions in one short block — no more than five lines.
3. **Report the gate result honestly.** If engineering gates were skipped, say the
   document is a strategy doc rather than a buildable spec, and name what is missing.
   A PRD that reads well and cannot be built from is worse than an obviously unfinished
   one, because nobody goes back to it.
4. Offer work orders **only if** the hard gates are met. If not, offer to close the gaps
   instead. **Do not decline work orders on the grounds that the build has no code** —
   rungs 1–3 use the S-spine. If the PRD's own setup checklist is being treated as the
   work orders, check whether the actual construction has collapsed into one line. It
   usually has.
5. Do not begin implementing. If implementation is already authorized, continue after the applicable gates pass; otherwise stop at the requested planning deliverable.

After delivering work orders:

1. State the path, the ready-now orders, and the first one to pick up.
2. Restate the M1 baseline number that later scaffolding has to beat.
3. Continue into mastra-harness when implementation is authorized; otherwise report the ready work orders and stop.

---

## Appendix C — Studio defaults and use (do not re-decide per PRD)

Load `learnings`. Rule IDs win over this table if they conflict.

**Authoring ≠ runtime.** Cursor / Claude Code write files. They do not run production.

| Decision | Default | Notes |
|---|---|---|
| Runtime home | Utopia OS for studio-operated functions | Vercel standalone if it cannot live in OS (library *links*). Local Claude/Codex/Cursor when the machine is the point. |
| Talk surface | Named separately | OS UI, Slack, schedule, CLI |
| Simple loop | Vercel AI SDK `ToolLoopAgent` or none (skill) | Tier A / rungs 1–3 |
| Runtime harness (rung 4) | **Mastra + ConvexStore** | Studio standard for Tier B/C. Mastra runs the loop; Convex is SoT. Alternative requires a dated, evidence-backed waiver and the same STATE-1/STATE-1a proof. |
| Graph / multi-node | Not the default | Only with a written why a single loop fails (TOOL-2) |
| Event log + business data | Convex | One store. Kill-test: fresh process resumes from the log. |
| Durable exec | Trigger **or** Inngest | First 600s pipeline picks one |
| Trace | Langfuse + git sha | From commit one |
| Tools, studio/team | Shared Composio or service API | Writes need an owner |
| Tools, fellow | Per-user Composio session | Later on OS; not the studio account |
| Context | Pull on demand | Prefetch into the log only if already known (CTX-2b) |

PRD sections 5, 6, 7 must fill: durable store = Convex; context route; four memory tiers mapped to Working / Episodic / Compounding. Empty cell fails the gate.
