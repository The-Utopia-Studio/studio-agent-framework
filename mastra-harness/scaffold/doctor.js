// `npm run doctor` -- the command that decides whether a work order is done.
//
// Read-only, and checks live, so it separates "was broken earlier" from "is broken right now".
//
// The governing rule, learned four separate times on this project:
//
//   A step whose success and its no-op are indistinguishable from the outside has not been
//   verified. Where an empty result and a failure look alike, the check must THROW, or name
//   which it was.
//
// So every check has three outcomes, never two: PASS, FAIL, and WARN for "could not determine".
// A check that cannot run must never report PASS.
import { preflight } from './preflight.js';
import { freshness } from './freshness.js';

const PASS = 'PASS', WARN = 'WARN', FAIL = 'FAIL';

// Raw HTTP, zero SDK. A process that never wrote the state proves the state is DURABLE; if the
// read needs the vendor's client you have proven a cache that survived because nothing
// restarted hard enough.
async function readTable(tableName, limit = 200) {
  const base = (process.env.CONVEX_URL || '').replace(/\/+$/, '');
  const res = await fetch(`${base}/api/mutation`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Convex ${process.env.CONVEX_ADMIN_KEY}` },
    body: JSON.stringify({ path: 'mastra/storage:handle', args: { op: 'queryTable', tableName, limit }, format: 'json' }),
  });
  const body = await res.json();
  if (body.status === 'error') throw new Error(body.errorMessage || 'convex error');
  const v = body.status === 'success' ? body.value : body;
  const out = v && (v.result ?? v.results);
  // Throw rather than return [] -- an unrecognised shape read as "no rows" is how a working
  // feature got reported as broken in a standards document for two days.
  if (!Array.isArray(out)) throw new Error(`unrecognised response shape: ${JSON.stringify(v).slice(0, 160)}`);
  return out;
}

/**
 * Checks are opt-in, because what an agent needs is a per-agent decision (see SKILL.md §1).
 * An agent with no memory should not be failed for having no memory.
 *
 * @param opts.pins      { "<pkg>": "<exact version>" }
 * @param opts.deps      [{ name, url }] for the live reachability probe
 * @param opts.resource  resource id, only if this agent has working memory
 * @param opts.cycles    [{ startedAt, status }] the agent's own cycle log
 * @param opts.expect    { memory?: boolean, workflow?: boolean } what this agent is SUPPOSED to have
 */
export async function doctor(opts = {}) {
  const { pins = {}, deps = [], resource = null, cycles = [], expect = {} } = opts;
  const rows = [];
  const add = (state, name, detail) => rows.push({ state, name, detail });

  for (const [pkg, want] of Object.entries(pins)) {
    try {
      const got = (await import(`${pkg}/package.json`, { with: { type: 'json' } })).default.version;
      add(got === want ? PASS : FAIL, `pin ${pkg}`, got === want ? got : `${got}, expected ${want}`);
    } catch (e) { add(WARN, `pin ${pkg}`, `not resolvable: ${e.message}`); }
  }

  if (deps.length) {
    const pf = await preflight(deps);
    // offline is a WARN, not a FAIL: the environment is the problem, not the agent. That
    // distinction is the whole reason preflight exists.
    add(pf.ok ? PASS : (pf.verdict === 'offline' ? WARN : FAIL), 'dependencies',
        pf.ok ? deps.map((d) => d.name).join(', ')
              : `${pf.verdict}: ${pf.checks.filter((c) => !c.ok).map((c) => c.name).join(', ')}`);
  }

  if (expect.memory) {
    let wm = null, updatedAt = null;
    try {
      const res = await readTable('mastra_resources', 50);
      const mine = res.find((r) => r.id === resource);
      if (!mine) add(WARN, 'durable memory', `no row for resource "${resource}" yet — run one cycle first`);
      else {
        wm = String(mine.workingMemory || '');
        updatedAt = mine.updatedAt || null;
        add(PASS, 'durable memory', `resource "${resource}" readable over raw HTTP, ${wm.length} chars`);
      }
    } catch (e) { add(FAIL, 'durable memory', e.message); }

    if (wm !== null) {
      // FRESHNESS, not size. A frozen 1,742 chars and a healthy 1,742 chars are the same number.
      const f = freshness(updatedAt, cycles);
      add(f.stale === null ? WARN : (f.stale ? FAIL : PASS), 'memory freshness', f.reason);
    }
  }

  if (expect.workflow) {
    // SINGULAR: TABLE_WORKFLOW_SNAPSHOT = "mastra_workflow_snapshot". The package's bundled
    // reference doc says plural; that is an upstream documentation bug, and following it means
    // reading an empty table and concluding durability is broken.
    try {
      const snaps = await readTable('mastra_workflow_snapshot', 200);
      add(snaps.length ? PASS : WARN, 'workflow snapshots',
          snaps.length ? `${snaps.length} row(s) in mastra_workflow_snapshot`
                       : 'table readable but empty — start and suspend one run to prove durability');
    } catch (e) { add(FAIL, 'workflow snapshots', e.message); }
  }

  const width = Math.max(...rows.map((r) => r.name.length), 10);
  console.log(`doctor · ${new Date().toISOString()}`);
  console.log('-'.repeat(72));
  for (const r of rows) console.log(`  ${r.state}  ${r.name.padEnd(width)}  ${r.detail}`);
  console.log('-'.repeat(72));
  const fails = rows.filter((r) => r.state === FAIL).length;
  const warns = rows.filter((r) => r.state === WARN).length;
  console.log(fails ? `  ${fails} failure(s), ${warns} warning(s)`
            : warns ? `  healthy, with ${warns} warning(s)` : '  all checks passed');
  return { fails, warns, rows };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  doctor({
    pins: { '@mastra/convex': '1.5.4', '@mastra/core': '1.63.2' },
    deps: [{ name: 'convex', url: `${(process.env.CONVEX_URL || '').replace(/\/+$/, '')}/version` }],
    resource: process.env.MASTRA_RESOURCE || null,
    expect: { memory: !!process.env.MASTRA_RESOURCE, workflow: true },
  }).then((r) => process.exit(r.fails ? 1 : 0))
    .catch((e) => { console.error('doctor failed:', e.message); process.exit(1); });
}
