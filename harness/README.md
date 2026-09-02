# AgentManifest runner

`harness/run.js` is the executable half of AgentManifest v1. It validates the high-value
conditional decisions with Node alone, compares declared runtime pins to `package.json` and its
lockfile, and can run the existing portable behaviour compiler.

```bash
node harness/run.js \
  --manifest=examples/manifests/approval-gated-module.agent.json \
  --package=bakeoff/mastra/package.json \
  --lockfile=bakeoff/mastra/package-lock.json \
  --behavior
```

It never executes arbitrary commands copied from a manifest. A manifest can describe a check,
but executing it needs an explicit runner option or a future approved adapter. This keeps a PRD
artifact from becoming a code-execution surface.

The runner returns non-zero for a malformed/unsafe manifest or pin mismatch. It reports checks
that were not run as `UNENFORCED`; it never turns those into a pass.
