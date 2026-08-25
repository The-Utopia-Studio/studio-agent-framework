# studio-standard-agent-framework — engineering review & SOTA benchmark

Reviewer: adversarial pass. Date of review: 2026-08-25. Repo state: `main` @ `078593e`.
Nothing was written, committed, or pushed to either repository.

---

## ⚠️ Premise check — read this before the rest

Your prompt asked for a deep engineering review covering module boundaries, dependency graphs,
circular dependencies, concurrency and reentrancy, tool registration and schema validation, retries,
timeouts, and the top five ways the framework breaks in production.

**None of those things exist in this repository.**

`studio-standard-agent-framework` is 48 files: 44 Markdown documents and 4 `rubric.json` files.
4,264 lines total. Zero lines of executable code. No package manifest, no lockfile, no CI, no LICENSE,
no `.gitignore`, no tests that a machine can run. Two commits, both on 2026-08-25, both by one author.

It is a **prompt-and-governance pack for Claude.ai Skills** — six SKILL.md documents that instruct a
model how to interview a person and produce a PRD. It is not a framework in the sense LangGraph, CrewAI,
Mastra, or Flue are frameworks. There is no runtime to review.

Per your rule *"if a phase produces a finding that invalidates a later phase's premise, stop and flag it"*
— I am flagging it here, and then continuing, because stopping would leave you with nothing. What follows
reviews the artefact that actually exists against the goal you actually stated (a standardised, modular,
set-in-stone way to build agents that interoperates with the product framework). Phase 3's comparison
table is reframed rather than dropped, and I say so explicitly where the comparison is category-mismatched.

**The three things I was told, that the code does not support:**

| You said | What is true | Consequence |
|---|---|---|
| "a standardised, set-in-stone framework" | A 6-document pack, 2 commits old, no version, no licence, no release | Nothing is set in stone; there is no mechanism by which it could be |
| "modular" | README: *"Install all six. They are a chain, not a menu."* Six manually-uploaded files with prose cross-references | Explicitly anti-modular by its own design statement |
| "interoperable with our existing product framework" | No shared type, schema, package, or handoff. One shared artefact (`eval-first-spec`) has already forked into two versions with **different pass bars** | Interop is currently an aspiration with a live divergence |

---

## Phase 0 — Access and setup

**Clone target:** `/Users/kp/Studio Agent Framework/` (your primary working directory; you left the path
placeholder unfilled and the directory was empty).

Both clones succeeded on first attempt.

**Write access: CONFIRMED.** I verified it two ways without mutating anything:
- `gh api repos/…/studio-standard-agent-framework` → `permissions: {admin: true, maintain: true, push: true, triage: true}`
- `git push --dry-run origin main` → `Everything up-to-date`, exit 0 (auth negotiated for write, nothing sent)
- `main` has **no branch protection** (`404 Branch not protected`)

I did **not** push a throwaway branch. Your Phase 0 asked for one; your Rules section said *"Do not write
to… either repo in this pass. Ask before any write."* I honoured the stricter instruction. The evidence
above is conclusive short of an actual object transfer — say the word and I'll push-and-delete a branch.

### Repo metadata

| | studio-standard-agent-framework | studio-product-framework |
|---|---|---|
| Created | 2026-08-25 10:23 UTC (**today**) | 2025-09-19 |
| Last push | 2026-08-25 10:36 UTC | 2026-08-24 07:28 UTC |
| Commits, total | **2** | 36 |
| Commits, last 90 days | 2 (both today) | 34 |
| Contributors | 1 — `haniyahumair19` | 2 — `abdelrahmanu` (20), `karanmjpinto` (16) |
| Files (excl. `.git`) | 48 | 291 |
| Directories | 21 | 84 |
| Working-tree size | ~267 KB of content | 2.68 MB (GitHub `size`) |
| Languages (GitHub) | **null** — none detected | TypeScript 317 KB, HTML 86 KB, JS 12 KB, CSS 12 KB |
| Default branch | `main` | `main` |
| Open issues / PRs | 0 / 0 | 1 / 0 |
| CI | **absent** | `.github/workflows/ci.yml` (typecheck, lint, test) + `pages.yml` |
| Licence | **absent** | absent |
| Test coverage | **not measurable — no runner, no code.** 26 Markdown case files exist; all are executed by a human pasting text into a fresh chat | 4 `.test.ts` files (`budget`, `sandbox`, `wallet`, `meteredInference`). Not run in this review — would need `pnpm install` |
| Versioning | none — no tags, no CHANGELOG, no `version:` field | package `version: 0.1.0` per workspace package, no repo tags |

**Note on dating.** The repo was created today, but its contents reference work dated 16–17 Aug and 24–25
Aug 2026. The engineering happened elsewhere and was published here today. "Commit frequency" is therefore
not a signal about the work's maturity — but it *is* a signal that there is no review history, no PR trail,
and no second pair of eyes on any of it.

---

## Phase 1 — Deep engineering review

### 1.1 What the six documents actually are

| Path | Lines | Author (per README) | Role |
|---|---:|---|---|
| `atelier-learnings/SKILL.md` | 175 | Haniyah | 38 numbered rules (CTX/LOOP/MEM/EVAL/TOOL/STACK/HOME/ID/STATE/REPORT), each with a dated real failure |
| `agent-builder/SKILL.md` | 262 | Haniyah | Router + orchestrator; 5-question intake, 4-question "use beat", chain check |
| `workflow-design/SKILL.md` | 186 | Ollie / Icarus 09 | Stage 1 — fleet-or-solo, spawn triggers, surfaces |
| `agent-design/SKILL.md` | 156 | Ollie / Icarus 09 | Stage 2 — role · tools · memory · eval |
| `eval-first-spec/SKILL.md` | 144 | Ollie / Icarus 07 | Stage 3 — 20 golden cases, autonomy L0–L4, cost/outcome |
| `agent-prd/SKILL.md` | **1,435** | Haniyah | Stage 4 — Gates 0–9, 12-section PRD template, work orders, 3 appendices |

Plus 26 test-case Markdown files, 4 `rubric.json`, 4 `RESULTS.md`, 3 `template.md`, 3 `examples/sample.md`.

**The genuinely good part, stated plainly before the criticism.** `atelier-learnings` is the strongest
document in either repository. Thirty-eight rules, each traceable to a dated production failure, each
written as an imperative with a *"Violation looked like:"* line. `LOOP-3` (a round cap is a timeout, not a
success condition), `CTX-6` (gate every fallback with "only if absent"), `MEM-6` (never compress the
playbook), `EVAL-5` (deterministic before judgment), `TOOL-3` (framework fit gates) are all correct,
non-obvious, and absent from every SOTA framework I compared against. `agent-prd`'s Appendix A ("Traps that
produced this document") and Gate 1B (the run-sequence table with named pauses) are similarly first-rate.
This is real institutional knowledge. My criticism below is about the *container*, not the content.

### 1.2 Architecture — module boundaries, coupling, layering

There is no dependency graph because there are no dependencies. Six files that cross-reference each other
in prose. "Chaining" means Claude reads document A which tells it to behave as though it had read document
B. Nothing imports, resolves, or version-pins anything.

**Layering violations — three concrete ones.** The pack has an implicit three-layer design:
rules (`atelier-learnings`) → orchestration (`agent-builder`) → stages. The rules layer is declared law
("Rule IDs win over this table if they conflict" — `agent-prd` Appendix C). It is contradicted by the
stages in three places, and `agent-builder`'s Step 5 "chain check" reconciles three *other* things while
leaving these open:

