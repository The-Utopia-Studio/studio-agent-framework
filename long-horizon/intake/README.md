# Typed input scaffold (STANDARD §1a)

Minimal, checkable piece of the fellow → router → harness path described in
[`STANDARD.md`](../STANDARD.md) §1a.

## Rule under test

Router `OUT` must be `{ agentId, input }`. `input` must validate against that agent's schema.
A half-filled or unknown-agent payload **must not start** a run — return issues instead.

This folder is **not** the router, run row, or notify/approve leg. Those remain unbuilt. It is
only the missing "something to check against" called out in STANDARD §1a.

## Layout

| Path | Role |
|---|---|
| [`schemas/router-output.schema.json`](../../schemas/router-output.schema.json) | Envelope: requires `agentId` + `input` |
| [`agents/*.input.schema.json`](agents/) | Per-agent typed input (one example shipped) |
| [`validate.js`](validate.js) | Node-only validator — no npm deps |
| [`tests/validate.test.js`](tests/validate.test.js) | Pass / half-filled / unknown agent |

## Run

```bash
node --test long-horizon/intake/tests/validate.test.js
```

## Adding an agent

1. Add `long-horizon/intake/agents/<agent-id>.input.schema.json` with `required` fields the
   router must fill before dispatch.
2. Register it in `AGENT_INPUT_SCHEMAS` inside `validate.js` (deliberately explicit — no
   filesystem glob at dispatch time until the registry owns this).
3. Extend the test file with one pass case and one half-filled case.
