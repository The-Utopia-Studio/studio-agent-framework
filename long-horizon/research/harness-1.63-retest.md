# Harness re-test — Mastra 1.63

**1 Sep 2026.** Re-ran the 26 Aug STATE-1a decision against `@mastra/core@1.63.2`. Conclusions
and the pinned stack are in [`../HARNESS.md`](../HARNESS.md); this file records how the re-test
was set up and the things that only matter if you are repeating it.

## Method

Vendored the `bakeoff/` suite into a standalone probe rather than modifying this repo, so the
26 Aug baseline stayed reproducible alongside the upgrade. Two trees: baseline pinned to the
documented 26 Aug versions, and upgraded on 1.63.2. Same 12 golden cases, same fixtures.

**The documented baseline no longer installs unchanged.** `@mastra/langfuse ^1.5.0` floats to
1.5.3, which pulls a nested `@mastra/observability@1.17.4`, whose code imports a symbol core
only added in **1.63.0** — while declaring compatibility back to 1.16.0. A mis-declared range
upstream. Reproducing 26 Aug needs an explicit `overrides` block.

Consequence worth stating plainly: **the upgrade was not optional.** The ecosystem had already
forced it.

## Result

Zero regressions from the upgrade itself. Identical verdicts case-for-case between baseline and
upgraded when run under the same conditions. The 12/12 pass came from adding credentials
(Langfuse) and fixing one of our own flaky assertions — not from the version change.

One measured behavioural improvement: at core 1.61.0 the kill-test emitted a concurrent-resume
de-duplication warning twice; at 1.63.2 it fires zero times, and the warning string is still
present in the bundle, so the condition is no longer met rather than the warning removed.
Behaviour measured; the code path was not traced.

## Traps for anyone repeating this

**The event log needs a git repo.** `gitSha()` throws if `git rev-parse HEAD` fails, which
silently empties every event log and fails all 12 cases with no obvious cause. Run inside a
committed repo, or set `GIT_SHA`.

**Two namespaces, and they bite repeatedly.** The request-level `tableName` is Mastra's logical
name, not the store's table name. The storage handler also wraps results as `{ok, result}` — an
extractor checking `results` returns `[]` and looks exactly like "the data is not there". This
cost two days on a separate claim; see the verification rule in [`../BEHAVIOR.md`](../BEHAVIOR.md) §7.

**Count vectors through the vendor API.** A raw table read returns 0 rows regardless of how many
vectors exist.

**The model-call counter is host-allowlisted.** Substituting a model provider on an unlisted host
silently reports 0 calls — a false pass on the most important assertion in the suite.

## Version notes

- `@mastra/convex` **1.5.5 regresses the kill-test**; pinned to 1.5.4. Bisected.
- `createInngestAgent` → **1.30.0**, `untilIdle` → **1.41.0**. Not new in 1.63, and present in
  the 1.61.0 baseline.
- 1.63.0's relevant changes are narrower than "durable agents arrived": a falsy-resume-payload
  fix that stops background tasks double-dispatching, `getExportedSpanId()` so a resumed run
  links to an exported span, and a fix for output-processor traces staying open on cancel.
- D-39 (`thinking: disabled` for Moonshot's Anthropic-compatible endpoint) is **still required**,
  and also 3.6× faster.