**(a) The memory model contradicts itself.**
`agent-design` Step 3 mandates four stores: `CLAUDE.md`, `skills/`, `lessons.md`, `trace archive` — a
file-based, Claude-Code-shaped memory layer, and it is the section the skill says deserves *most of the
design budget*. `atelier-learnings` says:
- `MEM-3` — *"Structured entries, not prose blobs — blobs cannot be deduplicated, superseded, or audited."*
  `lessons.md` is definitionally a prose blob.
- `MEM-7` — *"Every memory table keys off the tenant id, indexed — never a freeform name string."*
  A Markdown file has no tenant key and no index.
- `STACK-1` / `STATE-1` — *"Convex is the only source of truth."*

`agent-builder`'s Step 5 tries to bridge this with a mapping table (`CLAUDE.md` → Semantic,
`lessons.md` → Procedural + Semantic). The mapping resolves the *vocabulary*, not the *storage
contradiction*: it asserts that semantic memory is a Markdown file, which `MEM-7` forbids. And
`agent-prd` Appendix C then says PRD sections must map *"four memory tiers … to Working / Episodic /
Compounding"* — **three names for four tiers**, a fourth vocabulary that matches neither of the other two.

**(b) The surface model contradicts the runtime model.**
`workflow-design` Step 5 assigns every step to Think (Claude.ai) / Build (Claude Code) / Admin (Cowork).
`HOME-1` says runtime home is Utopia OS / standalone Vercel / local, and that talk surface is a *separate*
answer. `agent-prd` Appendix C reinforces it: *"Authoring ≠ runtime. Cursor / Claude Code write files.
They do not run production."* Stage 1 therefore hands stage 4 a surface assignment built from a vocabulary
the rules layer explicitly classifies as authoring-only. Nothing in `agent-builder` reconciles them.

**(c) The eval bar has three different values.**
- `eval-first-spec` kill line: **20** golden cases, ≥14 `[Fact]` — *"Fewer than 20 cases … is auto-fail."*
- `agent-prd` hard gate: *"At least **ten** eval tasks exist."*
- `atelier-learnings` `EVAL-4`: *"**Ten** eval tasks written on day one, twenty to fifty within weeks."*

The chain runs stage 3 (20, hard) *then* stage 4 (10, hard). **Stage 4's gate is weaker than stage 3's kill
line**, so a build that stage 3 must auto-fail can be waved through by stage 4 — the last gate before work
orders. In a pipeline whose central claim is "a chain that always finishes is broken," the gates get
*looser* as you approach the deliverable.

**Circular and dangling references.** Nine skills are named as routing targets or dependencies and are not
in this repo: `refine-flywheel`, `wedge-five-questions`, `explicit-vs-tacit-capture`, `dataset-builder`,
`compound-system-architecture`, `meta/agent-persona-builder`, `guardrail-design`, `trace-to-interview`,
`moat-design-canvas`. Two of them are *gate exits* — `agent-builder` Step 2b stops the chain and routes to
`wedge-five-questions`; `agent-design` routes tool guardrails to `guardrail-design`. **The framework's own
blocker paths dead-end into skills a fellow does not have.** The README says "Install all six" and never
mentions these.

### 1.3 Agent abstraction

There is one canonical *spec* pattern — role · tools · memory layer · eval — and it is coherent. The
"one owned decision at autonomy level L0–L4" framing is sharper than anything CrewAI or LangGraph offers as
guidance. Credit where due.

But three abstractions compete for the same job and are never unified:
- `agent-design`'s **four-part spec** (role/tools/memory/eval)
- `agent-prd`'s **tier × topology × loop-pattern** taxonomy (Tier A/B/C × 5 topologies × 10 loop patterns)
- `agent-builder`'s **rung ladder** (skill / project / managed / coded)

A rung-4 coded agent could be Tier A, B, or C; a Tier-B agent could be rung 3 or 4. The relationship is
stated once, loosely (*"Rungs 1–3 still get stages 3 and 4 — but agent-prd runs in fast-pass mode"*), and
the mapping between tier and rung is never given. Two people running the chain on the same job can land on
different (tier, rung) pairs and both pass every gate.

**The abstraction misses the one distinction the product framework calls binding.**
`studio-product-framework/docs/architecture.md` states: *"Two kinds of agents … Builder agent (`agents/`)
writes product code … Runtime agent (`@studio/ai-runtime`) acts for end users in sandboxes; meters credits
… Do not conflate them in docs or APIs."* The word "sandbox" appears **zero times** in the entire agent
framework. So does "credit", "metering", and "tenant isolation as an enforced check" (`MEM-7` mentions
tenant keys for memory, but no tool or gate tests it). A fellow can run the full six-stage chain, clear
every hard gate, and produce a PRD for a runtime agent that never mentions the two constraints the product
framework treats as non-negotiable.

### 1.4 State and memory

**Conversation/task state: a context window.** `agent-builder` calls it "the carrier" and it is the entire
state layer of the pipeline. No file. No schema. No serialisation format. No persistence.

This is a direct violation of the framework's own `LOOP-2` (*"durable, append-only event log that lives
outside the process"*) — applied to the framework itself. And it has already cost them a test result:
Hermes `G5` is logged **PARTIAL** with the reason *"chat deleted before the rung ruling."* The framework
lost a run to exactly the failure mode its rules exist to prevent.

`G7` ("resume from a blocked-spec artefact") is the only mitigation, and it works by having the user
**paste the entire prior artefact back into a fresh chat**. That is a manual, lossy, human-in-the-loop
serialisation protocol with no format specification.

**Concurrency and reentrancy: not applicable, and that is the finding.** Nothing runs concurrently because
nothing runs. But the *design* has an unaddressed reentrancy problem: `agent-builder` Step 2 says
"for each node in the fleet map … run `agent-design`". With N agents, N invocations of stage 2 share one
carrier in one context window, and there is no rule for what happens when agent 3's spec contradicts
agent 1's. Hermes `G8` shows a 2-agent fleet; nothing in the corpus shows 5.

### 1.5 Tool/function interface

There is none — no registration, no schema, no validation, no error propagation, because there is no code.

At the spec level, `agent-design` Step 2 defines a good tool table (job · blast radius · guardrail ·
exercised-by-eval-case) with two sharp rules: a tool no golden case exercises gets cut, and a tool whose
blast radius exceeds the autonomy level does not belong on the agent. `agent-prd` Gate 8 adds the best
material in the repo on this axis — *"verify primitives, don't assume them"*, with specifics on cadences,
triggers, per-connector write access, approval mechanisms, and identity.

**What is missing is the schema.** The framework never says what a tool definition *is* — no JSON Schema,
no TypeScript type, no MCP reference. Meanwhile `studio-product-framework/packages/ai-runtime/src/gateway.ts`
already defines one:

```ts
export type ToolDefinition = {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;  // JSON Schema
};
export type ToolExecutor = (name: string, args: Record<string, unknown>) => Promise<string>;
```

The standard that is supposed to govern how agents get built does not reference the type the studio's own
runtime already ships. That is the cheapest interop win available (see Phase 4).

### 1.6 Orchestration

The pack's orchestration *guidance* is excellent and correctly opinionated: `TOOL-2` ("default to a single
loop … a loop is already a graph with one node"), the topology table with the 3–10× cost note on
orchestrator–worker, the ten loop patterns, and the four exit-condition kinds (verifiable / threshold /
budget / stall) with the rule that you need one of the first two **plus** one of the last two. This is
better-reasoned than the equivalent docs in CrewAI or Mastra.

