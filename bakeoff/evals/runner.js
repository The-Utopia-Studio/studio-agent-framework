'use strict';
// WO-3 · eval runner. Points at any harness leg via --harness so legs 1/2/3 are
// graded by identical code. PRD §2: "a fixed script executed identically against
// each of the three harness legs, against shared mock Linear/Slack fixtures."
//
//   node evals/runner.js --harness=./evals/stub.js --all
//   node evals/runner.js --harness=./mastra/entry.js --case=1-happy-path
//   node evals/runner.js --harness=./mastra/entry.js --all --live

const fs = require('node:fs');
const path = require('node:path');

const FIX_DIR = path.join(__dirname, 'fixtures');

// ---------------------------------------------------------------- args
const argv = process.argv.slice(2);
const arg = (n, d = null) => {
  const hit = argv.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : (argv.includes(`--${n}`) ? true : d);
};
const harnessArg = arg('harness');
const caseArg = arg('case');
const live = !!arg('live');
const verbose = !!arg('verbose');

if (!harnessArg) {
  console.error('usage: node evals/runner.js --harness=<path> [--case=a,b | --all] [--live] [--verbose]');
  process.exit(2);
}

// ---------------------------------------------------------------- fixtures
const allFixtures = fs.readdirSync(FIX_DIR).filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(FIX_DIR, f), 'utf8')))
  .sort((a, b) => a.case.localeCompare(b.case, undefined, { numeric: true }));

const wanted = caseArg && caseArg !== true ? String(caseArg).split(',').map((s) => s.trim()) : null;
const fixtures = wanted
  ? wanted.map((w) => {
      const f = allFixtures.find((x) => x.case === w || x.case.startsWith(w));
      if (!f) { console.error(`no fixture matches --case=${w}`); process.exit(2); }
      return f;
    })
  : allFixtures;

// ------------------------------------------------- mocks (shared with the crash child)
const { makeLinearFetch, makeSlackFetch } = require('./mocks.js');

// ---------------------------------------------------------------- graders
// Every grader is deterministic (PRD §2 / EVAL-5). No model judgment anywhere.
const ALIASES = {
  slack_posts_max: 'slack_posts',
  slack_posts_total_max: 'slack_posts',
  llm_calls_total: 'llm_calls',
};

function gradeOne(key, expected, report) {
  const field = ALIASES[key] || key;

  if (key === 'sql_columns_present') {
    const have = report.sql_columns;
    if (!Array.isArray(have)) return { ok: false, actual: have, msg: 'harness reported no sql_columns array' };
    const missing = expected.filter((c) => !have.includes(c));
    return missing.length
      ? { ok: false, actual: have, msg: `missing columns: ${missing.join(', ')}` }
      : { ok: true, actual: `${have.length} columns` };
  }

  const actual = report[field];
  if (actual === undefined) {
    return { ok: false, actual: undefined, msg: `harness reported no value for "${field}"` };
  }

  if (key.endsWith('_max')) {
    const ok = typeof actual === 'number' && actual <= expected;
    return { ok, actual, msg: ok ? '' : `expected <= ${expected}, got ${JSON.stringify(actual)}` };
  }

  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  return { ok, actual, msg: ok ? '' : `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}` };
}

