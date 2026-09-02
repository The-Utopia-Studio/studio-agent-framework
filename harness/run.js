#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { loadManifest, validateManifest, verifyPins } from './manifest.js';

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
const runBehavior = process.argv.includes('--behavior');

if (!manifestPath) {
  console.error('usage: node harness/run.js --manifest=<path> [--package=<path> --lockfile=<path>] [--behavior]');
  process.exit(2);
}

let manifest;
try {
  manifest = loadManifest(manifestPath);
} catch (error) {
  report('FAIL', 'manifest-json', error.message);
  process.exit(1);
}

const contractIssues = validateManifest(manifest);
if (contractIssues.length) {
  for (const failure of contractIssues) report('FAIL', failure.path, failure.message);
} else {
  report('PASS', 'manifest-contract', `${manifest.agent.id} is internally consistent`);
}

if (packagePath || lockfilePath) {
  if (!packagePath || !lockfilePath) {
    report('FAIL', 'pin-check', 'both --package and --lockfile are required');
  } else {
    try {
      const pinIssues = verifyPins(manifest, packagePath, lockfilePath);
      if (pinIssues.length) for (const failure of pinIssues) report('FAIL', failure.path, failure.message);
      else report('PASS', 'package-pins', 'manifest, package.json, and lockfile agree');
    } catch (error) {
      report('FAIL', 'pin-check', error.message);
    }
  }
} else {
  report('UNENFORCED', 'package-pins', 'provide --package and --lockfile to compare installed declarations');
}

if (runBehavior) {
  const testPath = path.resolve('bakeoff/evals/behavior.test.js');
  const result = spawnSync(process.execPath, ['--test', testPath], { stdio: 'inherit' });
  report(result.status === 0 ? 'PASS' : 'FAIL', 'behavior-compiler', result.status === 0 ? 'portable predicates pass' : 'behavior test failed');
} else {
  report('UNENFORCED', 'behavior-compiler', 'pass --behavior to run the portable behavior test');
}

const failed = contractIssues.length > 0 || (packagePath && lockfilePath && verifyPins(manifest, packagePath, lockfilePath).length > 0);
process.exit(failed ? 1 : 0);
