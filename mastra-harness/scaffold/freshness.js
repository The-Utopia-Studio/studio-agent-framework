// Freshness check on durable state.
//
// Why this exists: nine cycles reported `ok`, the recall check passed on all nine, working
// memory read a plausible 1,742 chars, and Langfuse spans were clean -- while the memory had
// not been written once. A FROZEN SIZE AND A HEALTHY SIZE ARE THE SAME NUMBER. Only the write
// timestamp separates them.
//
//   Grade freshness, never size. A metric you can satisfy by doing nothing is not a metric.

const STALE_AFTER = Number(process.env.MEMORY_STALE_AFTER ?? 3);

/**
 * @param updatedAt ISO timestamp of the last real write to the durable state
 * @param cycles    [{ startedAt, status }] -- the agent's own cycle log, ALREADY FILTERED to
 *                  the resource being judged. A cycle that wrote to a different resource is
 *                  not evidence that this one went unwritten; counting all of them reported a
 *                  healthy agent as stale after three throwaway test runs. Same bug family as
 *                  the failure this check exists to catch: it could not tell "did not run"
 *                  from "ran somewhere else".
 * @returns {{ stale: boolean|null, cyclesSince: number|null, staleAfter: number, reason: string }}
 */
export function freshness(updatedAt, cycles = []) {
  const at = updatedAt ? Date.parse(updatedAt) : NaN;
  if (!Number.isFinite(at)) {
    // No timestamp is NOT a pass. It is an inability to judge, and it must read differently
    // from a healthy result -- otherwise "we couldn't check" silently becomes "it's fine".
    return { stale: null, cyclesSince: null, staleAfter: STALE_AFTER, reason: 'no write timestamp — cannot judge freshness' };
  }
  const since = cycles.filter((c) => {
    const t = Date.parse(c.startedAt ?? c.started_at ?? '');
    // Only successful cycles count. A cycle that skipped offline had nothing to write.
    return Number.isFinite(t) && t > at && (c.status === 'ok' || c.status === 'success');
  }).length;
  const stale = since >= STALE_AFTER;
  return {
    stale, cyclesSince: since, staleAfter: STALE_AFTER,
    reason: stale
      ? `${since} successful cycles since the last write (${updatedAt}) — the write path is not running`
      : `last write ${updatedAt}, ${since} cycle(s) since`,
  };
}