The pack's own orchestration is a **fixed 5-step linear pipeline with 5 early exits**, executed by a
language model reading prose. Control flow is `Intake → 0b → stage 1 → stage 2 → (2a, 2b) → stage 3 →
stage 4 → chain check`. There are:
- **no retries** — a stage that produces a bad artefact is re-run by the human asking again
- **no timeouts** — the only budget is the model's context window
- **human-in-the-loop hooks: everywhere and nowhere.** Every step is human-in-the-loop because a human is
  typing. There is no *structured* pause, which is what `LOOP-5` demands of the agents it designs

The routing itself is non-deterministic and the repo documents this. Hermes `A5`: with a sibling skill
already loaded, *"the model blended the two requests"*, and the protocol response was to declare such runs
**INVALID rather than failed**. That is methodologically honest and also an admission that the router
cannot be tested under the conditions it will actually run in — a fellow's real chat is never cold.

### 1.7 Observability

**Effectively zero, and this is the sharpest self-inconsistency in the repo.** `STACK-4` mandates
*"Langfuse wired in from the first commit — every tool call, error, and cost traced."* The framework's own
first commit has no tracing of anything. There is no way to know:
- how many times the chain has been run
- how often each gate fires
- which stage people abandon at
- what a chain run costs in tokens
- whether stage 4 output is ever actually used

Hermes' evidence base is *"Loader line 'Loaded agent-design skill'"* and *"screenshots/transcripts"*, and
one of its seven runs was lost because a chat was deleted. The framework that requires eval hooks from
commit one has no eval hook on itself beyond a human with a screenshot tool.

### 1.8 Extensibility — counted, not estimated

**To add a new stage skill** you must touch, at minimum:

1. `<new-skill>/SKILL.md` — new
2. `<new-skill>/template.md` — new
3. `<new-skill>/examples/sample.md` — new
4. `<new-skill>/tests/rubric.json` + `tests/golden/*` + `tests/adversarial/*` + `tests/RESULTS.md` — new
5. `agent-builder/SKILL.md` — the Method checklist, the new Step, the "When NOT" routing table, the
   Related-skills block, and Step 5's chain check
6. `agent-prd/SKILL.md` — Appendix C if it introduces a stack decision; the hard-gate list if it adds a gate
7. `atelier-learnings/SKILL.md` — the pre-flight checklist if it adds a rule
8. `README.md` — the tree, the routing table, and the smoke table (S1–S7)
9. `agent-builder/hermes/cases/golden.md` — a routing case proving it doesn't poach a sibling
10. Every sibling SKILL.md whose "When NOT" table should now route to it

**7–10 files minimum, 5 of them shared.** There is no extension point, no manifest, no registry. Adding a
stage is an edit to the orchestrator's source.

**To add a new rule** is cheap and well-designed: append to `atelier-learnings` in the stated format, add
the eval case, never rewrite (supersede explicitly). This is the one part of the pack that is genuinely
extensible, and it is the part they got right.

### 1.9 Testing, CI, versioning, docs

**Testing — better than most prompt packs, and still not testing.**

What exists, and it is real: five-dimension rubrics with a pass threshold (≥21/25, no dimension <4) and
auto-fail conditions; 9 golden + 5 adversarial Hermes cases; 5 golden + 3 adversarial per stage skill; a
judge protocol that enforces generator≠evaluator and cold context; a stated re-run cadence including a
**bare-model run on every model release as a deprecation signal** — which is a genuinely excellent idea I
have not seen in any of the four comparison frameworks.

What is wrong with it:

1. **No runner. No CI. Every case is executed by a human in a fresh browser tab.** With 26 case files
   across 4 harnesses, a full regression pass is an afternoon of manual chat work — which means it will
   not happen on every edit, which is the stated cadence.
2. **2 of 6 skills have no test kit at all** — `agent-prd` (the largest file, 34% of the corpus) and
   `atelier-learnings` (the rules layer). Hermes' own README defines the studio standard as
   "rubric + ≥5 golden + ≥3 adversarial + RESULTS.md per skill"; the pack ships 4 of 6.
3. **The three stage rubrics are byte-identical** apart from the `"skill"` field. I diffed them. Hermes'
   README says dimensions should be *"renamed to the skill's promises"*. They are not — one generic
   Icarus rubric is applied to three different skills.
4. **The rubric measures conformance, not outcome.** `method_fidelity: "Follows the Icarus method exactly"`
   — where the Icarus method is defined by the document being scored. `proprietary_edge: "Could NOT have
   come from a generic prompt."` A skill can score 25/25 for being internally consistent and distinctive
   while producing agents that fail in production. Every one of the three stage skills scored **24–25/25**.
   Perfect scores on a self-referential rubric are not evidence of quality; they are evidence the rubric
   cannot discriminate. The one gate that would discriminate — `Gate 6 Real-use` — is marked
   **"pending — requires 5+ real fellow uses"** in all three RESULTS files.
5. **The headline result is materially misleading.** The repo README advertises: *"Round 1 (17 Aug 2026):
   6 pass · 1 partial · 0 fail, 24/25 on the rubric."* Reading `hermes/RESULTS.md` and
   `hermes/cases/adversarial.md` together:
   - 9 golden cases exist; **7 were scored** (G8/G9 are back-referenced "reference runs", not in the table)
   - **The 5 adversarial cases are not in the results table at all**
   - `A3` is annotated *"observed: FAILED, uncorrected in-skill"*
   - `A4` is annotated *"observed: FAILED, caught by human review, not the chain"*
   - `RESULTS.md` itself says *"A3 and A4 are live regressions — the chain has not yet demonstrated the
     corrected behaviour unprompted"*

   So "0 fail" is computed over a set that excludes the two known failures, and `gate_integrity` scored
   **5/5** while the two uncorrected regressions are both gate-integrity failures. For a framework whose
   first principle is that nothing grades its own work, the scoring boundary was drawn around the passing
   cases. `RESULTS.md` is honest about this in its "Open items" section; **the README is not**, and the
   README is what people read.

**CI:** absent. **Versioning:** absent — no tags, no CHANGELOG, no `version:` in frontmatter, no
supersession mechanism for the skills themselves (though `atelier-learnings` defines one for its rules).
Three skills carry `supersedes: none` in frontmatter, implying a supersession protocol that is documented
nowhere. **Licence:** absent, on a public repo. **CODEOWNERS / CONTRIBUTING:** absent — feedback routes to
one named person via Slack.

**Docs:** the strongest dimension. The README is clear, correctly ordered, honest about the undecided
harness, and the smoke table (S1–S7) is a real acceptance test a human can run in ten minutes. Losing
points for the Hermes claim above, the nine dangling skill references, and an install path that assumes
Claude.ai Personal Skills and nothing else.

### 1.10 Top five failure modes

Not "in production" — nothing is in production. These are the five ways this pack fails **in use**, each
tied to the text that causes it.

**1 · Rule drift between the pack and reality, with nothing to detect it.**
*Cause:* no version, no CI, no telemetry, no runner. `atelier-learnings` is append-only-by-policy with no
mechanism enforcing it, and its stack decisions (`STACK-1` Convex, `STACK-2` Inngest/Trigger,
`STACK-4` Langfuse) are asserted as settled while `studio-product-framework` mentions **none** of Inngest,
Trigger.dev, Mastra, LangGraph, or Flue anywhere in 291 files. The rules layer and the codebase it governs
are already out of sync and nothing will report it.

**2 · The chain produces a PRD nobody can execute, and the pack cannot tell.**
*Cause:* `agent-prd`'s stated "strategy-doc failure mode" is guarded by a hard-gate checklist that a model
self-assesses. There is no external check that Gates 3/5/8/9 were actually filled. Hermes `A2` is exactly
this failure, and it was **observed failing once** before a patch; the patch has passed once, cold.
n=1 either way.

