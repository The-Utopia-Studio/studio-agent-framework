# Harness bake-off — a runnable STATE-1 / STATE-1a conformance suite

One agent spec (`docs/bakeoff/linear-digest-PRD.md`) implemented three times — **Mastra**,
**Deep Agents**, **Flue** — and graded by one shared suite. Findings and pasted evidence:
[`docs/bakeoff/FINDINGS.md`](../docs/bakeoff/FINDINGS.md).

## Why it's here

This repo defines `STATE-1`/`STATE-1a`, so it should ship a conformance test for them.
`bakeoff/` is that test, generalised across three harnesses rather than one.

## Layout

| Path | What it is | Harness-specific? |
|---|---|---|
| `tools/` | The two tool functions. **Zero harness imports** — enforced by `evals/acceptance/no-harness-imports.js`. | No — byte-identical across all three legs |
| `store/` | The canonical append-only event log. Plain SQLite, raw-SQL readable, append-only enforced by triggers. | No |
| `evals/` | 12 golden-case fixtures, the harness-agnostic runner, the validator gate, the triple-format mock model | No |
| `mastra/`, `deepagents/`, `flue/` | Per-leg adapters implementing `run(fixture, ctx) -> report` | Yes — this is the only harness-specific code |

The harness contract is one function, loaded by dynamic import, so a fourth leg is a new
directory and nothing else.

## Running it

Each leg needs its own `npm install` (its dependency sets conflict, deliberately kept apart).
No model API key is required: the suite points the provider's base URL at a local mock, so
the harness's real code path runs against a deterministic, countable endpoint.

```bash
node --env-file=.env evals/runner.js --harness=./mastra/entry.js      --all
node --env-file=.env evals/runner.js --harness=./deepagents/entry.js  --all
node --env-file=.env evals/runner.js --harness=./flue/entry.js        --all
```

### The STATE-1a probe — deletion, not shutdown

```bash
DIGEST_DELETE_VENDOR_STATE=1 node --env-file=.env \
  evals/runner.js --harness=./<leg>/entry.js --case=4-crash-resume,11-post-crash-duplicate-check
```

Deletes that harness's own store between the `SIGKILL` and the resume, so a resume can only
come from the canonical log. **All three legs pass; none passes natively.** See §Y of
FINDINGS.md.

### Honest-failure baseline

```bash
node evals/runner.js --harness=./evals/stub.js --all
# PASS 0   FAIL 12   PRIMITIVE-GAP 0   BLOCKED 0   ERROR 0   of 12
```

12 legible mismatches, zero errors — the pre-scaffolding baseline (`EVAL-4`).

## Verdict vocabulary

| Verdict | Meaning |
|---|---|
| `PASS` | every graded check met |
| `FAIL` | a graded check missed |
| `PRIMITIVE-GAP` | the harness cannot express what the spec requires; the missing API is named |
| `BLOCKED-NO-CREDENTIAL` | expressible and wired, but a credential is absent |
| `ERROR` | the harness threw — distinct from a graded failure |

`PRIMITIVE-GAP` and `BLOCKED` exist so a gap is never recorded as a pass-with-a-caveat.
