# AgentManifest runner

`harness/run.js` is the executable half of AgentManifest v1. It validates the high-value
conditional decisions with Node alone, compares declared runtime pins to `package.json` and its
lockfile, runs the portable behaviour compiler, and can execute exactly the golden fixtures the
manifest names through an explicitly supplied adapter.

```bash
node harness/run.js \
  --manifest=examples/manifests/approval-gated-module.agent.json \
  --package=bakeoff/mastra/package.json \
  --lockfile=bakeoff/mastra/package-lock.json \
  --adapter=bakeoff/mastra/entry.js \
  --behavior
```

The command writes a dated machine-readable result to
`runs/manifests/<agent-id>-latest.json` (override with `--result=<path>`). When an adapter run
fails, `--failure-draft=<path>` writes a review-required draft based on the shared runner report;
it never silently converts a failure into a new permanent golden case.

It never executes arbitrary commands copied from a manifest. A manifest can select fixtures, but
the adapter must be supplied explicitly by the person or CI workflow invoking the runner. Fixture
references are restricted to `bakeoff/evals/fixtures/*.json`. This keeps a PRD artifact from
becoming a code-execution surface.

The runner returns non-zero for a malformed/unsafe manifest, a pin mismatch, or a failed selected
fixture/behaviour check. It reports checks that were not run as `UNENFORCED`; it never turns those
into a pass.
