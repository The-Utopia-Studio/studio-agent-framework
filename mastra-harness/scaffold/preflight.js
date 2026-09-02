// Probe dependencies BEFORE starting a workflow.
//
// Why this exists: an agent that starts work before checking reachability does not fail, it
// HANGS. Observed 44.6 minutes on a macOS DarkWake -- a two-second maintenance wake inside a
// long sleep, during which the scheduler fires jobs but the network stack is not yet up. The
// model call died inside the workflow, so the run recorded as `failed` and left orphaned
// `pending` snapshot rows. Over a week of those, the debris reads as genuine faults.
//
// Two rules:
//   1. a network-shaped error is `offline`, NOT `failed`
//   2. a precondition that leaves no trace is not auditable -- emit the record where the gate
//      makes its decision, not where the work would have happened
const TIMEOUT_MS = Number(process.env.PREFLIGHT_TIMEOUT_MS ?? 8000);

// "The network is up" is not inferable from one host. In the real failure the data source
// answered while the model host reset the connection. Probe every host you depend on.
export function classify(err) {
  const s = String((err && (err.cause?.code || err.code || err.message)) || err);
  if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ENETUNREACH|EHOSTUNREACH|fetch failed/i.test(s)) return 'offline';
  if (/abort|timeout|ETIMEDOUT/i.test(s)) return 'timeout';
  return 'error';
}

async function reachable(name, url, init = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal });
    // Any HTTP response proves reachability. 401/404 is a reachable host with a wrong path or
    // key -- a real problem, but NOT an offline one, and conflating them sends you hunting a
    // network fault that isn't there.
    return { name, ok: true, status: res.status };
  } catch (err) {
    return { name, ok: false, verdict: classify(err), detail: String(err.message || err).slice(0, 140) };
  } finally {
    clearTimeout(t);
  }
}

/**
 * @returns {{ ok: boolean, verdict: 'ok'|'offline'|'timeout'|'error', checks: object[] }}
 * ok:false with verdict 'offline' means: record it, exit 0, let the next trigger try.
 * Exiting non-zero makes a scheduler thrash or an OS surface show a false failure.
 */
export async function preflight(deps) {
  const checks = await Promise.all(deps.map((d) => reachable(d.name, d.url, d.init)));
  const bad = checks.filter((c) => !c.ok);
  if (!bad.length) return { ok: true, verdict: 'ok', checks };
  // offline dominates: if anything is unreachable at the network level, the environment is the
  // problem and there is nothing to debug in the agent.
  const verdict = bad.some((b) => b.verdict === 'offline') ? 'offline'
                : bad.some((b) => b.verdict === 'timeout') ? 'timeout' : 'error';
  return { ok: false, verdict, checks };
}
