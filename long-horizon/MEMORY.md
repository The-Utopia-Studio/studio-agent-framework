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
plural-table correction in `HARNESS.md`.

## How to prove it actually persists

Not "the agent said it remembered". Two tests, and the second is the real one:

**1. Cross-process recall.** Cycle 1 writes. Cycle 2 runs as a **separate OS process** with no
application code carrying anything between them. Observed: cycle 2 opened by naming cycle 1's
themes and correctly rejected the overlapping items as already covered.

**2. Read it back from outside.** Query the store over **raw HTTP with zero SDK code** — no
Mastra, no Convex client. If a process that never wrote the state can read it, the state is
genuinely durable. If that read needs the framework, you have proven a cache, not a store.

This is the same technique the 26 Aug probe used for workflow snapshots, and it is worth keeping
as the standard for any "it persists" claim.

## What good memory looks like

Over 24 cycles working memory went **666 → 1,735 chars**. The size is not the interesting part —
the shape is:

- story counts **increment** — "on-device AI demand: 2 stories", up from 1
- entries get **merged with reasoning the agent wrote itself** — a synthesis line that appears in
  no template it was given
- a theme was **added on evidence**, with a matching thread to watch

That is note-taking. The failure mode to watch for is the opposite: a log that grows
monotonically, restating input without merging or retiring anything.

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

## Not yet tested

A run across a genuine multi-hour sleep/wake boundary *with varied input*. The 24 cycles above
were mostly clustered, and five hours of the run received identical input. Whether the cost curve
plateaus past ~1,700 chars is also open — it stepped up once already.
