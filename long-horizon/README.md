# Long-horizon agents

Everything the framework knows about agents that run for **minutes to days** rather than one
request — the harness they run on, how their memory works, and how their conduct gets graded.

Tier B/C coded agents only. Skills, projects and managed surfaces stay on lighter paths.

| File | What it answers |
|---|---|
| [`STANDARD.md`](STANDARD.md) | **Start here.** The recipe — how to build an agent on this framework, and what to use for orchestration, memory and grading |
| [`HARNESS.md`](HARNESS.md) | Which harness, pinned to which versions, and what has actually been proven on it |
| [`MEMORY.md`](MEMORY.md) | How a long-horizon agent remembers across processes, and what that costs |
| [`INNGEST.md`](INNGEST.md) | The durable loop, tested — what works, and the five blockers that stop it being usable |
| [`BEHAVIOR.md`](BEHAVIOR.md) | How agent conduct gets graded, and the plan to wire it in |
| [`intake/`](intake/) | STANDARD §1a scaffold — router OUT must carry `agentId` + typed input; half-filled requests do not start |
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

## The one result to read first

If you only take one thing from this folder: an agent survived 11 hours in a bag with no network,
reported `ok` on every cycle, demonstrably recalled its prior coverage — and had not written its
durable memory once in nine hours.

Nothing available caught it. Run status was green, the recall check passed (it genuinely was
recalling, from a different channel), memory size was a plausible 1,742 chars, traces were clean.
**A frozen memory size and a healthy one are the same number.** Two causes, both in
[`MEMORY.md`](MEMORY.md): a raw write to the memory column stops the framework offering the
write tool at all, and — the one that generalises — once semantic recall can answer *"what have
I covered?"*, the model stops calling the write tool on its own. Memory maintenance decays as
the corpus grows.

The lesson is not about Mastra. It is that **the environment is the easy part**. Sleep, network
loss and hard kills are testable and this stack passes them. What is hard is noticing that an
agent which looks perfect from the outside quietly stopped doing part of its job. That is what
[`BEHAVIOR.md`](BEHAVIOR.md) is for, and this is its motivating case: a two-line predicate —
was the memory tool offered, was it called — would have failed on cycle one.

> Grade freshness, never size. A metric you can satisfy by doing nothing is not a metric.

## How to read it

Each file separates **verified here** from **unverified** from **false**. That split is
deliberate and load-bearing: this material is used to decide what to build on, and a plausible
claim carried as fact costs more than an absent one. If something isn't marked verified, nobody
has run it.
