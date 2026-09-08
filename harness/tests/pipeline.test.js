import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { validatePipeline } from '../pipeline.js';
const state = {
  schema_version: '1.0.0',
  agent_id: 'news-digest',
  job: 'Draft a news digest',
  owner: 'Studio',
  rung: 1,
  profile: 'skill',
  evidence_profile: 'prototype',
  runtime_home: 'local',
  talk_surface: 'chat',
  tool_identity: 'none',
  implementation_authorized: true,
  stage: 'intake',
  blockers: [],
  decisions: {},
  artifacts: {},
};
test('carrier accepts confirmed intake and rejects mismatched profile or missing stage inputs', () => {
  const root = fs.mkdtempSync(path.join(tmpdir(), 'studio-carrier-'));
  assert.deepEqual(validatePipeline(state, root), []);
  assert.ok(validatePipeline({ ...state, rung: 4 }, root).length);
  assert.ok(
    validatePipeline({ ...state, stage: 'implementation' }, root).some((i) =>
      i.includes('missing artifact'),
    ),
  );
  assert.ok(
    validatePipeline({ ...state, artifacts: { prd: '../outside.md' } }, root).some((i) =>
      i.includes('unsafe'),
    ),
  );
});

import { createHash } from 'node:crypto';
const sha = (body) => createHash('sha256').update(body).digest('hex');
function completedFixture() {
  const root = fs.mkdtempSync(path.join(tmpdir(), 'studio-complete-'));
  const artifacts = {};
  for (const key of ['workflow', 'agent_spec', 'eval_contract', 'prd', 'work_orders']) {
    artifacts[key] = `${key}.md`;
    fs.writeFileSync(path.join(root, artifacts[key]), 'Reviewed artifact');
  }
  return { root, carrier: { ...state, stage: 'complete', artifacts } };
}
test('a completed plan without a built and evaluated skill cannot complete', () => {
  const { root, carrier } = completedFixture();
  assert.ok(validatePipeline(carrier, root).includes('completion requires built deliverable'));
});
test('prototype completion is bound to built content and observed cases', () => {
  const { root, carrier } = completedFixture();
  carrier.artifacts.deliverable = 'SKILL.md';
  fs.writeFileSync(path.join(root, 'SKILL.md'), 'Real skill instructions');
  carrier.artifacts.evaluation_result = 'evaluation.json';
  const result = {
    agent_id: carrier.agent_id,
    evidence_profile: 'prototype',
    status: 'passed',
    reviewer: 'Independent reviewer',
    artifact_hash: sha('Real skill instructions'),
    cases: [0, 1, 2, 3].map((n) => ({
      id: `case-${n}`,
      status: 'PASS',
      source: 'real',
      band: n === 3 ? 'must-refuse' : 'typical',
    })),
  };
  fs.writeFileSync(path.join(root, 'evaluation.json'), JSON.stringify(result));
  assert.deepEqual(validatePipeline(carrier, root), []);
  fs.writeFileSync(path.join(root, 'SKILL.md'), 'Changed instructions');
  assert.ok(validatePipeline(carrier, root).some((i) => i.includes('this deliverable')));
});
test('coded completion rejects an analogous bakeoff result', () => {
  const { root, carrier } = completedFixture();
  const manifest = JSON.parse(
    fs.readFileSync('examples/manifests/approval-gated-module.agent.json'),
  );
  Object.assign(carrier, {
    rung: 4,
    profile: 'coded',
    agent_id: manifest.agent.id,
    manifest_hash: sha(JSON.stringify(manifest)),
  });
  carrier.artifacts.manifest = 'agent-manifest.json';
  carrier.artifacts.conformance = 'conformance.json';
  fs.writeFileSync(path.join(root, 'agent-manifest.json'), JSON.stringify(manifest));
  fs.writeFileSync(
    path.join(root, 'conformance.json'),
    JSON.stringify({
      status: 'passed',
      release_ready: true,
      manifest: manifest.agent.id,
      manifest_hash: carrier.manifest_hash,
      observations: [{ id: 'golden-cases', status: 'PASS', scope: 'bakeoff-adapter' }],
    }),
  );
  assert.ok(validatePipeline(carrier, root).some((i) => i.includes('analogous')));
});
