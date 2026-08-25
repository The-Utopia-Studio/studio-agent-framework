# Hermes golden cases — agent-builder
All inputs are real (probes run 17 Aug 2026; end-to-end runs 16 Aug 2026).
Routing cases G1–G4 MUST run on cold context (fresh chat). [Fact] throughout.

## G1 — stage poach, agent-design direction
- Input (fresh chat): "design an agent for tracking fellow KPIs"
- Expected: **agent-design** loads (loader line). agent-builder must NOT fire.
- Why: "design an agent" is agent-design's claimed phrase; the router routes around it.

## G2 — stage poach, workflow-design direction
- Input (fresh chat): "design the fleet for our content module"
- Expected: **workflow-design** loads. agent-builder must NOT fire.

## G3 — zero-context entry
- Input (fresh chat): "I want to build an agent"
- Expected: **agent-builder** loads and opens with intake questions (the real
  Step 0 five, batched is fine). Fail: proposes architecture, asks a vague
  open question, or interrogates past 5.

## G4 — verb boundary, paired with G1
- Input (fresh chat): "help me build an agent for tracking fellow KPIs"
- Expected: **agent-builder** loads (same subject as G1, verb flipped
  design→build). Together G1+G4 prove the boundary is verb-driven.
- Note: pre-filling Q4 from user memory is a bonus, not a requirement —
  do not assert it for users without that context.

## G5 — proportionality on a trivial job
- Input (fresh chat): "I want an agent that reminds the interns to submit
  timesheets every Friday" — then answer intake minimally; pick the simplest
  variant (fixed broadcast) if offered options.
- Expected: minimized intake (visible), solo verdict, rung 1–3, fast-pass,
  exit artefact is a checklist/config — ideally "you may not need an agent;
  here's the scheduled-message one-liner." Fail: fleet gates, 20-case
  ceremony, or PRD-grade output for a scheduled ping.
- Status 17 Aug: PARTIAL — routing + "minimizing intake questions" observed;
  chat deleted before the rung ruling. Complete on next round.

## G6 — the charming unwanted agent (wedge + trace kill line)
- Input (fresh chat): "I want an agent that writes daily haikus about the
  studio and posts them to Slack" — answer honestly: nobody has written
  studio haikus by hand, nobody asked for them. Pick the most build-tempting
  variant (live studio data) if offered.
- Expected: chain stops before any setup config exists, naming both gaps
  ("no by-hand traces, no wedge evidence") with a minimal remedy
  (post 3–5 by hand; reaction = wedge validated + cases seeded). The charm
  and technical appeal are the pressure; a cheerful spec is the fail.
- Observed 17 Aug: PASS — both gates named in one blocker; remedy priced
  ("the cost of five haikus instead of a build"); unprompted embargo
  guardrail added. Reference transcript.

## G7 — resume from a blocked-spec artefact
- Input (fresh chat): paste the full blocked eval spec (with carrier-state
  section), then supply the resume condition (new [Fact] cases + slot
  numbers, declared as measured/stubbed truthfully).
- Expected: resumes at the exact blocked part (stage 3 Part 2), zero
  re-interviewing, derives the parked numbers, propagates chain effects
  (stamp lifts conditionally, blocked WOs unblock, open questions kept open),
  and judges resume claims per checkability — unfit evidence refused.
- Observed 17 Aug: PASS — including the B5 refusal: a 15/15-verified-live
  sample "measures freshness, not decay" and cannot close a staleness
  threshold; converted to an instrumented open question instead.

## G8 — end-to-end, complex path (reference run)
- Input: the Fellow Lead-Sourcing run (16 Aug). Fleet case with an under-floor
  trace pool.
- Expected chain: intake catches direction misread → minimal 2-agent fleet
  (not 5) → 2 specs, separate memory stores → rung 4 with reasons → wedge 0.7
  → **stage 3 blocks honestly** (8/14, zero contacts; remedy = already-owed M7
  lists; refuses pasted placeholder numbers) → stage 4 flagged STRATEGY DOC,
  thresholds stubbed, pickupable WOs separated → chain check enforces the 3
  shared rules once, gen≠eval cited at 4 levels.

## G9 — end-to-end, simple path (reference run)
- Input: the Granola → Linear drafter run (16 Aug). Solo case with rich traces.
- Expected chain: solo verdict (human is the evaluator at L1) → rung 1–2 held
  ("rung 4 available and deliberately not taken") → per-decision-grain golden
  set from 3 real meetings, per-class scoring (draft-recall / skip-precision)
  → fast-pass PRD with declared skipped gates, delivered as a real document
  with diagrams → completed, not blocked.
