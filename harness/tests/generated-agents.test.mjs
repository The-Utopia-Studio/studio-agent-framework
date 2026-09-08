import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { validateManifest } from '../manifest.js';
import { validatePipeline } from '../pipeline.js';
import { validateStructure } from '../structure.js';
import { createAgent as createBriefingAgent } from '../../examples/generated-agents/briefing-agent/src/index.mjs';
import { createAgent as createMemoryAgent } from '../../examples/generated-agents/memory-workflow-agent/src/index.mjs';

const sha = (value) => createHash('sha256').update(value).digest('hex');
const examples = [
  'briefing-agent',
  'memory-workflow-agent',
];

function copyExample(name) {
  const source = path.resolve('examples/generated-agents', name);
  const root = fs.mkdtempSync(path.join(tmpdir(), `${name}-journey-`));
  fs.cpSync(source, root, { recursive: true });
  return root;
}

function runActual(root) {
  const resultPath = path.join(root, 'conformance.json');
  const run = spawnSync(
    process.execPath,
    [
      'harness/run.js',
      `--manifest=${path.join(root, 'agent-manifest.json')}`,
      `--package=${path.join(root, 'package.json')}`,
      `--lockfile=${path.join(root, 'package-lock.json')}`,
      `--agent-adapter=${path.join(root, 'tests/adapter.mjs')}`,
      `--checks=${path.join(root, 'tests/conformance.mjs')}`,
      '--behavior',
      '--release',
      `--result=${resultPath}`,
    ],
    { encoding: 'utf8' },
  );
  assert.equal(run.status, 0, run.stdout + run.stderr);
  return JSON.parse(fs.readFileSync(resultPath, 'utf8'));
}

function completeCarrier(root, manifest, conformance) {
  const carrier = JSON.parse(fs.readFileSync(path.join(root, 'build-state.json'), 'utf8'));
  const manifestHash = sha(JSON.stringify(manifest));
  carrier.manifest_hash = manifestHash;
  carrier.stage = 'complete';
  carrier.artifacts.conformance = 'conformance.json';
  carrier.artifacts.evaluation_result = 'evaluation.json';
  const deliverable = fs.readFileSync(path.join(root, carrier.artifacts.deliverable));
  fs.writeFileSync(
    path.join(root, 'evaluation.json'),
    JSON.stringify({
      agent_id: carrier.agent_id,
      evidence_profile: carrier.evidence_profile,
      status: 'passed',
      reviewer: 'framework journey test',
      artifact_hash: sha(deliverable),
      cases: [
        { id: 'typical-1', status: 'PASS', band: 'typical', source: 'synthetic' },
        { id: 'typical-2', status: 'PASS', band: 'typical', source: 'synthetic' },
        { id: 'edge-1', status: 'PASS', band: 'edge', source: 'synthetic' },
        { id: 'refusal-1', status: 'PASS', band: 'must-refuse', source: 'synthetic' },
      ],
    }, null, 2),
  );
  fs.writeFileSync(path.join(root, 'conformance.json'), JSON.stringify({
    ...conformance,
    manifest: carrier.agent_id,
    manifest_hash: manifestHash,
  }));
  return carrier;
}

test('two generated repositories pass structure, actual-agent conformance, and completion', () => {
  for (const name of examples) {
    const root = copyExample(name);
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'agent-manifest.json')));
    assert.deepEqual(validateManifest(manifest), [], name);
    assert.deepEqual(validateStructure(root, 'coded'), [], name);

    const stages = ['intake', 'workflow', 'agent-design', 'evaluation', 'prd', 'structure', 'implementation', 'verification'];
    const carrier = JSON.parse(fs.readFileSync(path.join(root, 'build-state.json')));
    carrier.manifest_hash = sha(JSON.stringify(manifest));
    for (const stage of stages) {
      carrier.stage = stage;
      assert.deepEqual(validatePipeline(carrier, root), [], `${name}:${stage}`);
    }

    const conformance = runActual(root);
    assert.equal(conformance.status, 'passed', name);
    assert.ok(conformance.observations.some((o) => o.id === 'golden-cases' && o.scope === 'actual-agent-adapter'));
    const repeat = runActual(root);
    assert.deepEqual(
      repeat.observations.filter((o) => o.id === 'golden-cases').map((o) => [o.status, o.scope]),
      conformance.observations.filter((o) => o.id === 'golden-cases').map((o) => [o.status, o.scope]),
      `${name}:repeatability`,
    );
    const completed = completeCarrier(root, manifest, conformance);
    assert.deepEqual(validatePipeline(completed, root), [], `${name}:complete`);
  }
});

test('fresh and already-active context are routed without forcing memory on a stateless agent', () => {
  const agent = createBriefingAgent();
  assert.equal(agent.run({ topic: 'renewables' }).context_used, false);
  const active = agent.run({ topic: 'grid storage' }, { context: { lastTopic: 'renewables' } });
  assert.equal(active.context_used, true);
  assert.equal(active.prior_topic, 'renewables');
});

test('scope changes and process restart preserve only the selected tenant memory', async () => {
  const store = new Map();
  const firstProcess = createMemoryAgent({ store });
  await firstProcess.run({ tenant_id: 'studio-a', resource: 'notes', note: 'ship the digest' });

  const freshProcess = createMemoryAgent({ store });
  const otherTenant = await freshProcess.run({ tenant_id: 'studio-b', resource: 'notes', workflow: 'resume' });
  assert.equal(otherTenant.output, 'Nothing remembered.');
  const resumed = await freshProcess.run({ tenant_id: 'studio-a', resource: 'notes', workflow: 'resume' });
  assert.equal(resumed.output, 'Remembered: ship the digest');
  assert.equal(resumed.memory_scope, 'studio-a');
  assert.deepEqual(
    resumed.events.slice(0, 4).map((event) => event.step_name),
    ['precondition_checked', 'workflow_started', 'memory_read', 'workflow_resumed'],
  );
});
