# Tests

`../scaffold/*.js` are copied into the agent being built, so they are exercised there rather than
here. What belongs in this folder is the **verification a work order must pass**, not unit tests
for the scaffold.

The three that catch real problems, in order of what they caught:

1. **Kill and resume.** Start the agent, `kill -9` it mid-flight, resume in a fresh process with
   the runId as the only input. Anything less proves a cache.
2. **Read from outside.** Read the durable state over raw HTTP with zero SDK code. If the read
   needs the vendor's client, you have not proven durability.
3. **Recall with the other channels off.** Disable `lastMessages` and `semanticRecall`, then
   check recall still works. Otherwise you are measuring one channel and crediting another.

The reference implementations of 1 and 2 live in
`studio-harness-probe/upgraded/mastra/nest-test.js` (`start --hold` / `resume` / `verify`).
