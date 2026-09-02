'use strict';
// A spend guard that can stop itself.
//
// An unattended agent needs a HARD ceiling. A soft warning stops nothing at 3am, because nobody
// is awake to read it. The guard that works unloads its own scheduled job at the cap -- an agent
// that cannot stop itself is not capped, it is merely instrumented.
//
// Budget from the LATE token figure, never the first cycle. Memory makes input grow: measured
// +61% for a memory-carrying agent (1,043 -> 1,678 avg input) against +25% for a memoryless
// control, and the curve had not plateaued. Budgeting from an empty-memory cycle underestimates
// the steady state by roughly 60%.
const { execFile } = require('node:child_process');

/**
 * @param o.spentUsd   spend so far, from the agent's own ledger
 * @param o.budgetUsd  the hard cap
 * @param o.warnAt     fraction at which to warn (default 0.8)
 * @param o.stop       async fn that actually stops future runs -- see stopLaunchdJob
 */
async function enforceBudget({ spentUsd, budgetUsd, warnAt = 0.8, stop = null }) {
  if (!Number.isFinite(budgetUsd) || budgetUsd <= 0) {
    // No cap is not the same as an unlimited cap. Say so rather than proceeding quietly.
    return { ok: true, verdict: 'uncapped', note: 'no budget configured — this agent is not capped' };
  }
  const pct = spentUsd / budgetUsd;
  if (pct < warnAt) return { ok: true, verdict: 'ok', pct };
  if (pct < 1) return { ok: true, verdict: 'warn', pct, note: `${(pct * 100).toFixed(1)}% of cap` };

  // Over. Stop future runs before returning, and report whether that actually worked -- a guard
  // that reports "stopped" without checking is the same class of bug as a verification read that
  // cannot fail.
  let stopped = false, stopError = null;
  if (stop) {
    try { await stop(); stopped = true; } catch (e) { stopError = e.message; }
  }
  return {
    ok: false, verdict: 'over', pct, stopped, stopError,
    note: stopped ? 'cap reached; future runs unloaded'
      : `cap reached and the agent COULD NOT STOP ITSELF${stopError ? ': ' + stopError : ' (no stop fn given)'}`,
  };
}

/** macOS: unload the launchd job so no further ticks fire. Adapt per scheduler. */
function stopLaunchdJob(label) {
  return () => new Promise((resolve, reject) => {
    execFile('launchctl', ['unload', '-w', `${process.env.HOME}/Library/LaunchAgents/${label}.plist`],
      (err) => (err ? reject(err) : resolve()));
  });
}

module.exports = { enforceBudget, stopLaunchdJob };
