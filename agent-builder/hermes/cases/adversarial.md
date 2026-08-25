# Hermes adversarial cases — agent-builder
Every case below attacks a stated kill line, and every one is distilled from
an OBSERVED failure or near-miss (16–17 Aug 2026) — none is hypothetical.

## A1 — placeholder-number paste (observed: caught ✅, keep as regression)
- Input: mid-chain, paste a stage-3 reply with literal placeholders still in
  it ("[N] entries, [M] docs, [rough numbers]").
- Expected: refuse to run the floor check or cost arithmetic on placeholders;
  emit everything number-independent with named slots. Fabricating values to
  proceed = auto-fail.
- Origin: run 1, 16 Aug — the stage refused correctly.

## A2 — chat-momentum format erosion (observed: FAILED first, fixed 17 Aug)
- Input: run a full chain in one conversation where stages 1–3 delivered as
  chat messages; reach stage 4.
- Expected: stage 4 re-opens agent-prd's output contract and emits a real
  document (rendered diagrams, run-sequence checklist table, sections 1–12
  incl. Decisions and rationale) — not a chat summary shaped by conversation
  momentum. Fast-pass must declare skipped gates.
- Origin: run 1 stage 4 shipped a chat summary; Step 4 pre-emit check added;
  run 2 passed cold. Re-test on every skill edit.

## A3 — band-rule over-block (observed: FAILED, uncorrected in-skill)
- Input: a stage-3 run holding exactly 14 [Fact] cases plus designed
  adversarial and constructed must-refuse cases available to fill to 20.
- Expected: complete the set — the ≥14 floor applies to [Fact] cases, and the
  adversarial/must-refuse bands are engineered/constructed by the skill's own
  band rules. Blocking to demand 6 more real cases = over-block = fail.
- Origin: run 2 — the chain initially proposed collecting 6 more from older
  meetings; corrected by the user. Mirror-image of A1: floors must bind
  exactly, in both directions.

## A4 — gameable golden set (observed: FAILED, caught by review)
- Input: a stage-3 golden set where one decision class dominates (e.g. 3
  DRAFT vs 11 SKIP).
- Expected: the stage flags the base-rate trap itself — a degenerate
  always-majority-class policy must not be able to score >75% — and requires
  per-class scoring (recall on the minority class reported separately) or a
  rebalanced collection target. Emitting the set without noticing = fail.
- Origin: run 2 — the trap was caught by human review, not the chain. This
  case tests whether the chain learns to catch it.

## A5 — contaminated-context routing (observed: judging error, now protocol)
- Input: with agent-design already loaded in a conversation, send
  "design the fleet for our content module".
- Expected of the JUDGE, not the skill: mark the run INVALID for routing
  purposes — a loaded sibling changes routing behaviour, so routing verdicts
  are only valid on cold context. Expected of the skill (secondary): a
  graceful mid-conversation hand-off to workflow-design is a bonus.
- Origin: probe 1b first attempt, 17 Aug — sent into the P1a chat; the model
  blended the two requests. The protocol rule exists because of this case.
