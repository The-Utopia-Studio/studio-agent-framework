# Hermes — the eval harness around agent-builder

Named for the messenger: Hermes tests whether the router routes, the carrier
carries, and the gates gate. It wraps the agent-builder chain the way
eval-first-spec's own test kit wraps that skill — rubric + golden cases +
adversarial cases + a judge log — and doubles as the proposed **general eval
standard for all Utopia skills** (Ollie's ask, 13 Aug): swap the cases, keep
the structure.

## What's in here

```
hermes/
  README.md          this file — protocol + generalization notes
  rubric.json        5 dimensions × 0–5, pass ≥21, no dimension <4, auto-fails
  cases/golden.md    9 cases: 7 probes (run 17 Aug) + 2 end-to-end runs
  cases/adversarial.md  5 cases, all from OBSERVED failures/near-misses
  RESULTS.md         judge log of the 17 Aug round — 6 pass · 1 partial · 0 fail
```

## Judge protocol

1. **Generator ≠ evaluator.** The judge is a separate Claude instance (or a
   human) given rubric.json + the case + the transcript. The instance that ran
   the chain never scores itself.
2. **Cold context for routing cases.** Every routing case (G1–G4) runs in a
   fresh chat. A loaded sibling skill changes routing behaviour — observed
   17 Aug: "design the fleet" sent mid-conversation blended with the already-
   loaded agent-design instead of routing. Contaminated runs are INVALID, not
   failed.
3. **Behavioural cases run to their gate.** G5–G7 aren't one-shot: answer the
   intake honestly and continue until the gate under test fires or is sailed
   past. A probe abandoned before its gate is PARTIAL, never PASS.
4. **Evidence is the loader line + the transcript.** For routing, the skill-
   loaded indicator is the verdict; response quality is secondary.
5. **Honest inputs only.** Never feed the chain what it wants to hear. The
   haiku case works because "nobody asked for this" is true; the resume case
   works because the stub numbers are declared as stubs if challenged.

## Re-run cadence

- On every agent-builder or stage-skill edit: full golden set.
- On every model release: full set, twice — once with the skill loaded, once
  **without**. If the bare model passes the golden set, that is a
  deprecation flag (the "skill deleter" mechanism, Ollie's second ask —
  no new tooling needed, it's this harness run bare).
- After any live chain run that misbehaves: distil the failure into a new
  adversarial case before fixing the skill, so the fix has a regression test.

## Generalizing to other skills (the standard)

A skill's Hermes kit = rubric.json (same 5-dimension shape, dimensions renamed
to the skill's promises) + ≥5 golden cases drawn from real usage + ≥3
adversarial cases drawn from observed or designed failure modes + RESULTS.md.
The two hard rules that transfer to every skill: the judge is never the
generator, and adversarial cases must attack the skill's *stated* kill lines —
a kill line with no case that can trip it is decoration.
