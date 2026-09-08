# Generated repository profiles

Use the smallest suitable profile. These are defaults, not reasons to rearrange an existing
application. If the agent lives in a monorepo, map these roles to existing paths and record the
mapping. The standalone checker below applies to the default standalone paths only.

## Skill (rung 1)

```text
<skill-name>/
  SKILL.md             metadata + concise operating procedure
  scripts/             optional deterministic executable helpers
  references/          optional documentation loaded when needed
  assets/              optional templates/resources copied into outputs
  tests/               evaluation cases when this skill needs a test harness
```

Only SKILL.md is structurally required. No package.json, database, agent loop, or empty folders
are required for a prose-only skill. Executable helpers declare dependencies and provide tests.
Use a short name matching the folder; detailed procedure belongs in the body, not the description.

## Managed / project (rungs 2–3)

```text
<agent-name>/
  instructions.md      platform instructions and tool boundaries
  config.json          platform, owner, identity, trigger and memory choices; no secrets
  tests/               representative inputs and expected results
  README.md            installation, usage, owner, operating limits
```

The platform owns execution and persistence. Document its capabilities; do not invent a local
runtime to imitate it. Store provider exports here when supported, with secrets removed.

## Coded (rung 4; standalone TypeScript default)

```text
<agent-name>/
  README.md
  package.json + package-lock.json
  .env.example
  agent-manifest.json
  build-state.json
  docs/agents/          PRD, work orders, operating notes
  src/
    index.ts           public CLI/API/worker boundary: authenticate, validate, dispatch
    agents/            agent definitions and model-owned judgments
    tools/             typed tool implementations; authorization before side effects
    runtime/           storage configuration, budgets, status, recovery, effect coordination
    workflows/         only if durable multi-step execution is required
    memory/            only if memory is selected: scope, retrieval, merge, retention
  convex/              for Convex: schema, server storage handler, scoped domain functions
  skills/              only for actual runtime skills; each has its own SKILL.md
  tests/
    input.schema.json
    fixtures/          real agent-specific cases + explicit synthetic adversarial cases
    conformance.mjs    executable proof registry for this agent
```

Use ESM consistently (`type: module`); use .cjs only for an intentional CommonJS boundary.
Keep prompt versions/resources outside orchestration code where useful, with content hashes.
Generated production storage selects Convex explicitly and fails on missing configuration; no
silent local-SQL fallback. A separate explicit mock/local profile may use LibSQL for tests.
A workflow, memory implementation, vector index, or skill library is created only when selected.

Source: [Agent Skills specification](https://agentskills.io/specification). The coded layout is a
Studio default based on separation of responsibilities, not a mandated external standard.
