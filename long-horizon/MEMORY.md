# Memory for long-horizon agents

What an agent remembers between runs, where it lives, how you prove it, and what it costs.
Tested **1 Sep 2026** on the stack pinned in [`HARNESS.md`](HARNESS.md).

## The distinction that matters

"Memory" gets used for two different things, and only one of them is what long-horizon agents
need:

| | Answers | Mechanism |
|---|---|---|
| **Deduplication** | "have I seen this exact item before?" | a unique index. Cheap, exact, no model involved |
| **Memory** | "is this the third story on this theme this week?" | recall over prior content |

A unique index is the right tool for the first and the **wrong** tool for the second. If an
agent only needs the first, it does not need a memory layer — and adding one is real machinery
for a problem it does not have.

Test built to force the distinction: two agents, same job, same feeds. One on Mastra with
memory; one plain Node with **zero** dependencies deduping by normalised URL. Given overlapping
batches, only the Mastra one could say "already covered, and it continues a theme".

## Where it lives

`ConvexStore` for state, `ConvexVector` for the recall index — the same Convex deployment, not a
new service. Embeddings from `@mastra/fastembed`: 384 dimensions, **running locally**, so no
embedding API key and no per-call embedding cost. That last point matters for an agent that
embeds on every cycle for a week.

Convex tables involved: `mastra_resources` (working memory), `mastra_messages` (history),
`mastra_threads`, and the vector index. The framework's schema must declare them — see the
workflow-table correction in `HARNESS.md`.

## How to prove it actually persists

Not "the agent said it remembered". Two tests, and the second is the real one:

**1. Cross-process recall.** Cycle 1 writes. Cycle 2 runs as a **separate OS process** with no
application code carrying anything between them. Observed: cycle 2 opened by naming cycle 1's
themes and correctly rejected the overlapping items as already covered.

This test is weaker than it looks, and knowing why matters. It proves *something* crossed the
process boundary — not *which* of the three channels carried it. An agent with empty working
memory recalls prior coverage just as convincingly from semantic recall alone; that is exactly
how nine unmaintained cycles passed unnoticed. To attribute recall to working memory
specifically, **disable the other channels** (`lastMessages: 0`, `semanticRecall: false`) and
re-run. Both are env-switchable in the reference agent for this reason.

**2. Read it back from outside.** Query the store over **raw HTTP with zero SDK code** — no
Mastra, no Convex client. If a process that never wrote the state can read it, the state is
genuinely durable. If that read needs the framework, you have proven a cache, not a store.

This is the same technique the 26 Aug probe used for workflow snapshots, and it is worth keeping
as the standard for any "it persists" claim.

## What good memory looks like

