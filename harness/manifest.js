import fs from 'node:fs';
import path from 'node:path';

import { validateSchema } from './schema.js';
const schema = JSON.parse(
  fs.readFileSync(new URL('../schemas/agent-manifest.schema.json', import.meta.url)),
);
function issue(issues, pathName, message) {
  issues.push({ path: pathName, message });
}

export function validateManifest(manifest) {
  const issues = validateSchema(schema, manifest);
  if (issues.length) return issues; // Do not inspect unsafe shapes or run an adapter.
  const declared = manifest.tools.map((tool) => tool.name);
  const allowed = manifest.security.tool_allowlist;
  if (
    new Set(declared).size !== declared.length ||
    declared.some((t) => !allowed.includes(t)) ||
    allowed.some((t) => !declared.includes(t))
  ) {
    issue(issues, 'security.tool_allowlist', 'must match the unique declared tools exactly');
  }
  const memory = manifest.state.memory.channels;
  if (memory.includes('none') && memory.length !== 1)
    issue(issues, 'state.memory.channels', 'none cannot be combined with another channel');
  if (manifest.runtime.harness === 'mastra-convex') {
    if (manifest.state.canonical_store !== 'Convex')
      issue(issues, 'state.canonical_store', 'mastra-convex requires Convex');
    for (const name of ['@mastra/core', '@mastra/convex']) {
      if (!manifest.runtime.packages.some((p) => p.name === name))
        issue(issues, 'runtime.packages', `missing ${name}`);
    }
  }
  if (
    new Set(manifest.runtime.packages.map((p) => p.name)).size !== manifest.runtime.packages.length
  )
    issue(issues, 'runtime.packages', 'package names must be unique');
  return issues;
}

export function verifyPins(manifest, packagePath, lockfilePath) {
  const issues = [];
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const lock = JSON.parse(fs.readFileSync(lockfilePath, 'utf8'));
  const declared = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

  for (const pin of manifest.runtime.packages || []) {
    if (declared[pin.name] !== pin.version) {
      issue(
        issues,
        `package.json:${pin.name}`,
        `expected ${pin.version}, found ${declared[pin.name] || 'missing'}`,
      );
    }
    const locked = lock.packages?.[`node_modules/${pin.name}`]?.version;
    if (locked !== pin.version)
      issue(
        issues,
        `package-lock.json:${pin.name}`,
        `expected ${pin.version}, found ${locked || 'missing'}`,
      );
  }
  return issues;
}

/**
 * Resolves the fixtures a manifest explicitly names.  Fixture paths are data, not commands:
 * they must remain inside the shared fixture directory and identify a real golden case.
 */
export function resolveFixtureCases(
  manifest,
  repositoryRoot = process.cwd(),
  fixtureDirectory = 'bakeoff/evals/fixtures',
) {
  const issues = [];
  const cases = [];
  const fixtureRoot = path.resolve(repositoryRoot, fixtureDirectory);
  const refs = manifest.evaluation?.output_eval?.fixture_refs || [];

  if (!refs.length)
    issue(issues, 'evaluation.output_eval.fixture_refs', 'must select at least one fixture');
  for (const ref of refs) {
    if (!ref.startsWith(`${fixtureDirectory}/`)) {
      issue(
        issues,
        'evaluation.output_eval.fixture_refs',
        `must name a repository fixture, found ${JSON.stringify(ref)}`,
      );
      continue;
    }
    const fixturePath = path.resolve(repositoryRoot, ref);
    if (
      !fixturePath.startsWith(`${fixtureRoot}${path.sep}`) ||
      path.extname(fixturePath) !== '.json'
    ) {
      issue(
        issues,
        'evaluation.output_eval.fixture_refs',
        `must resolve to a JSON file inside bakeoff/evals/fixtures, found ${JSON.stringify(ref)}`,
      );
      continue;
    }
    try {
      if (!fs.realpathSync(fixturePath).startsWith(`${fs.realpathSync(fixtureRoot)}${path.sep}`))
        throw new Error('fixture symlink escapes fixture root');
      const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
      if (!fixture.case || typeof fixture.case !== 'string') {
        issue(
          issues,
          'evaluation.output_eval.fixture_refs',
          `${JSON.stringify(ref)} has no fixture case name`,
        );
      } else {
        cases.push(fixture.case);
      }
    } catch (error) {
      issue(
        issues,
        'evaluation.output_eval.fixture_refs',
        `${JSON.stringify(ref)} cannot be read: ${error.message}`,
      );
    }
  }
  return { cases: [...new Set(cases)], issues };
}

export function loadManifest(manifestPath) {
  return JSON.parse(fs.readFileSync(path.resolve(manifestPath), 'utf8'));
}
