# Harness bake-off — a runnable STATE-1 / STATE-1a conformance suite

One agent spec (`docs/bakeoff/linear-digest-PRD.md`) implemented three times — **Mastra**,
**Deep Agents**, **Flue** — graded by one shared suite, plus a live re-test of Mastra on
**Kimi K2.6 + Convex** that settles the STATE-1a question for that harness.

Start with [`docs/bakeoff/findings-mastra.md`](../docs/bakeoff/findings-mastra.md) — the
focused STATE-1a verdict. [`docs/bakeoff/FINDINGS.md`](../docs/bakeoff/FINDINGS.md) is the
full three-harness comparison.

## Layout

| Path | What it is | Harness-specific? |
|---|---|---|
| `tools/` | The two tool functions. **Zero harness imports** — enforced by `evals/acceptance/no-harness-imports.js`. | No |
| `store/` | Canonical append-only event log. Plain SQLite, raw-SQL readable, append-only enforced by triggers. | No |
| `evals/` | 12 golden-case fixtures, the harness-agnostic runner, the validator gate, a triple-format mock model, a real-HTTP model-call counter | No |
| `mastra/`, `deepagents/`, `flue/` | Per-leg adapters implementing `run(fixture, ctx) -> report` | Yes |
| `mastra/convex/` | Schema + storage handler for the STATE-1a Convex re-test | Yes |

## Running it

```bash
node --env-file=.env evals/runner.js --harness=./mastra/entry.js --all

# Mastra on live Kimi K2.6 (mock Linear/Slack, no outward side effect)
DIGEST_REAL_MODEL=1 DIGEST_MODEL=moonshotai/kimi-k2.6 \
  node --env-file=.env evals/runner.js --harness=./mastra/entry.js --all

# STATE-1a: does resume work when the vendor store is Convex and nothing local exists?
DIGEST_REAL_MODEL=1 DIGEST_MODEL=moonshotai/kimi-k2.6 \
  node --env-file=.env evals/runner.js --harness=./mastra/entry.js \
  --case=4-crash-resume,11-post-crash-duplicate-check
```

## Verdict vocabulary

`PASS` / `FAIL` / `PRIMITIVE-GAP` (the harness cannot express what the spec requires) /
`BLOCKED-NO-CREDENTIAL` (expressible and wired, credential absent) / `ERROR` (the harness
threw). `PRIMITIVE-GAP` and `BLOCKED` exist so a gap is never recorded as a pass-with-a-caveat.