**3 · Silent divergence from the product framework.**
*Cause:* `agents/context/discovery/eval-first-spec.md` in the product repo is already a fork of the skill,
with a **different pass bar** (see Phase 4). Neither repo references the other's version. A fellow who
fills the product-framework template clears the commit gate at 5 golden cases; the same artefact
auto-fails the standard at <20. Both are "the studio standard".

**4 · Gate inversion at the last gate.**
*Cause:* §1.2(c). Stage 3's kill line (20 cases) is stricter than stage 4's hard gate (10). The final gate
before work orders is the loosest one in the chain.

**5 · Carrier loss.**
*Cause:* §1.4. The entire pipeline state is a chat context window. Tab closed, context compacted, or
session expired ⇒ full restart, or a manual paste-the-artefact-back protocol with no specified format.
Already observed once (`G5`).

---

## Phase 2 — Architecture visualisation

Two-level Mermaid diagrams with per-edge provenance: **[`audit/architecture.md`](./architecture.md)**.

I fetched the `architecture-map` skill as instructed. Its method is *"Prose, groups and flows are authored;
counts, coverage and geometry are measured"* — buildings sized by code weight, lines drawn along real call
paths. With zero code and zero call paths there is nothing to measure, so applying it would mean inventing
the measured half. It is **inapplicable rather than unavailable**; I used Mermaid and labelled every
inferred edge.

---

## Phase 3 — State-of-the-art comparison

### The comparison is category-mismatched, and that is the most useful output of this phase

LangGraph, CrewAI, Mastra, and Flue are **runtimes**: you `pip install` / `npm i` them and they execute a
loop. `studio-standard-agent-framework` is a **specification and governance layer**: you read it and it
tells you what to build. On the nine dimensions you asked for, "Ours" is empty in six of them — not because
the work is bad, but because those dimensions describe a runtime and this is not one.

The honest read: **you do not have a competitor to these. You have the layer that sits above whichever one
you pick, and you have not picked one.** The table is filled in on that basis.

### Additions and why

- **`@convex-dev/agent`** (Apache-2.0, 344★, active). Added because `STACK-1` names Convex as sole source
  of truth and `STATE-1` demands resume-from-Convex-alone. This is the only candidate whose state lives in
  Convex **by construction**. It is not in your bake-off table and it should be the front-runner.
- **OpenAI Agents SDK** (MIT, 28.9k★). Added as the minimal-runtime baseline — `EVAL-4` demands a naked
  baseline before scaffolding, and this is the closest thing to "a loop and nothing else" with real
  adoption.
- **Pydantic AI** (MIT, 19.5k★). Added as the type-safety reference point, since "type safety" is one of
  your nine dimensions and none of your four listed candidates leads on it.

### Comparison table

Stars, licences, and release dates read from the GitHub API on 2026-08-25. Capability rows for Mastra and
Flue are from their own marketing sites — I did not read either source tree, and I mark that inline.

| Dimension | **Ours** | LangGraph | CrewAI | Mastra | Flue | @convex-dev/agent | OpenAI Agents SDK | Pydantic AI |
|---|---|---|---|---|---|---|---|---|
| **Agent abstraction model** | Prose spec: role · tools · memory · eval. No executable type | `StateGraph` — typed state, nodes, conditional edges | `Agent` w/ role·goal·backstory; `Crew`; `Flow` | `Agent` + `Workflow` primitives *(site)* | Stateful HTTP-addressable agents + subagents *(site)* | `Agent` bound to a Convex `Thread` | `Agent` + handoffs | `Agent[Deps, Output]`, generic over deps & output |
| **Orchestration primitives** | Fixed 5-step linear doc pipeline, 5 early exits, executed by a human+model | Graph: cycles, branches, `Send` fan-out, subgraphs, interrupts | Sequential/hierarchical crews; Flows w/ event routing | `.then() .branch() .parallel()` *(site)* | Workflows + subagent delegation *(site)* | Threads + Convex Workflow component (durable, multi-step) | Handoffs, guardrails, sessions | Graph + typed tool loop |
| **State/memory handling** | **A chat context window.** Four-tier model specified, zero implementations. Two conflicting store models in-repo | Pluggable `BaseCheckpointSaver`; `checkpoint-postgres`, `checkpoint-sqlite`, **+ a `checkpoint-conformance` suite** | Short/long-term memory, RAG-backed | Working + semantic memory *(site)* | "Persistent state" + durable stream *(site)* | **Messages/threads persist in your own Convex tables**; hybrid vector+text search built in | Sessions | Dependency injection; persistence is yours |
| **Tool interface ergonomics** | Tool *table* (job · blast radius · guardrail · eval case). No schema, no type, no MCP reference | `@tool` decorator, Pydantic-validated args | `@tool` decorator / `BaseTool` | Typed tools; authors MCP servers *(site)* | Tools + Skills + MCP *(site)* | Tools typed against Convex ctx; MCP-compatible | `@function_tool`, auto schema from signature | **Best-in-class**: Pydantic-validated in and out |
| **Observability & eval** | **None on itself.** Mandates Langfuse (`STACK-4`) and ships zero tracing. Hermes = manual transcripts + screenshots | LangSmith (proprietary, paid) + OTel | CrewAI AMP (proprietary) + OTel | Built-in scorers + observability *(site)* | OTel → Braintrust / Sentry / own *(site)* | Usage tracking per user/model/agent; agent playground; Convex dashboard | Built-in tracing | OTel + Pydantic Logfire |
| **Modularity / embeddability** | **Anti-modular by design statement** — *"Install all six. They are a chain, not a menu."* Manual upload to Claude.ai Personal Skills | Library — embeds anywhere Python runs | Library, heavier defaults | Library + its own server | Library + sandbox runtime | **Convex component** — installs into an existing deployment | Library, thin | Library, thin |
| **Type safety** | n/a — Markdown | Python typing + Pydantic; TS port | Pydantic | TypeScript, strict | TypeScript | TypeScript, end-to-end with Convex validators | Python typing | **Strongest** — generics enforced at call sites |
| **Production maturity** | **2 commits, 1 author, 0 releases, no CI, no licence, created today** | 40.4k★, 6.8k forks, MIT, **1.x stable** (1.2.11, 11 Aug 2026), independently versioned checkpoint libs | 57.6k★, MIT, 1.15.17 (20 Aug 2026), very high release cadence | 27.5k★, `@mastra/core@1.61.0` (24 Aug 2026), ~1 minor/week — **fast-moving surface** | 8.0k★, Apache-2.0, created Feb 2026, **no GitHub releases**, last push 8 Aug 2026 | 344★, Apache-2.0, active (24 Aug 2026) — **small ecosystem** | 28.9k★, MIT, very active | 19.5k★, MIT, very active |
| **Licence & adoption risk** | **No licence file on a public repo** — default: all rights reserved, nobody may legally reuse it | MIT — low. LangSmith lock-in is opt-out | MIT — low. AMP is the upsell | **`NOASSERTION`** on GitHub; site says Apache-2.0 core + source-available enterprise licence. **Verify before adopting** | Apache-2.0 — low, but young and pre-release | Apache-2.0 — low, but ties you to Convex (**already your decision**) | MIT — low; OpenAI-shaped defaults | MIT — low |

### Build vs. adopt vs. wrap

