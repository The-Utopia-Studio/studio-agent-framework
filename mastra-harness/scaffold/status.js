'use strict';
// Four run statuses, and gap attribution.
//
// WHY FOUR, NOT TWO
//
// `ok` / `failed` is not enough for an unattended agent. The distinction that earns its keep is
// `offline`: the ENVIRONMENT failed and there is nothing to debug in the agent. Collapsing that
// into `failed` produces nightly false alarms, and an alarm that cries wolf gets ignored --
// which is worse than no alarm. Observed directly: DarkWake cycles recorded as `failed` made a
// healthy agent look broken all morning.
//
//   ok        did the work
//   degraded  reached everything but could not finish (e.g. fetched fine, summarise died)
//   offline   could not reach a dependency at the network level -- not the agent's fault
//   failed    reached the network and still could not complete
//
// A status must never contradict another field on the same row. One row here had ok=0 and
// status='ok' simultaneously, because a backfill tested `fetched > 0` before `ok = 0` -- so a
// run that fetched everything and then died in summarise was stamped ok. FETCHING IS NOT
// COMPLETING; an explicit failure outranks partial progress.

const NETWORK = /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ENETUNREACH|EHOSTUNREACH|fetch failed/i;
const TIMEOUT = /abort|timeout|ETIMEDOUT/i;

/**
 * @param o.error        the error, if the cycle threw
 * @param o.sourcesOk    dependencies reached
 * @param o.sourcesTotal dependencies attempted
 * @param o.completed    did the cycle finish its actual work?
 */
function classifyRun({ error = null, sourcesOk = 1, sourcesTotal = 1, completed = true } = {}) {
  if (error) {
    const s = String(error.cause?.code || error.code || error.message || error);
    if (NETWORK.test(s)) return 'offline';
    if (TIMEOUT.test(s)) return 'offline';   // a timeout reaching a dependency is still environmental
    return 'failed';
  }
  if (sourcesOk === 0 && sourcesTotal > 0) return 'offline';
  if (!completed) return 'degraded';
  if (sourcesOk < sourcesTotal) return 'degraded';
  return 'ok';
}

/**
 * Attribute a gap between runs. A GAP IS NOT A MISS UNTIL IT IS UNEXPLAINED.
 *
 * `sleepMinutes` comes from the machine's own sleep log (on macOS, `pmset -g log`). Two traps
 * we hit parsing that:
 *   - the `Wake Requests` line is a list of SCHEDULED wakes and carries the type token `Wake`,
 *     so matching the token closed every sleep interval ~2s after it opened and reported a
 *     32-minute lid-close as 0h asleep. Match the REASON text, not the type.
 *   - coverage must be measured against AWAKE time. Judging on wall-clock scores a laptop badly
 *     for being shut, which is not a fault -- it scored a healthy agent at 18%.
 */
function classifyGap({ gapMinutes, sleepMinutes = 0, toleranceMinutes = 5 } = {}) {
  const unexplained = gapMinutes - sleepMinutes;
  if (gapMinutes <= toleranceMinutes) return { verdict: 'jitter', unexplained: 0 };
  if (unexplained <= toleranceMinutes) return { verdict: 'asleep', unexplained: 0 };
  if (sleepMinutes > 0) return { verdict: 'partly-unexplained', unexplained };
  // The only verdict that should page anyone.
  return { verdict: 'unexplained', unexplained };
}

/** Coverage against awake time, never wall-clock. Returns null when there was no awake time. */
function coverage({ runs, awakeMinutes, intervalMinutes }) {
  if (!awakeMinutes || !intervalMinutes) return null;
  const expected = Math.floor(awakeMinutes / intervalMinutes);
  if (expected <= 0) return null;
  return Math.min(1, runs / expected);
}

module.exports = { classifyRun, classifyGap, coverage };
