#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { loadManifest, resolveFixtureCases, validateManifest, verifyPins } from './manifest.js';
const arg = (name) => process.argv.find((v) => v.startsWith(`--${name}=`))?.slice(name.length + 3);
const release = process.argv.includes('--release');
const manifestPath = arg('manifest');
if (!manifestPath) {
  console.error(
    'Required: --manifest=<path>. Optional: --package, --lockfile, --adapter, --behavior, --checks, --release, --result.',
  );
  process.exit(2);
}
const fileHash = (file) => {
  try {
    return hash(readFileSync(file));
  } catch {
    return null;
  }
};
const hash = (text) => createHash('sha256').update(text).digest('hex');
const observations = [];
function record(id, status, detail, extra = {}) {
  observations.push({ id, status, detail, ...extra });
  console.log(`${status.padEnd(11)} ${id} — ${detail}`);
}
let manifest;
try {
  manifest = loadManifest(manifestPath);
} catch (error) {
  record('manifest-json', 'FAIL', error.message);
}
const issues = manifest ? validateManifest(manifest) : [];
issues.forEach((i) => record(i.path, 'FAIL', i.message));
const valid = manifest && !issues.length;
const runId = randomUUID();
const manifestHash = manifest ? hash(JSON.stringify(manifest)) : null;
const adapterValue = arg('agent-adapter') || arg('adapter');
const adapter = adapterValue ? path.resolve(adapterValue) : null;
const agentMode = !!arg('agent-adapter');
if (arg('agent-adapter') && arg('adapter'))
  record('adapter-selection', 'FAIL', 'choose agent-adapter or bakeoff adapter, not both');
