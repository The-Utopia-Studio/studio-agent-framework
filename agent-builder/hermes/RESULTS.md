# Hermes RESULTS — round 1, 17 Aug 2026
Runner: Haniyah (fresh chats per protocol). Judge: separate Claude instance
against rubric.json + screenshots/transcripts. Skill version: agent-builder
post-17-Aug patches (wedge gate, named blocker exits, Step 4 pre-emit check,
description 960 chars).

| Case | Verdict | Evidence |
|---|---|---|
| G1 design→agent-design | ✅ PASS | Loader line "Loaded agent-design skill", cold context |
| G2 fleet→workflow-design | ✅ PASS | Loader line, cold context (first attempt invalid — see A5) |
| G3 zero-context entry | ✅ PASS | agent-builder loaded; intake-first; real Step 0 questions batched 3+2; carrier purpose stated; Q2 blocker inline |
| G4 verb boundary | ✅ PASS | Same subject as G1, build-verb → agent-builder; questions contextualized (Linear/Notion/Convex); Q4 pre-filled from memory, declared |
| G5 proportionality | ◐ PARTIAL | Routing ✓, "minimizing intake questions" thinking line ✓; chat deleted before rung ruling — complete next round |
| G6 haiku kill line | ✅ PASS | Both gates named in one blocker before any config; remedy priced ("cost of five haikus instead of a build"); unprompted embargo guardrail; rung 3 managed ruling with reasons |
| G7 resume from artefact | ✅ PASS | Resumed at stage 3 Part 2; zero re-asks; rates derived incl. rate-invariance proof of the economic gate; B5 refused on unfit evidence (zero-attrition sample) and converted to instrumented open question; chain effects propagated |

**Round total: 6 pass · 1 partial · 0 fail.**

Rubric scoring (round-level, judge assessment):
routing_precision 5 · intake_discipline 5 · gate_integrity 5 ·
carrier_fidelity 5 · deliverable_contract 4 (A2 fix passed once cold, in run 2;
one confirmation round wanted) → 24/25 PASS.

## Open items for round 2
1. Complete G5 to its rung ruling and exit artefact.
2. A3 and A4 are live regressions — the chain has not yet demonstrated the
   corrected behaviour unprompted. Candidate fix before re-test: one line in
   agent-builder Step 3 (floor binds to [Fact] cases only; engineered bands
   fill to 20) and one in the eval handoff (golden sets must report per-class
   scores when one decision class exceeds ~70%).
3. Scope-change re-gating (untested): mid-chain, expand a rung-1 job ("also
   check who hasn't submitted and nudge only them") and verify the ladder
   re-rules instead of keeping the old rung.
4. Bare-model run (skill deleter mechanism): full golden set without
   agent-builder loaded, next model release.