// ---------------------------------------------------------------- run
(async () => {
  const harnessPath = path.resolve(process.cwd(), String(harnessArg));
  let harness;
  try {
    // Dynamic import handles both CJS (the stub) and ESM (the Mastra leg) harnesses,
    // so all three legs are loadable by identical runner code.
    const mod = await import(require('node:url').pathToFileURL(harnessPath).href);
    harness = mod.default || mod;
    if (harness && harness.default) harness = harness.default;
  } catch (err) {
    console.error(`ERROR loading harness ${harnessPath}:\n  ${err.message}`);
    if (err.stack) console.error(err.stack.split('\n').slice(1,4).join('\n'));
    process.exit(2);
  }
  if (typeof harness.run !== 'function') {
    console.error(`ERROR harness ${harnessPath} does not export run(fixture, ctx)`);
    process.exit(2);
  }

  console.log(`harness : ${harness.name || harnessPath}`);
  console.log(`mode    : ${live ? 'LIVE (real Linear + real Slack)' : 'MOCK FIXTURES'}`);
  console.log(`cases   : ${fixtures.length}\n`);

  const results = [];
  let validators = null;
  try { validators = require('./validators.js'); } catch (_) { /* WO-8, not yet built */ }

  for (const fx of fixtures) {
    const runId = `${fx.case}-${process.pid}-${Date.now()}`;
    const dbPath = path.join(process.cwd(), 'runs', `${fx.case}.db`);
    try { fs.rmSync(dbPath, { force: true }); fs.rmSync(`${dbPath}-wal`, { force: true }); fs.rmSync(`${dbPath}-shm`, { force: true }); } catch (_) {}

    const slackCounter = { attempts: 0 };
    const ctx = {
      runId, dbPath, live,
      fixture: fx,
      linearFetchImpl: live ? undefined : makeLinearFetch(fx.linear),
      slackFetchImpl: live ? undefined : makeSlackFetch(fx.slack, slackCounter),
      slackCounter,
      approvalDecision: fx.approval,
      crash: fx.crash,
    };

    let report, errored = null;
    const t0 = Date.now();
    try {
      report = await harness.run(fx, ctx);
    } catch (err) {
      errored = err;
    }
    const ms = Date.now() - t0;

    if (errored) {
      // An exception out of the harness is an ERROR, distinct from a graded FAIL.
      results.push({ case: fx.case, verdict: 'ERROR', ms, detail: `${errored.name}: ${errored.message}`, checks: [] });
      console.log(`ERROR  ${fx.case}  (${ms}ms)\n       ${errored.name}: ${errored.message}`);
      if (verbose && errored.stack) console.log(errored.stack.split('\n').slice(1, 5).join('\n'));
      continue;
    }
    if (!report || typeof report !== 'object') {
      results.push({ case: fx.case, verdict: 'ERROR', ms, detail: 'harness returned no report object', checks: [] });
      console.log(`ERROR  ${fx.case}  (${ms}ms)\n       harness returned no report object`);
      continue;
    }

    const checks = Object.entries(fx.expect).map(([k, v]) => {
      const r = gradeOne(k, v, report);
      return { key: k, expected: v, ...r };
    });

    // WO-8 validator gate runs on every case, not just the happy path.
    let vChecks = [];
    if (validators && typeof validators.runAll === 'function') {
      vChecks = validators.runAll(report, fx, ctx).map((c) => ({ ...c, validator: true }));
    }

    const all = [...checks, ...vChecks];
    const failed = all.filter((c) => !c.ok);
    const blocked = Array.isArray(report.blocked) && report.blocked.length;
    const verdict = report.primitive_gap ? 'PRIMITIVE-GAP'
      : blocked ? 'BLOCKED-NO-CREDENTIAL'
      : (failed.length ? 'FAIL' : 'PASS');

    results.push({ case: fx.case, verdict, ms, checks: all, report });

    const tag = verdict === 'PASS' ? 'PASS ' : verdict === 'PRIMITIVE-GAP' ? 'GAP  '
      : verdict === 'BLOCKED-NO-CREDENTIAL' ? 'BLOCK' : 'FAIL ';
    console.log(`${tag} ${fx.case}  (${ms}ms)  ${all.length - failed.length}/${all.length} checks`);
    for (const c of failed) {
      console.log(`       ${c.validator ? 'VALIDATOR' : 'expect'} ${c.key}: ${c.msg}`);
    }
    if (report.primitive_gap) {
      console.log(`       PRIMITIVE-GAP: ${report.primitive_gap}`);
    }
    if (blocked) {
      console.log(`       BLOCKED on missing credentials: ${[...new Set(report.blocked)].join(', ')}`);
    }
    if (verbose) console.log(`       report: ${JSON.stringify(report, null, 2).split('\n').join('\n       ')}`);
  }

  // ---------------------------------------------------------------- summary
  const n = (v) => results.filter((r) => r.verdict === v).length;
  console.log(`\n${'-'.repeat(64)}`);
  console.log(`PASS ${n('PASS')}   FAIL ${n('FAIL')}   PRIMITIVE-GAP ${n('PRIMITIVE-GAP')}   BLOCKED ${n('BLOCKED-NO-CREDENTIAL')}   ERROR ${n('ERROR')}   of ${results.length}`);
  console.log(`${'-'.repeat(64)}`);

  const outPath = path.join(process.cwd(), 'runs', 'last-suite.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({
    harness: harness.name || harnessPath, live, at: new Date().toISOString(), results,
  }, null, 2));
  console.log(`results -> ${path.relative(process.cwd(), outPath)}`);

  try { require('./mock-model.js').stopMockModel(); } catch (_) {}
  process.exitCode = n('ERROR') ? 2 : (n('FAIL') ? 1 : 0);
})();
