# Long-horizon agents

Everything the framework knows about agents that run for **minutes to days** rather than one
request — the harness they run on, how their memory works, and how their conduct gets graded.

Tier B/C coded agents only. Skills, projects and managed surfaces stay on lighter paths.

| File | What it answers |
|---|---|
| [`HARNESS.md`](HARNESS.md) | Which harness, pinned to which versions, and what has actually been proven on it |
| [`MEMORY.md`](MEMORY.md) | How a long-horizon agent remembers across processes, and what that costs |
| [`BEHAVIOR.md`](BEHAVIOR.md) | How agent conduct gets graded, and the plan to wire it in |
| [`research/`](research/) | Source research behind the above, with dates |

---

## Why this folder exists

The framework already had a harness decision ([26 Aug](../docs/decisions/2026-08-26-mastra-convex-and-product-framework.md))
and a kill-test rule (STATE-1 / STATE-1a). Both are about surviving **one** interruption.

Long-horizon agents raise a different set of questions, and none of them were answered:

- What does the agent remember between runs, and where does that live?
- What happens when the machine sleeps, or the network drops mid-run?
- How do you know a week-long run is still working, without reading logs?
- How do you grade *how* an agent behaved, not just whether the output was right?
- What does it cost when memory grows?

These are answered here, with evidence, and marked clearly where they aren't.

## Where it gets used

**When you're building a Tier B/C coded agent that runs unattended.** Start with
`HARNESS.md` for the pinned stack and the five structural pieces to copy; `MEMORY.md` if it
needs to remember anything across runs; `BEHAVIOR.md` when you get to evals.

**When you're reviewing one.** The kill-test is the gate, and `HARNESS.md` records exactly what
the current pass looks like so a new build has something concrete to match.

**When a claim about the harness needs checking.** `research/` holds the dated source material,
including three claims in circulation that are wrong.

## How to read it

Each file separates **verified here** from **unverified** from **false**. That split is
deliberate and load-bearing: this material is used to decide what to build on, and a plausible
claim carried as fact costs more than an absent one. If something isn't marked verified, nobody
has run it.