Over 24 cycles working memory went **666 → 1,735 chars**. The size is not the interesting part —
and taken alone it is actively misleading, since a frozen figure looks identical to a healthy one
(see [below](#the-failure-that-outranks-all-of-the-above)). The shape is what matters:

- story counts **increment** — "on-device AI demand: 2 stories", up from 1
- entries get **merged with reasoning the agent wrote itself** — a synthesis line that appears in
  no template it was given
- a theme was **added on evidence**, with a matching thread to watch

That is note-taking. Two failure modes sit either side of it: a log that grows monotonically,
restating input without merging or retiring anything — and memory that simply **stops being
written** while the agent keeps behaving correctly from its other recall channels.

**Use a bounded template.** Give working memory a shape — sections, and a hint at what belongs
in each. Unbounded working memory grows without a ceiling; a template is what makes the agent
merge instead of append.

**Semantic recall works, and needs a vector store plus an embedder.** 41 vectors, 384d, cosine.
A similarity query returns prior messages with scores. Mastra creates the index unprompted.

## What it costs

Memory is not free, and the cost scales with state:

```
input tokens per cycle
559    empty memory
2546   memory exists
3428 …  3596 … 3028 … 3359      band, while memory sat ~1,200 chars
4181 … 4423                     stepped up as memory reached ~1,735 chars
```

The zero-dependency control stayed flat at ~450 the whole time. **Only the memory-backed agent
climbs**, because every cycle re-injects prior state.

Bounded by the template and by `topK` on recall — but "bounded" is not "constant". Anything
budgeting per-run needs to assume growth, and a per-run cost figure measured on an empty memory
will be wrong by roughly 5× once the agent has been running a while.

## The failure that outranks all of the above

Nine cycles ran overnight through a real sleep boundary. Every one reported `ok`. Every one
recalled prior coverage. Working memory was **never written** — it sat at exactly 1,742 chars,
`updatedAt` frozen at the previous afternoon, while messages grew 50 -> 70 and vectors 51 -> 71.

The agent's own replies said *"Two themes touched. Updating memory."* It had no tool with which
to do that.

Two separate causes, and they compound:

**1. An out-of-band write disables the tool.** A raw `updateResource` write to
`mastra_resources.workingMemory` — done during an unrelated restore — left the record in a state
where Mastra stopped **offering** `updateWorkingMemory` to the model at all. Instrumenting the
provider request showed `OFFERED: false` on every cycle. Clearing the field to `''` brought the
tool straight back (`OFFERED: true`).

> **Rule: never write `mastra_resources.workingMemory` outside the vendor API.** Not to seed it,
> not to restore it, not to fix it. Raw reads for verification are fine and necessary. Raw
> *writes* silently remove the agent's ability to maintain its own memory.

**2. With the tool offered, the model still declines to call it.** This is the more important
half, because nothing was broken. Reproduced A/B on the same agent, same instructions, same
model, varying only which recall channels were available:

| Recall available to the agent | `updateWorkingMemory` | Result |
|---|---|---|
| `lastMessages: 0` + semantic recall **off** | offered -> **called** | wrote 712 chars |
| `lastMessages: 6` + semantic recall **on** | offered -> **not called** | frozen |

The three recall channels **compete**. Once semantic recall can answer *"what have I already
covered?"* from 71 embedded messages, the model has no felt need to persist anything, so it
doesn't. Memory maintenance therefore **decays as the corpus grows** — the longer the agent runs,
the less it maintains, which is precisely backwards for a long-horizon agent.

And the recall stays convincing while it happens. With `lastMessages: 0`, empty working memory
and semantic recall on, the agent *still* correctly referenced prior coverage. Behaviour looked
perfect from the outside for nine hours.

### Why nothing caught it

Every available signal was green:

- run status: `ok` x9
- recall check: passed x9 (it genuinely was recalling — from the other channels)
- working-memory size: a plausible 1,742 chars
- Langfuse: spans present, no errors

**Size cannot distinguish maintained memory from abandoned memory.** Both are a plausible number.
Only the write timestamp can. The harness now records `working_memory_updated_at` and
`cycles_since_memory_write`, and fails a verdict past three `ok` cycles without a write; the
dashboard prints it in red and `doctor` returns non-zero.

> A memory metric you can satisfy by doing nothing is not a memory metric. Measure **freshness**,
> never size.

This is also the cleanest argument for [`BEHAVIOR.md`](BEHAVIOR.md) existing at all: a
`required: updateWorkingMemory` predicate per cycle would have failed on cycle one. No status
field, log line or trace would have — and none did.

## The trap that cost a day

For seven consecutive cycles memory sat frozen and cost flatlined. Both looked like findings
about long-horizon memory. Both were artefacts of the **test**.

The batch was selected as "top 8 by score", and on the source feeds the top 8 barely moves over
hours — so every cycle received a **byte-identical** input. The agent correctly answered "already
covered, nothing new" and correctly left memory alone.

**An agent correctly reporting "nothing new" is indistinguishable from an agent whose memory is
broken, if you only watch the memory.** What separated them was inspecting the *input*.

Two consequences worth carrying:

1. **When testing memory, vary the input deliberately.** Prefer never-shown items, and keep a
   couple of repeats as a control so "already covered" is still exercised.
2. **Any eval clause of the form "memory must change" is wrong.** Unchanged memory is *correct*
   when the input was already covered. See the sixth spec in [`BEHAVIOR.md`](BEHAVIOR.md).

## Verifying a memory claim — checklist

- [ ] Read the state back **from outside the framework**, over raw HTTP or plain SQL
- [ ] Confirm a **separate process** recalls what an earlier one wrote
- [ ] Check the state **revises** — counts increment, entries merge — not just grows
- [ ] Count vectors through the **vendor API**, not a raw table read (a raw read can return 0
      while vectors exist — this produced a two-day false negative)
- [ ] Compare **input against state** before concluding anything from state not changing
- [ ] Measure input tokens early **and** late; do not budget from the empty-memory figure
- [ ] Assert the memory **write timestamp advances** — not that the memory is non-empty or large
- [ ] Assert `updateWorkingMemory` was **offered and called**, from the provider request itself
- [ ] Test recall with the other channels **disabled**, or you are measuring semantic recall and
      calling it working memory

## Not yet tested

Whether the cost curve plateaus past ~1,700 chars — it stepped up once already, and memory has
since been reset to 712, so the curve needs re-measuring from here.

How to make memory maintenance **non-discretionary**. Options not yet tried: a much more forceful
instruction, a separate maintenance turn with no recall in context, or a deterministic
post-cycle write outside the model's discretion. The last is the most likely answer — a
long-horizon agent should not be able to skip persisting state because it happens to remember
right now.

Whether the same competition affects the per-category Inngest memory agent
([`INNGEST.md`](INNGEST.md)), which has only one proven cycle.
