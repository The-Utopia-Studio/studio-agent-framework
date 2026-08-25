Supersedes the closed #2 with the actual result requested there: a settled STATE-1a verdict
for Mastra, on a live model, with the harness's earlier record left standing rather than
quietly corrected. Companion to #1. Additive only.

Start with [`docs/bakeoff/findings-mastra.md`](docs/bakeoff/findings-mastra.md).

## The headline

**Mastra-on-Convex satisfies STATE-1a — native, not a workaround.** Real Kimi K2.6, real
Convex deployment, real `SIGKILL` across real OS processes, and — because "the state exists"
is exactly the claim that needs proof, not narration — an **independent-process,
independent-language read-back**: a run was suspended, its process exited without ever
resuming, and minutes later a plain Python script with zero Mastra/Convex SDK code called
the deployed storage function directly and read the suspended snapshot back by key, with a
real Convex document ID.

```
vendor_store_kind          convex
killed_by_sigkill          True
resumed                    True
args_byte_identical        True
model_calls_after_resume   0        (counted from real outbound HTTP)
harness_produced_send      True     (a genuine persisted send, not just "did not throw")
resume_path                native: agent.approveToolCallGenerate() on the persisted harness_run_id
```

No vendor-local file is ever written when `ConvexStore` is configured, so STATE-1a's
deletion clause is satisfied by construction — this is the strongest reading of "native"
available: not a file that happened to survive a kill, but state confirmed to exist nowhere
except a remote database.

## How I got there, left in rather than cleaned up

Two measurements said the opposite before this was correct, and both are documented in
`findings-mastra.md` §5 rather than silently fixed:

1. A first probe proxied the `ConvexStore` object and logged zero snapshot writes. Wrong —
   `getStore("workflows")` returns a sub-store a shallow Proxy never wraps. Re-instrumented
   at the network layer (wrapping `fetch` to the Convex host) instead, which can't be fooled
   the same way.
2. Even after that, `model_calls_after_resume` was reading from a mock-server log that
   doesn't exist on real-model runs — so it reported `0` unconditionally, not because it was
   measured. A `fetch`-level counter (`evals/model-call-counter.js`) replaced it, validated
   against a case that provably calls the model before being trusted on the crash cases.
   `resume_path: 'native'` was also asserted too cheaply — it branched on whether a call
   *threw*, not on whether it did anything — fixed to require a genuinely persisted send.

If either of those had gone unnoticed, this PR would have reported a false PASS — the exact
failure mode #1's own critique of the earlier probe was about.

## A live-credential incident, and what I did about it

While rebuilding a corrupted `.env` mid-session, two backup files I created
(`.env.save`, `.env.broken-*`) were picked up by later commits and briefly held a live
Linear API key, Slack webhook, and Moonshot API key in plaintext. **Never pushed anywhere**
— the working repo has no remote — but purged from local history anyway
(`git filter-branch` + `gc --prune=now`), verified with a full-history credential-pattern
scan (zero hits), and excluded going forward. This PR is built from a hand-picked file
list in a fresh commit, not from that repo's history, so nothing above ever touched this
branch. Flagging it because it happened, not because it reached here.

**Three credentials from this work should be rotated regardless**: the Linear API key, the
`#agent-test` Slack webhook, and the Slack Verification Token pasted in an earlier session
(unrelated to this incident, disclosed via chat, not via git).

## Two real docs/schema bugs found and fixed in-tree

- `@mastra/convex`'s bundled reference names the workflow table `mastra_workflow_snapshots`
  (plural); the runtime's `TABLE_WORKFLOW_SNAPSHOT` constant is `mastra_workflow_snapshot`
  (singular). Convex accepts writes to undeclared tables, so resume worked throughout
  despite this — but `npx convex data` can't browse a table under the wrong name, which is
  most of why the earlier false negative took several attempts to diagnose. Fixed in
  `mastra/convex/schema.ts`.
- The same reference's `ConvexStore` constructor example uses `{ url, adminKey }`. The real
  option names are **`deploymentUrl`** / **`adminAuthToken`** — the wrong names are silently
  ignored rather than throwing, which reads as a credential failure rather than a naming one.

## Also in this PR (from the broader bake-off, unchanged since #2)

- `bakeoff/` — the harness-agnostic 12-case suite, reused byte-identically across Mastra,
  Deep Agents, and Flue. `tools/` has zero harness imports (enforced).
- `docs/bakeoff/FINDINGS.md` — the full three-way comparison, including the STATE-1a
  deletion probe on all three legs (§Y) and where each harness wins/loses.
- Live Kimi K2.6 confirmed the three PRD hallucination-watch items that a scripted mock
  can't test: never invents an assignee, always reports truncation, exactly one tool
  selection.

## Reviewer checklist

- [ ] The STATE-1a verdict and its evidence chain (§5 of `findings-mastra.md`) — this is the
      claim the PR exists to make; push back on it now rather than after it's cited.
- [ ] The two schema/constructor corrections — worth folding into whatever canonical Convex
      setup doc the framework ships, since they'll bite the next person who follows the
      package's own reference verbatim.
- [ ] Whether `bakeoff/` belongs in this repo long-term, same question raised on #2.
- [ ] Rotate the three flagged credentials.

## What is deliberately NOT done

- Deep Agents and Flue were not re-run on live models or against a STATE-1a-compliant
  vendor store — neither ships one the way Mastra ships `ConvexStore`. Their STATE-1a
  results (§Y of FINDINGS.md) remain "unmet with the harness's default store, untestable
  against a compliant one" — narrower than a flat "unmet," and stated as such.
- No overall winner declared. That's a gate-5 human read.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
