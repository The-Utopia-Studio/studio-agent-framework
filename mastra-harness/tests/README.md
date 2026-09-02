# Tests

`../scaffold/*.js` gets copied into the agent being built, so it is exercised there. What lives
here is the **verification a work order must pass**, and the two probes that caught real problems.

## The three checks that matter

In order of what they actually caught on this project:

1. **Kill and resume.** Start the agent, `kill -9` it mid-flight, resume in a fresh process with
   the runId as the only input. Anything less proves a cache.
2. **Read from outside.** Read the durable state over raw HTTP with zero SDK code. If the read
   needs the vendor's client, you have not proven durability.
3. **Recall with the other channels off.** Disable `lastMessages` and `semanticRecall`, then check
   recall still works. Otherwise you are measuring one channel and crediting another.

## `nested-kill-resume.js`

Reference implementation of checks 1 and 2, on the shape the module harnesses need: a parent
workflow, `.branch()` routing on real data into a **nested** workflow, `suspend()` inside that
nested workflow, hard-killed while suspended, resumed in a fresh process from Convex.

```bash
node nested-kill-resume.js start --hold   # suspends inside the nested workflow, then holds
kill -9 <pid>                             # no cleanup, no shutdown hook
node nested-kill-resume.js resume         # fresh process, Convex only
node nested-kill-resume.js verify         # raw HTTP read-back, zero SDK
```

Two structural facts it established: a nested workflow gets **its own snapshot row** sharing the
parent's runId, and suspension is addressed **by path** —
`resume({ step: ["<nested-id>", "<step-id>"] })`.

## `provider-probe.mjs`

**Read what the model was actually sent.** The most useful diagnostic on this project — it found
two separate memory failures that reading the agent's replies never would have, and in both cases
the obvious explanation was wrong.

```js
import { withProviderProbe, assertWriteAdvanced } from './provider-probe.mjs';

const { report } = await withProviderProbe(runOneCycle, {
  host: /moonshot/, tool: /workingMemory/i, expectTool: 'no',
});
console.log(report.summary());
```

`report.summary()` names the state rather than dumping fields — whether the tool was **offered**,
whether it was **called**, and whether the framework is **mandating the tool path in the system
prompt**. That last one is the check that took two failed rounds of prompt-strengthening to
discover: with `workingMemory.enabled`, Mastra appends *"IMPORTANT: You MUST call
updateWorkingMemory in every response"* **after** your instructions, so an agent told to write
memory itself receives contradictory orders and satisfies neither.

Set `expectTool` to match your architecture — `'no'` for the deterministic write (the standard),
`'yes'` if the agent genuinely uses the framework's tool. It decides which of the four
offered/called states are problems, and a probe that warns about a correct configuration is worse
than no probe.

`assertWriteAdvanced(readUpdatedAt, run)` is the assertion worth putting in CI for any agent with
durable memory. It checks the write **timestamp advanced** — deliberately *not* that content
changed, because unchanged memory is correct when the input was already covered, and asserting
otherwise fails a well-behaved agent (it did, for seven consecutive cycles). Mastra bumps
`updatedAt` on every write even when content is byte-identical, which is what makes the timestamp
the safe thing to assert.

### Two lessons the probe itself taught

**When a model appears to ignore a clear instruction, read what it was sent before rewriting the
instruction.** Two rounds of strengthening cost more than one run of this.

**"Captured nothing" is not a pass.** The first real use of this file captured nothing, because a
cycle script that self-invokes `main()` resolves its import before doing any work, so the
interceptor was torn down too early. It now waits, and says so explicitly instead of reporting an
empty result that reads like a clean one.