**The finding that changes the bake-off.** `STATE-1` as written — *"Kill the process, start a fresh one, it
must resume from the Convex log alone. If resume needs the vendor file, the design fails"* — **disqualifies
every harness that owns its own state store.** Mastra failed the gate-6 probe for exactly this reason
(`harness_run_id` in its LibSQL store). Flue's site describes a "durable stream" — its own store, so it will
fail identically. LangGraph writes to its own checkpointer. CrewAI has its own memory backends.

**As written, the bake-off has a predetermined answer of "none."** You are not running a comparison; you are
running a rule that only one architecture can satisfy. Two ways out, and you must pick one before any probe
is worth running:

- **(A) Amend `STATE-1` with an adapter clause.** A vendor state store is permitted **iff** it is backed by
  a Convex-write-through adapter that makes Convex the canonical log, and the kill-test passes against a
  fresh process with the vendor's local file deleted. LangGraph makes this cheapest: `libs/checkpoint`
  is a designed extension point and `libs/checkpoint-conformance` is a **conformance suite you can run a
  Convex checkpointer against** — an off-the-shelf test for exactly your rule.
- **(B) Keep `STATE-1` absolute** and adopt the one candidate that satisfies it by construction:
  `@convex-dev/agent`, where threads and messages *are* Convex tables.

| Component | Verdict | Reasoning |
|---|---|---|
| `atelier-learnings` rule corpus | **BUILD — already built, protect it** | 38 dated, failure-traced rules. Nothing comparable ships in any of the eight. This is the actual asset |
| Rung ladder (skill/project/managed/coded) + `HOME-2` default-down | **BUILD** | Every SOTA framework's docs assume you're writing code. "You need less than you asked for" is a studio-specific, correct opinion |
| Gate 1B run-sequence table (named pauses) | **BUILD** | The best non-engineer-legible artefact in either repo |
| Eval contract format (20 cases, 6/7/4/3 spread, 14-`[Fact]` floor, derived failure rates, cost-per-outcome) | **BUILD** | Genuinely differentiated. No comparison framework prescribes a golden-set *composition* |
| Hermes judge protocol (generator≠evaluator, cold context, bare-model deprecation run) | **BUILD** | The bare-model run on every model release is an original and valuable idea |
| **Agent loop / durable execution** | **ADOPT** | You have written zero loops in two repos. `packages/ai-runtime/gateway.ts` explicitly says *"One round only… No multi-hop agent loop"* |
| **Run state / event log** | **ADOPT `@convex-dev/agent`** | Apache-2.0. State in your Convex. Satisfies `STACK-1`, `MEM-7`, `MEM-8`, `STATE-1` by construction. Usage tracking per user/model plugs into your existing `wallets` + `walletTransactions` ledger. Integration surface: a Convex component mounted in `apps/web/convex/convex.config.ts`. **Lock-in risk: low-moderate** — ties agent state to Convex, which `STACK-1` already committed you to; data stays in tables you own and can export |
| Tracing / cost accounting | **ADOPT — already chosen** | Langfuse (`STACK-4`) is already implemented in `packages/observability/src/langfuse.ts`. Wire it, don't re-decide it |
| Durable execution / retries | **ADOPT — already chosen** | Inngest or Trigger.dev (`STACK-2`). But note: **neither appears anywhere in the product framework**. Convex Workflow component is the lower-friction third option given `STACK-1` |
| Graph orchestration | **WRAP, later, only if `TOOL-2` is beaten** | LangGraph, MIT. Only when someone writes down what fails with a single loop. Integration surface: a Python service behind an HTTP boundary. **Lock-in risk: low** (MIT, pluggable checkpointer); **LangSmith lock-in: opt-out, avoid it — you have Langfuse** |
| Mastra | **DO NOT ADOPT on current evidence** | Failed your `STATE-1` probe; `NOASSERTION` licence on GitHub vs Apache-2.0 claimed on the site — resolve that before any further probe; ~1 minor release/week is a fast-moving surface for a "set in stone" standard |
| Flue | **PROBE, expect the same `STATE-1` result** | Apache-2.0, 8.0k★, but created Feb 2026 with **no tagged releases** and last push 8 Aug 2026. Its "durable stream" is its own store. **Adoption risk: high** — six months old, pre-release, for a studio-wide standard |
| CrewAI | **SKIP** | Role/goal/backstory crews are the multi-agent-by-default pattern your own `TOOL-2` argues against. Adopting it would contradict your rules layer |

---

## Phase 4 — Interoperability with `studio-product-framework`

I read the product framework's `AGENTS.md`, `agents/`, `docs/architecture.md`,
`docs/production-readiness.md`, `packages/ai-runtime/src/*`, `packages/observability/src/*`,
`packages/effect-critical/`, and `apps/web/convex/schema.ts`.

### 4.1 There is currently no integration seam. There is one fork.

**The fork.** `studio-product-framework/agents/context/discovery/eval-first-spec.md` is a divergent copy of
the `eval-first-spec` skill. Both are called the studio standard. They disagree on the pass bar:

| | `studio-standard-agent-framework/eval-first-spec/SKILL.md` | `studio-product-framework/agents/context/discovery/eval-first-spec.md` |
|---|---|---|
| Golden cases | **20 required. "Fewer than 20 cases … is auto-fail"** | **"target 20; minimum 5 to start commit"** |
| Composition | Fixed spread ≥6 typical / ≥7 edge / ≥4 adversarial / ≥3 must-refuse | None |
| Reality floor | **≥14 of 20 must be `[Fact]`** | None |
| Mode coverage | Every failure mode reachable by ≥1 case | None |
| L1 | "Drafts — proposes the output; human reviews and commits every one" | "Suggest + human confirm" |
| L2 | "**Acts on approval** — prepares the action; human approves per item or batch" | "**Act in narrow band + audit**" |
| Acceptable rate | Derived: `tolerable_cost_per_cycle ÷ cost_of_one_failure` | Free-text table cell |
| Cost | `(C_attempt × A) + C_human + C_remediation`, gated against value | "Target cost per outcome (to the cent)" |
| Platform mapping | absent | present (§5, Studio Product Framework defaults) |

L2 is not a wording difference — "acts on approval" and "acts in a narrow band with audit" are different
autonomy semantics with different blast radii. A fellow filling the product template clears the commit gate
at **5** cases; the same artefact **auto-fails** the standard.

**The governance conflict.** `studio-product-framework/docs/architecture.md` states: *"Icarus is the
discovery playbook — do not duplicate it here."* `studio-standard-agent-framework/README.md` states the
Icarus modules are *"bundled here unchanged so the chain is testable in one place."* One repo forbids
duplication; the other is built on it; and the product repo duplicated it anyway, divergently.

### 4.2 Contract mismatches, named

