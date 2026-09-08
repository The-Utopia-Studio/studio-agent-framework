# AgentManifest and pipeline validation

Install checker dependencies with `npm ci`. The complete Draft 2020-12 schema is validated with
Ajv, followed by cross-field tool and memory checks. Invalid declarations cannot execute an adapter.

## Planning

```bash
node harness/run.js --manifest=<agent-repo>/agent-manifest.json
node harness/pipeline.js <agent-repo>/build-state.json
node harness/structure.js --root=<agent-repo> --profile=coded
```

A valid declaration can exit zero while the result explicitly says `incomplete`: implementation
and runtime evidence are still needed. A structure pass only establishes placement.

## Actual agent verification

```bash
node harness/run.js \
  --manifest=<agent-repo>/agent-manifest.json \
  --package=<agent-repo>/package.json --lockfile=<agent-repo>/package-lock.json \
  --agent-adapter=<agent-repo>/tests/adapter.mjs \
  --checks=<agent-repo>/tests/conformance.mjs --behavior --release
```

Each fixture reference is `tests/fixtures/<case>.json`, resolved relative to the agent manifest.
Fixtures have `{ "case": "unique-name", "input": {}, "expect": { "output": "expected output" } }`.
An adapter exports `run(fixture, ctx) -> report`, invoking the actual generated agent. Expected
report fields are compared deterministically. With behavior enabled, return ordered `events`;
preflight and approval checks apply according to the manifest. Do not embed graders in prompts.
Use an isolated test environment with synthetic external services: the framework does not sandbox
operator-supplied code or grant authority to invoke real tools.

The `--checks` module exports a `checks` object keyed by manifest check ID. Every required check
must return `{ status: 'PASS' | 'FAIL' | 'UNENFORCED', detail, agent_id, manifest_hash, run_id }`.
The function receives `{ manifest, manifestHash, runId, adapter, suite }`. It must run or inspect
real evidence for that check, then bind the result to those inputs. No arbitrary `command` text
from a manifest is executed. A hash binds identity; it cannot make an untruthful checker trustworthy.
Review proof modules as code and keep model-generated verdicts separate from deterministic checks.
Checks time out after 30 seconds; long live experiments should run outside this command and be
verified by a reviewed module against a preserved evidence bundle, matching the current artifact.

For the repository's historical digest bake-off use `--adapter=bakeoff/mastra/entry.js` instead;
its fixture references remain restricted to `bakeoff/evals/fixtures`. Never use that analogous
adapter's result as proof of a different agent. `--behavior` runs compiler unit tests; actual-agent
behavior and security checks remain separate proof rows.

## Results

- `failed`, exit 1: invalid contract or observed failure, including partial pin arguments.
- `incomplete`, exit 0 for planning or exit 2 with `--release`: unexecuted or unavailable checks.
- `passed`, exit 0: core checks and all declared proof checks observed passing.

Results contain the manifest hash, run ID, repository commit/dirty marker, adapter and check-module
hashes, every skipped observation, and failures. Each child suite uses a unique result and database
directory; exact case coverage, adapter and suite identity are checked before accepting results.
Missing or blocked cases cannot become passes. `--failure-draft` writes review-required evidence;
it never edits permanent fixtures. Release readiness is scoped to these checks, not certification.

A missing integration proof remains incomplete; do not replace it with an always-pass check.