let suite = null;
if (valid) {
  record('manifest-contract', 'PASS', 'complete JSON Schema and cross-field rules validated');
  const pkg = arg('package'),
    lock = arg('lockfile');
  if (!!pkg !== !!lock) record('pin-check', 'FAIL', 'both --package and --lockfile are required');
  else if (!pkg) record('package-pins', 'UNENFORCED', 'supply package and lockfile');
  else {
    try {
      const failures = verifyPins(manifest, pkg, lock);
      if (failures.length) failures.forEach((i) => record(i.path, 'FAIL', i.message));
      else
        record('package-pins', 'PASS', 'manifest, package and lockfile agree', {
          package_hash: hash(readFileSync(pkg)),
          lockfile_hash: hash(readFileSync(lock)),
        });
    } catch (error) {
      record('package-pins', 'FAIL', error.message);
    }
  }
  if (adapter && !agentMode)
    record(
      'actual-agent-binding',
      'UNENFORCED',
      'bakeoff evidence is analogous; use --agent-adapter for actual-agent release proof',
    );
  if (adapter) {
    const projectRoot = agentMode ? path.dirname(path.resolve(manifestPath)) : process.cwd();
    const fixtures = resolveFixtureCases(
      manifest,
      projectRoot,
      agentMode ? 'tests/fixtures' : 'bakeoff/evals/fixtures',
    );
    if (fixtures.issues.length) fixtures.issues.forEach((i) => record(i.path, 'FAIL', i.message));
    else {
      const dir = mkdtempSync(path.join(tmpdir(), 'studio-suite-'));
      const output = path.join(dir, 'suite.json');
      const evaluator = agentMode
        ? new URL('./agent-suite.js', import.meta.url).pathname
        : path.resolve('bakeoff/evals/runner.js');
      const extra = agentMode
        ? [
            `--fixture-root=${path.join(projectRoot, 'tests/fixtures')}`,
            `--agent-id=${manifest.agent.id}`,
            ...(manifest.evaluation.behavior_eval.enabled
              ? [
                  `--policy=${JSON.stringify({ requirePreflight: manifest.operations.preflight.required, requireApproval: manifest.tools.some((t) => t.effect === 'external-write' && t.approval_required) })}`,
                ]
              : []),
          ]
        : [];
      const child = spawnSync(
        process.execPath,
        [
          evaluator,
          `--harness=${adapter}`,
          `--case=${fixtures.cases.join(',')}`,
          `--suite-id=${runId}`,
          `--result=${output}`,
          `--runs-dir=${dir}`,
          ...extra,
        ],
        { stdio: 'inherit', timeout: 300000 },
      );
      try {
        suite = JSON.parse(readFileSync(output, 'utf8'));
      } catch {
        /* missing evidence is a failure */
      }
      const exact =
        suite?.suite_id === runId &&
        suite?.adapter === adapter &&
        Array.isArray(suite.results) &&
        suite.results.length === fixtures.cases.length &&
        new Set(suite.results.map((r) => r.case)).size === fixtures.cases.length &&
        fixtures.cases.every((c) =>
          suite.results.some((r) => r.case === c && r.verdict === 'PASS'),
        );
      if (child.status === 0 && exact)
        record(
          'golden-cases',
          'PASS',
          `${fixtures.cases.length} manifest-selected fixture(s) passed`,
          {
            cases: fixtures.cases,
            scope: agentMode ? 'actual-agent-adapter' : 'bakeoff-adapter',
            adapter,
          },
        );
      else
        record(
          'golden-cases',
          'FAIL',
          `suite failed, blocked, missing, or mismatched (exit ${child.status})`,
        );
    }
  } else
    record(
      'golden-cases',
      'UNENFORCED',
      'supply an explicit adapter to run selected bakeoff fixtures',
    );
  if (process.argv.includes('--behavior')) {
    const child = spawnSync(
      process.execPath,
      ['--test', new URL('../bakeoff/evals/behavior.test.js', import.meta.url).pathname],
      { stdio: 'inherit', timeout: 60000 },
    );
    record(
      'behavior-compiler',
      child.status === 0 ? 'PASS' : 'FAIL',
      'compiler unit tests; not proof of this agent’s behavior',
    );
  } else record('behavior-compiler', 'UNENFORCED', 'not requested');

  // Only operator-supplied modules execute code. Manifest command strings are documentation.
  let checks = {};
  if (arg('checks')) {
    try {
      checks = (await import(pathToFileURL(path.resolve(arg('checks'))).href)).checks || {};
    } catch (error) {
      record('check-module', 'FAIL', error.message);
    }
  }
  function collect(value, prefix = '') {
    if (!value || typeof value !== 'object') return [];
    if (value.id && value.failure_condition && value.enforcement)
      return [{ check: value, field: prefix }];
    return Object.entries(value).flatMap(([k, v]) => collect(v, prefix ? `${prefix}.${k}` : k));
  }
  for (const { check, field } of collect(manifest)) {
    const id = `proof:${field}`;
    if (typeof checks[check.id] !== 'function') {
      record(id, 'UNENFORCED', `no executable proof supplied for ${check.id}`, {
        check_id: check.id,
      });
      continue;
    }
    let timer;
    try {
      const evidence = await Promise.race([
        checks[check.id]({ manifest, manifestHash, runId, adapter, suite }),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('proof timed out after 30s')), 30000);
        }),
      ]);
      const bound =
        evidence?.agent_id === manifest.agent.id &&
        evidence?.manifest_hash === manifestHash &&
        evidence?.run_id === runId;
      if (
        !bound ||
        typeof evidence.detail !== 'string' ||
        !evidence.detail.trim() ||
        !['PASS', 'FAIL', 'UNENFORCED'].includes(evidence.status)
      )
        throw new Error(
          'proof must name this agent, manifest hash, run ID, explicit status, and detail',
        );
      record(id, evidence.status, evidence.detail, { check_id: check.id });
    } catch (error) {
      record(id, 'FAIL', error.message, { check_id: check.id });
    } finally {
      clearTimeout(timer);
    }
  }
}
const failures = observations.filter((o) => o.status === 'FAIL');
const incomplete = observations.some((o) => o.status === 'UNENFORCED');
const status = failures.length ? 'failed' : incomplete ? 'incomplete' : 'passed';
const git = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
const dirty = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8' });
const result = {
  manifest: manifest?.agent?.id ?? null,
  schema_version: manifest?.schema_version ?? null,
  run_id: runId,
  manifest_hash: manifestHash,
  git_sha: git.status === 0 ? git.stdout.trim() : null,
  adapter_hash: adapter && valid ? fileHash(adapter) : null,
  check_module_hash: arg('checks') && valid ? fileHash(arg('checks')) : null,
  working_tree_dirty: dirty.status === 0 ? !!dirty.stdout.trim() : null,
  generated_at: new Date().toISOString(),
  status,
  release_ready: status === 'passed',
  observations,
  failures,
};
const output =
  arg('result') || `runs/manifests/${valid ? manifest.agent.id : 'invalid'}-latest.json`;
mkdirSync(path.dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
if (arg('failure-draft') && failures.some((f) => f.id === 'golden-cases')) {
  mkdirSync(path.dirname(arg('failure-draft')), { recursive: true });
  writeFileSync(
    arg('failure-draft'),
    JSON.stringify(
      {
        status: 'review-required',
        run_id: runId,
        manifest: result.manifest,
        instruction: 'Review before promoting any failure into a permanent fixture.',
        non_passing_cases: suite?.results?.filter((r) => r.verdict !== 'PASS') || [],
      },
      null,
      2,
    ) + '\n',
  );
}
console.log(`RESULT      ${status} — ${output}`);
process.exit(failures.length ? 1 : release && incomplete ? 2 : 0);
