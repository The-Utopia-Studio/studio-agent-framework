import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
'use strict';
// Every agent in a manifest must have a typed input schema the router can validate against.
//
// WHY THIS TEST EXISTS
//
// The manifest and the intake scaffold were built separately and joined only by a hardcoded map
// in validate.js. When this test was written the two had ZERO overlap: the manifests declared
// `approval-gated-module` and `tech-news-reference`, and the only input schema was for
// `example-leads`, which is in no manifest. Every test on both sides passed, because each side
// only ever tested itself.
//
// So neither real agent could actually be dispatched through the validator, the one agent that
// could be validated did not exist in the registry, and nothing anywhere failed. That is the
// house failure mode -- a check that cannot fail is not a check -- and it is the reason
// STANDARD.md §1a still calls the entry path "mostly design".
//
// This test is the join. It fails when a manifest gains an agent with no input schema, which is
// exactly the moment someone would otherwise believe the front door works for it.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(new URL('.', import.meta.url).pathname, '..', '..', '..');
const MANIFEST_DIR = path.join(ROOT, 'examples', 'manifests');
const SCHEMA_DIR = path.join(new URL('.', import.meta.url).pathname, '..', 'agents');

function manifestAgents() {
  if (!fs.existsSync(MANIFEST_DIR)) return [];
  return fs.readdirSync(MANIFEST_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const d = JSON.parse(fs.readFileSync(path.join(MANIFEST_DIR, f), 'utf8'));
      return { file: f, id: d.agent && d.agent.id, module: d.agent && d.agent.module };
    })
    .filter((a) => a.id);
}

function schemaIds() {
  if (!fs.existsSync(SCHEMA_DIR)) return [];
  return fs.readdirSync(SCHEMA_DIR)
    .filter((f) => f.endsWith('.input.schema.json'))
    .map((f) => f.replace(/\.input\.schema\.json$/, ''));
}

function registeredIds() {
  const src = fs.readFileSync(path.join(new URL('.', import.meta.url).pathname, '..', 'validate.js'), 'utf8');
  const block = /AGENT_INPUT_SCHEMAS\s*=\s*\{([\s\S]*?)\}/.exec(src);
  if (!block) return [];
  return [...block[1].matchAll(/['"]([a-z0-9-]+)['"]\s*:/g)].map((m) => m[1]);
}

test('the fixtures are not empty — otherwise the checks below cannot fail', () => {
  assert.ok(manifestAgents().length > 0, 'no manifests found; this test would pass vacuously');
  assert.ok(schemaIds().length > 0, 'no input schemas found; this test would pass vacuously');
});

test('every manifest agent has an input schema file', () => {
  const schemas = new Set(schemaIds());
  const missing = manifestAgents().filter((a) => !schemas.has(a.id));
  assert.deepStrictEqual(
    missing.map((a) => `${a.id} (${a.file})`), [],
    'manifest agents with no long-horizon/intake/agents/<id>.input.schema.json — the router '
    + 'could pick these and have nothing to validate the filled payload against',
  );
});

test('every manifest agent is registered in validate.js', () => {
  const registered = new Set(registeredIds());
  const missing = manifestAgents().filter((a) => !registered.has(a.id));
  assert.deepStrictEqual(
    missing.map((a) => a.id), [],
    'manifest agents absent from AGENT_INPUT_SCHEMAS — a schema file alone is not enough, '
    + 'dispatch reads the explicit map',
  );
});

// `example-*` ids are the README's teaching walkthrough and deliberately have no manifest.
// The rule still bites for everything else, which is what stops a real agent's schema drifting
// away from the registry unnoticed.
test('every non-example input schema belongs to an agent that exists in a manifest', () => {
  const ids = new Set(manifestAgents().map((a) => a.id));
  const orphans = schemaIds().filter((id) => !ids.has(id) && !id.startsWith('example-'));
  assert.deepStrictEqual(
    orphans, [],
    'input schemas with no manifest agent — the router cannot pick these, so they are dead weight '
    + 'that reads like coverage',
  );
});
