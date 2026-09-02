#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { loadManifest, resolveFixtureCases, validateManifest, verifyPins } from './manifest.js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

function argument(name) {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function report(status, id, detail) {
  console.log(`${status.padEnd(11)} ${id}${detail ? ` — ${detail}` : ''}`);
}

const manifestPath = argument('manifest');
const packagePath = argument('package');
const lockfilePath = argument('lockfile');
const adapterPath = argument('adapter');
const resultPath = argument('result');
const failureDraftPath = argument('failure-draft');
const runBehavior = process.argv.includes('--behavior');

if (!manifestPath) {
  console.error('usage: node harness/run.js --manifest=<path> [--package=<path> --lockfile=<path>] [--adapter=<path>] [--behavior] [--result=<path>]');
  process.exit(2);
}

let manifest;
try {
  manifest = loadManifest(manifestPath);
} catch (error) {
  report('FAIL', 'manifest-json', error.message);
  process.exit(1);
}

const failures = [];
const observations = [];
const contractIssues = validateManifest(manifest);
if (contractIssues.length) {
  for (const failure of contractIssues) {
    report('FAIL', failure.path, failure.message);
    failures.push({ id: failure.path, detail: failure.message });
  }
} else {
  report('PASS', 'manifest-contract', `${manifest.agent.id} is internally consistent`);
  observations.push({ id: 'manifest-contract', status: 'PASS' });
}

if (packagePath || lockfilePath) {
  if (!packagePath || !lockfilePath) {
    report('FAIL', 'pin-check', 'both --package and --lockfile are required');
  } else {
    try {
      const pinIssues = verifyPins(manifest, packagePath, lockfilePath);
      if (pinIssues.length) for (const failure of pinIssues) {
        report('FAIL', failure.path, failure.message);
        failures.push({ id: failure.path, detail: failure.message });
      } else {
        report('PASS', 'package-pins', 'manifest, package.json, and lockfile agree');
        observations.push({ id: 'package-pins', status: 'PASS' });
      }
    } catch (error) {
      report('FAIL', 'pin-check', error.message);
      failures.push({ id: 'pin-check', detail: error.message });
    }
  }
} else {
  report('UNENFORCED', 'package-pins', 'provide --package and --lockfile to compare installed declarations');
}

if (adapterPath) {
  const fixtureSet = resolveFixtureCases(manifest);
  if (fixtureSet.issues.length) {
    for (const failure of fixtureSet.issues) {
      report('FAIL', failure.path, failure.message);
      failures.push({ id: failure.path, detail: failure.message });
    }
  } else {
    const evaluator = path.resolve('bakeoff/evals/runner.js');
    const adapter = path.resolve(adapterPath);
    const result = spawnSync(process.execPath, [evaluator, `--harness=${adapter}`, `--case=${fixtureSet.cases.join(',')}`], { stdio: 'inherit' });
    let suite = null;
    try { suite = JSON.parse(readFileSync('runs/last-suite.json', 'utf8')); } catch (_) { /* reported below */ }
    const nonPassing = suite?.results?.filter((item) => item.verdict !== 'PASS') || [];
    if (result.status === 0 && suite && nonPassing.length === 0) {
      report('PASS', 'golden-cases', `${fixtureSet.cases.length} manifest-selected fixture(s) passed`);
      observations.push({ id: 'golden-cases', status: 'PASS', cases: fixtureSet.cases });
    } else {
      const detail = result.status !== 0
        ? `selected fixture suite exited ${result.status ?? 'with a signal'}`
        : !suite
          ? 'selected fixture suite produced no machine-readable result'
          : `${nonPassing.length} selected fixture(s) did not pass: ${nonPassing.map((item) => `${item.case}=${item.verdict}`).join(', ')}`;
      report('FAIL', 'golden-cases', detail);
      failures.push({ id: 'golden-cases', detail, cases: fixtureSet.cases });
    }
  }
} else {
  report('UNENFORCED', 'golden-cases', 'pass --adapter to execute the manifest-selected fixtures');
}

if (runBehavior) {
  const testPath = path.resolve('bakeoff/evals/behavior.test.js');
  const result = spawnSync(process.execPath, ['--test', testPath], { stdio: 'inherit' });
  if (result.status === 0) {
    report('PASS', 'behavior-compiler', 'portable predicates pass');
    observations.push({ id: 'behavior-compiler', status: 'PASS' });
  } else {
    report('FAIL', 'behavior-compiler', 'behavior test failed');
    failures.push({ id: 'behavior-compiler', detail: 'behavior test failed' });
  }
} else {
  report('UNENFORCED', 'behavior-compiler', 'pass --behavior to run the portable behavior test');
}

const outputPath = resultPath || `runs/manifests/${manifest.agent.id}-latest.json`;
const output = {
  manifest: manifest.agent.id,
  schema_version: manifest.schema_version,
  generated_at: new Date().toISOString(),
  status: failures.length ? 'failed' : 'passed',
  observations,
  failures,
};
mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
report('RESULT', 'conformance-result', outputPath);

if (failureDraftPath && failures.some((failure) => failure.id === 'golden-cases')) {
  let suite = null;
  try { suite = JSON.parse(readFileSync('runs/last-suite.json', 'utf8')); } catch (_) { /* report remains useful without runner detail */ }
  const draft = {
    generated_at: output.generated_at,
    status: 'review-required',
    manifest: manifest.agent.id,
    adapter: adapterPath,
    instruction: 'Review this draft before adding or changing a permanent fixture. Do not promote a failure automatically.',
    non_passing_cases: suite?.results?.filter((item) => item.verdict !== 'PASS') || [],
  };
  mkdirSync(path.dirname(failureDraftPath), { recursive: true });
  writeFileSync(failureDraftPath, `${JSON.stringify(draft, null, 2)}\n`);
  report('RESULT', 'failure-draft', failureDraftPath);
}

process.exit(failures.length ? 1 : 0);