| # | Mismatch | Standard says | Product framework says / has | Severity |
|---|---|---|---|---|
| 1 | **Agent kind** | Never distinguishes them. "sandbox", "credit", "metering" appear **0 times** | `docs/architecture.md`: *"Two kinds of agents… Do not conflate them in docs or APIs."* Runtime agents **must** sandbox (`run-agent.ts` hard-fails without `requireSandbox: true`) and meter credits | **Blocking** |
| 2 | **The `STATE-1` log has no schema to resume from** | `STATE-1`: *"resume from the Convex log alone"* | `apps/web/convex/schema.ts` has `users`, `subscriptions`, `webhookEvents`, `wallets`, `walletTransactions`, `inferenceRuns`. **No `agentRuns`. No `agentEvents`. No append-only run log.** `inferenceRuns` is per-call, not per-run-event | **Blocking** — the kill-test is currently unrunnable against studio infrastructure |
| 3 | **Memory doctrine, three ways** | `MEM-1`/`MEM-7`: four tiers, Convex, tenant-keyed, indexed, structured. `agent-design`: `CLAUDE.md` + `skills/` + `lessons.md` + trace archive | `AGENTS.md` + `docs/hivemind.md`: **Hivemind (Deeplake)** for session/team memory; **git** for durable truth. `MEM-8` demands queryability outside the writing tool — Deeplake is a third store neither doc accounts for | **High** |
| 4 | **Tool definition type** | No schema specified | `packages/ai-runtime/src/gateway.ts` already exports `ToolDefinition` (name/description/JSON-Schema params) and `ToolExecutor` | **Medium — cheapest fix in the list** |
| 5 | **Eval pass bar** | 20 cases hard | 5 cases minimum to commit | **High** |
| 6 | **Runtime home vocabulary** | `HOME-1`: Utopia OS / standalone Vercel / local | `docs/architecture.md`: Convex + Clerk + Vercel. **"Utopia OS" appears nowhere in the product framework** | **Medium** |
| 7 | **Durable execution vendor** | `STACK-2`: Inngest default, Trigger.dev for sovereign | Neither string appears in 291 files. Convex Workflow/Workpool components are what's actually referenced | **Medium** |
| 8 | **Surface model** | `workflow-design` Step 5: Claude.ai / Claude Code / Cowork | `docs/architecture.md`: *"Authoring ≠ runtime"* — these are authoring tools | **Medium** |
| 9 | **Autonomy ladder semantics** | L0 Informs … L4 Autonomous | Different L1/L2 wording in the forked template | **High** (same as #5) |

### 4.3 What the product framework already gives you for free

These are real, named, and currently unused by the standard:

- `packages/ai-runtime/src/types.ts` — `AgentRunRequest` (`runId`, `userId`, `goal`, `turns`,
  `requireSandbox`, `maxTurns`, `maxSpendCredits`), `AgentRunStatus` (`queued | running | awaiting_tool |
  succeeded | failed | cancelled`), `AgentRunResult`. **This is your run contract. It exists.**
- `packages/ai-runtime/src/budget.ts` — `assertWithinBudget()` enforces `LOOP-3`'s budget guard in code,
  with **no default cap** (a caller must state one). This is `LOOP-8` ("cap fan-out in code, not in a
  prompt") already implemented.
- `packages/ai-runtime/src/gateway.ts` — `ToolDefinition`, `ToolExecutor`, `ToolConfig`.
- `packages/observability/src/events.ts` — `StudioEvents` already contains `agentRunStarted`,
  `agentRunSucceeded`, `agentRunFailed`, `inferenceCompleted`. **The event vocabulary exists.**
- `packages/observability/src/langfuse.ts` — `STACK-4`, implemented, no-ops without keys.
- `packages/effect-critical/` — `wallet.ts`, `meteredInference.ts`, with tests. Cost-per-outcome
  (`eval-first-spec` Part 4) has a real ledger to measure against.
- `apps/web/convex/schema.ts` — `wallets` + `walletTransactions` with an **`by_idempotency` index**.
  `LOOP-6` ("steps are idempotent; a retry never double-executes") is already enforced for money.

**And what is dead:** `startAgentRun` is exported from `@studio/ai-runtime` and **called from nowhere**
(grepped across all `.ts`/`.tsx`). `agentRunStarted`/`Succeeded`/`Failed` are defined and **emitted
nowhere**. `run-agent.ts` validates, budget-gates, opens a sandbox, returns `status: "running"` — and
stops. Its own comment defers the loop: *"Whoever builds the multi-turn execution loop on top of this
package must call `assertWithinBudget` before every turn."* `gateway.ts` says *"One round only… No
multi-hop agent loop."* `docs/production-readiness.md` still lists *"Sandbox provider for runtime agents"*
as required.

**There is no agent loop anywhere in the studio.** Not in the standard, not in the product framework.

### 4.4 The minimum interface set for clean modularity

Five contracts. Everything else can stay prose.

1. **`AgentManifest`** — the machine-readable output of the chain, one file per agent, versioned in git.
   Fields, all required: `kind: "builder" | "runtime"` (mismatch #1) · `rung: 1|2|3|4` · `tier: "A"|"B"|"C"` ·
   `runtimeHome` · `talkSurface` (`HOME-1`) · `toolIdentity` (`ID-1`) · `autonomy: "L0".."L4"` ·
   `evalContractRef` · `memoryTiers` (4 keys, `"unused"` permitted) · `waivers: [{ruleId, reason, date}]`.
   **This is the missing artefact.** Today the chain's output is a `.docx` — unparseable, ungateable,
   undiffable. Home: `studio-standard-agent-framework/schema/agent-manifest.schema.json`, consumed by the
   product framework's `commit-v1` loop.

2. **Adopt the existing tool type.** Delete the prose tool schema question; `agent-design` Step 2's tool
   table gains a `schemaRef` column pointing at a `ToolDefinition` from
   `@studio/ai-runtime`. Mismatch #4 closes for roughly zero effort.

3. **`agentRuns` + `agentEvents` Convex tables**, tenant-keyed and indexed, in
   `apps/web/convex/schema.ts`. Without these, `STATE-1` is unrunnable (mismatch #2) and the entire
   §"STATE-1 kill-test" section of the README describes a test with no target. Suggested minimum:
   `agentRuns(runId, userId, manifestRef, status, startedAt, endedAt)` indexed `by_user` and `by_run`;
   `agentEvents(runId, seq, type, payload, createdAt)` indexed `by_run_seq`, append-only, never mutated
   (`LOOP-6`, `MEM-3`).

4. **One eval contract, one file, one bar.** Delete
   `studio-product-framework/agents/context/discovery/eval-first-spec.md` and replace it with a pointer to
   the skill, or vice versa. Whichever survives, the number is stated once. Closes mismatches #5 and #9.

5. **Emit the events that already exist.** `startAgentRun` writes `StudioEvents.agentRunStarted` to
   `agentEvents` and to Langfuse. That single wire turns `STACK-4` from an assertion into a fact and gives
   the framework its first observability of itself.

---

## Phase 5 — Scoring

Scored against your stated goal: *a standardised, set-in-stone, modular framework for how the studio builds
agents, interoperable with the product framework.*

### Overall: **4 / 10**

A genuinely excellent rules document and PRD interview, packaged as an unversioned, unlicensed, untestable
folder of Markdown with three internal contradictions, nine dangling dependencies, and a live fork against
the repo it is meant to interoperate with. The content would score 8. The container scores 2. You asked for
a framework; this is a very good draft of the *specification* half of one, and none of the runtime half.

| Dimension | Score | One-line reason |
|---|---:|---|
| Architecture | **5** | Coherent 3-layer intent; three unreconciled layer violations; one file is 34% of the corpus |
| Agent abstraction | **3** | Good spec shape, three competing taxonomies, misses the builder/runtime distinction the product framework calls binding |
| Modularity | **3** | *"Install all six. They are a chain, not a menu"* — anti-modular by its own statement; no package, no version, no import |
| Extensibility | **3** | Adding a stage touches 7–10 files, 5 shared. Adding a *rule* is excellent — that part is a 9 |
| Observability | **2** | Mandates Langfuse from commit one; ships zero tracing of itself. Evidence base is screenshots |
| Testing | **4** | Real rubrics, real adversarial cases, honest judge protocol — all manual, 2 of 6 skills unharnessed, identical rubrics, known failures excluded from the headline |
| Documentation | **7** | Best dimension. Clear, honest about the undecided harness, S1–S7 is a real acceptance test. Loses points for the Hermes claim, 9 dangling refs, no licence |
| Production readiness | **2** | Nothing runs. `STATE-1`'s kill-test has no target schema to run against |
| SOTA competitiveness | **3** | On the runtime axis, not competitive — it isn't a runtime. On the governance axis it is genuinely ahead, and that axis isn't in the table |

### Remediation for every score below 7

**Architecture — 5**

- *What:* Resolve the three layer violations by making `atelier-learnings` mechanically supreme instead of
  rhetorically supreme.
- *Where:* `agent-design/SKILL.md` Step 3 (memory stores); `workflow-design/SKILL.md` Step 5 (surfaces);
  `agent-prd/SKILL.md` hard-gate list line "At least ten eval tasks" + Appendix C "Working / Episodic /
  Compounding".
- *Why:* Today a fellow can follow stage 2 exactly and violate `MEM-3`, `MEM-7`, `MEM-8`, and `STACK-1`
  simultaneously, and pass every gate.
- *How:* In `agent-design` Step 3, replace the four-store table with a rung-conditional one — rungs 1–3 use
  `CLAUDE.md`/`skills`/`lessons.md`/traces; rung 4 uses `agentEvents` (episodic), a tenant-keyed
  `semanticFacts` table (semantic), `skills/` in git (procedural), assembled-per-call (working) — and add
  the line *"At rung 4, a Markdown store fails `MEM-7`."* In `workflow-design` Step 5, retitle the column
  **"Authoring surface"** and add a required adjacent field **"Runtime home (`HOME-1`) — a different
  answer."** In `agent-prd`, change "At least ten eval tasks" to *"the eval contract from stage 3, at its
  own bar (20 cases, ≥14 `[Fact]`)"* and fix Appendix C to name all four tiers.

**Agent abstraction — 3**

- *What:* Add `kind: builder | runtime` as a required Gate 0 field with kind-conditional gates.
- *Where:* `agent-prd/SKILL.md` Gate 0 "Implementation surface" block and the hard-gate checklist;
  `agent-builder/SKILL.md` Step 0b.
- *Why:* Without it, the chain emits PRDs for user-facing runtime agents with no sandbox requirement and no
  credit ceiling — the two things `packages/ai-runtime` hard-fails without.
- *How:* Ask it as intake question 5b. When `kind: runtime`, add three mandatory rows to the hard gates:
  sandbox provider named; `maxTurns` and `maxSpendCredits` stated as numbers (they map 1:1 onto
  `AgentBudget`); tenancy boundary named and its enforcing check named. Then publish the tier↔rung mapping
  as a 4×3 table in `agent-prd` Appendix B so the two taxonomies stop floating free.

**Modularity — 3**

- *What:* Give the pack a package identity and a version.
- *Where:* repo root — `VERSION`, `CHANGELOG.md`, `LICENSE`; frontmatter `version:` on all six SKILL.md.
- *Why:* "Set in stone" with no version means no one can say which stone. A fellow who installed on 17 Aug
  and one who installs today are running different rules with no way to tell.
- *How:* Semver the pack as a whole (`1.0.0`), stamp each SKILL.md with `pack_version: 1.0.0`, tag the
  repo, and add one line to `agent-builder` Step 5's chain check: *"state the pack version in the
  deliverable."* Then decide distribution — git submodule into `studio-product-framework`, or a published
  bundle. Manual upload of six folders to Claude.ai Personal Skills is not a distribution mechanism.

**Extensibility — 3**

- *What:* Extract the five things every stage restates into one included file.
- *Where:* new `_shared/` — `memory-table.md`, `evidence-ladder.md`, `kill-line.md`, `rung-ladder.md`,
  `gen-not-eval.md`. Referenced from each SKILL.md instead of restated.
- *Why:* The evidence ladder (money 1.0 → opinion 0.1) is copied verbatim into three skills; the memory
  table into three; gen≠eval into four. Every one is an independent drift point, and `agent-builder` Step 5
  exists solely to re-reconcile drift the structure creates.
- *How:* One file per shared concept, each skill links rather than copies. `agent-builder` Step 5 then
  shrinks from "reconcile three vocabularies" to "assert the shared files were loaded."

**Observability — 2**

- *What:* Instrument the chain itself.
- *Where:* the `AgentManifest` (Phase 4 §4.4 item 1) plus a `runs/` log in this repo.
- *Why:* You cannot run `EVAL-9`'s scaffolding-removal experiment, or the bare-model deprecation run, or
  know your abandonment stage, without a record of runs. Right now the only artefact of a chain run is a
  `.docx` and a memory.
- *How:* Every completed chain emits a manifest JSON committed to `runs/YYYY-MM-DD-<slug>.json` carrying
  pack version, model, rung, tier, gates fired, blockers fired, and stage reached. Ten of those make the
  first honest statement about whether the pipeline works. Then wire Langfuse for rung-4 builds.

**Testing — 4**

- *What:* (a) correct the headline; (b) build a runner; (c) cover the two unharnessed skills;
  (d) differentiate the rubrics.
- *Where:* `README.md` line *"Round 1 … 6 pass · 1 partial · 0 fail"*; new `harness/run.ts`;
  new `agent-prd/tests/` and `atelier-learnings/tests/`; the three identical `tests/rubric.json`.
- *Why:* The README currently overstates the evidence — A3 and A4 are documented failures excluded from the
  scored set while `gate_integrity` scored 5/5. In a pack whose first principle is that nothing grades its
  own work, that is the most damaging possible defect, and it is a five-minute fix.
- *How:* (a) Change the line to *"6 golden pass · 1 partial · 2 adversarial failing (A3, A4) · 2 golden
  unscored (G8, G9)"* and add the adversarial rows to `RESULTS.md`. (b) Write `harness/run.ts`: read a case
  file, call the Anthropic API with the skill(s) as system content, dump the transcript to
  `harness/transcripts/`, then a second call with `rubric.json` + case + transcript as the judge, emitting
  scored JSON — that is the generator≠evaluator protocol, automated, and it makes the "run twice on every
  model release" cadence realistic. (c) `atelier-learnings` is testable as a *detector*: feed it designs
  that violate `LOOP-3`, `CTX-6`, `MEM-7` and assert the right rule ID is cited. (d) Rename each rubric's
  five dimensions to that skill's own promises, per Hermes' own stated standard.

**Documentation — 7** (at bar; listed for completeness)

- Add `LICENSE` (a public repo with no licence is legally unusable by anyone, including other Utopia
  entities). Resolve the nine dangling skill references — vendor them, or mark them external with URLs and
  say what a fellow does when a blocker routes to a skill they do not have.

**Production readiness — 2**

- *What:* Make the `STATE-1` kill-test runnable.
- *Where:* `studio-product-framework/apps/web/convex/schema.ts` (add `agentRuns`, `agentEvents`);
  `packages/ai-runtime/src/run-agent.ts` (write the first event); a probe repo for the bake-off.
- *Why:* The README devotes a section to a kill-test — *"Prove it by killing the process"* — against a log
  that does not exist in any studio system. It cannot currently be run at all, which means neither Mastra's
  failure nor Flue's eventual result is measured against a real target.
- *How:* Add the two tables (schema in Phase 4 §4.4 item 3). Wire `startAgentRun` to append `run.started`.
  Then run the bake-off against a real Convex log, with the `STATE-1` adapter clause decided first —
  otherwise every candidate fails by construction.

**SOTA competitiveness — 3**

- *What:* Stop competing on the runtime axis. Declare the layer, adopt underneath it.
- *Where:* `README.md` opening paragraph; `agent-prd` Appendix C "Runtime harness (rung 4)".
- *Why:* Framing this as "our agent framework" invites a comparison it loses on eight of nine dimensions
  and obscures the one it wins on. Positioned as *the governance and eval layer over an adopted runtime*,
  it is genuinely ahead of all eight comparators — none of them ships a failure-traced rule corpus, a
  default-down rung ladder, or a golden-set composition standard.
- *How:* Rewrite the README's first paragraph as *"the studio's specification, gating, and eval standard
  for agents — runtime-agnostic, with the harness chosen per `TOOL-3`'s fit gates."* Add
  `@convex-dev/agent` to Appendix C's bake-off table, and add the `STATE-1` adapter clause so the table can
  reach a verdict.

---

## Phase 6 — Decision list

Ordered by impact-to-effort. Effort is engineer-days for one competent engineer.

| # | Recommendation | Impact | Effort | Risk if skipped | Y/N |
|---:|---|---|---:|---|:--:|
| 1 | Correct the Hermes headline in `README.md` and add the 5 adversarial rows (incl. A3/A4 failing) to `hermes/RESULTS.md` | High | **0.25** | A pack built on "nothing grades its own work" publishes a self-scored result that hides its two known failures. Credibility damage on first careful read | |
| 2 | Add `LICENSE` (Apache-2.0 or MIT) to `studio-standard-agent-framework` | High | **0.25** | Public repo, no licence = all rights reserved. No one may legally reuse it, including other Utopia entities and clients | | 
| 3 | Fix the eval-bar contradiction: `agent-prd`'s hard gate cites stage 3's contract instead of restating "ten" | High | **0.5** | The last gate before work orders is looser than the kill line three stages earlier. Gate inversion | |
| 4 | Add the `STATE-1` adapter clause (or declare `STATE-1` absolute) in `atelier-learnings` before any further bake-off probe | **Very high** | **1** | As written, `STATE-1` disqualifies every harness with its own store. The bake-off cannot terminate; Flue's probe will "fail" for a reason that has nothing to do with Flue | |
| 5 | Add `@convex-dev/agent` (Apache-2.0) to the Appendix C bake-off table as a candidate | **Very high** | **0.5** to list<br/>**3** to probe | The only candidate satisfying `STATE-1` by construction is not being evaluated. You may run a months-long bake-off and conclude "none" | |
| 6 | Resolve the fork: one `eval-first-spec`, one pass bar, one autonomy ladder — delete or point the other | **Very high** | **1** | Two "studio standards" with different bars (5 vs 20 cases) and different L2 semantics, in two repos, already live | |
| 7 | Add `kind: builder \| runtime` as a required Gate 0 field, with sandbox + `maxTurns` + `maxSpendCredits` mandatory when `runtime` | **Very high** | **1** | The chain emits PRDs for user-facing agents with no sandbox and no spend ceiling — the two things `@studio/ai-runtime` hard-fails without | |
| 8 | Rung-condition the memory model in `agent-design` Step 3; fix Appendix C's three-name/four-tier error | High | **1** | Following stage 2 exactly violates `MEM-3`, `MEM-7`, `MEM-8` and `STACK-1` at once, and passes every gate | |
| 9 | Resolve the 9 dangling skill references — vendor, or mark external with a URL and a "what to do if you don't have it" line | High | **1** | Two of them are *blocker exits*. The chain stops and routes a fellow to a skill they do not have | |
| 10 | Retitle `workflow-design` Step 5 to "Authoring surface" and add a required adjacent `HOME-1` runtime-home field | Medium | **0.5** | Stage 1 hands stage 4 a surface built from a vocabulary the rules layer classifies as authoring-only | |
| 11 | Version the pack: `VERSION` + `CHANGELOG.md` + `pack_version` frontmatter on all six + a git tag | High | **1** | "Set in stone" with no version. Two fellows run different rules with no way to detect it | |
| 12 | Define `AgentManifest` JSON Schema as the chain's machine-readable output, alongside the `.docx` | **Very high** | **3** | The chain's only output is an unparseable document. Nothing downstream can gate on it, diff it, or count it. This is the keystone interop artefact | |
| 13 | Add `agentRuns` + `agentEvents` tables to `apps/web/convex/schema.ts` and emit `agentRunStarted` from `startAgentRun` | **Very high** | **4** | `STATE-1`'s kill-test has no target. `STACK-4` is an assertion, not a fact. `startAgentRun` and the `agentRun*` events stay dead code | |
| 14 | Build `harness/run.ts` — automated case runner + separate-judge scorer emitting scored JSON | High | **5** | 26 manual cases across 4 harnesses means the "full set on every edit, twice on every model release" cadence will not happen | |
| 15 | Extract `_shared/` (memory table, evidence ladder, kill line, rung ladder, gen≠eval) and link instead of restating | Medium | **2** | Five concepts copied across 3–4 files each. Every copy is a drift point; `agent-builder` Step 5 exists only to re-reconcile drift the structure creates | |

**Total if all fifteen: ~21 engineer-days** (~24 including the item-5 probe). Items 1–3 are 1 day combined
and I would do them today.

### What I'd deep-dive on request, and what I'd need from you

| Deep dive | What I'd need |
|---|---|
| **The `STATE-1` adapter clause, written as a rule with a conformance test** | Confirmation of (A) adapter-clause vs (B) absolute. If (A): permission to prototype a Convex checkpointer against LangGraph's `libs/checkpoint-conformance` suite |
| **`@convex-dev/agent` probe against `STATE-1`** | A throwaway Convex deployment I may write to, plus your W-01 waiver format if the probe log can't be in the production deployment |
| **The `AgentManifest` schema, drafted** | Which side owns it (I'd argue the standard repo, consumed by `commit-v1`), and whether the `.docx` stays primary for non-engineers |
| **`harness/run.ts` built and the current 26 cases run through it** | An Anthropic API key with a budget I may spend, and a decision on whether transcripts are committed or gitignored |
| **Full read of the 9 missing Icarus skills for contradictions with `atelier-learnings`** | Access to the Icarus pack — it is referenced by module number in five places and I have not read any of it |
| **Whether `agent-prd` should be split** | 1,435 lines is beyond what a model reliably holds. I'd want 3–5 real chain transcripts to see where stage-4 adherence actually degrades — the Hermes A2 case suggests it does |
| **Product-framework test-suite health** | Permission to `pnpm install` and run `pnpm test` / `typecheck`. I did **not** run them; the 4 test files are reported as present, not as passing |

### Placeholders you left unfilled, and what I assumed

| Placeholder | Assumed | Change it if wrong |
|---|---|---|
| Branch | `main` (default on both) | — |
| Clone target | `/Users/kp/Studio Agent Framework/` (was empty) | — |
| Primary language/runtime | **TypeScript**, from the product framework (317 KB TS) and every stack decision in Appendix C. The standard repo has no language | If Python is in play, LangGraph's position improves materially |
| Deployment context | Convex + Clerk + Vercel, from `docs/architecture.md` | — |
| Team size / skill level | **2 engineers + non-technical fellows** — inferred from 2 contributors on the product repo, 1 on the standard, and the rung ladder's explicit non-builder path | This is the assumption most likely to be wrong and it drives items 12–14. A 2-person team cannot maintain a 6-document pack *and* a bake-off *and* a runner without cutting something |
| Diagram output format | Mermaid in Markdown (+ this report as an Artifact) | Say the word for rendered SVG |
| Diagram save path | `audit/architecture.md` in the working directory — **not** inside either repo, per your no-writes rule | — |
