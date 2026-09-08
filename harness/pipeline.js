import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { validateManifest } from './manifest.js';
const stages = [
  'intake',
  'workflow',
  'agent-design',
  'evaluation',
  'prd',
  'structure',
  'implementation',
  'verification',
  'complete',
];
export function validatePipeline(state, root) {
  const issues = [];
  if (!state || typeof state !== 'object' || Array.isArray(state))
    return ['carrier must be an object'];
  for (const key of ['agent_id', 'job', 'owner', 'runtime_home', 'talk_surface', 'tool_identity'])
    if (typeof state[key] !== 'string' || !state[key].trim()) issues.push(`missing ${key}`);
  if (state.schema_version !== '1.0.0') issues.push('unsupported carrier schema_version');
  if (!stages.includes(state.stage)) issues.push('invalid stage');
  if (![1, 2, 3, 4].includes(state.rung)) issues.push('invalid rung');
  if (state.profile !== { 1: 'skill', 2: 'managed', 3: 'managed', 4: 'coded' }[state.rung])
    issues.push('profile must match rung');
  if (!['prototype', 'reviewed', 'production'].includes(state.evidence_profile))
    issues.push('invalid evidence profile');
  if (typeof state.implementation_authorized !== 'boolean')
    issues.push('record implementation authorization');
  if (!Array.isArray(state.blockers)) issues.push('blockers must be an array');
  if (!state.decisions || typeof state.decisions !== 'object' || Array.isArray(state.decisions))
    issues.push('decisions must be an object');
  const index = stages.indexOf(state.stage);
  const artifacts = state.artifacts || {};
  const required =
    index >= 5
      ? ['workflow', 'agent_spec', 'eval_contract', 'prd', 'work_orders']
      : index >= 4
        ? ['workflow', 'agent_spec', 'eval_contract']
        : index >= 3
          ? ['workflow', 'agent_spec']
          : index >= 2
            ? ['workflow']
            : [];
  if (state.rung === 4 && index >= 5) required.push('manifest');
  for (const key of required)
    if (typeof artifacts[key] !== 'string') issues.push(`missing artifact ${key}`);
  for (const [key, ref] of Object.entries(artifacts)) {
    if (
      typeof ref !== 'string' ||
      path.isAbsolute(ref) ||
      !path.resolve(root, ref).startsWith(path.resolve(root) + path.sep)
    ) {
      issues.push(`unsafe artifact ${key}`);
      continue;
    }
    try {
      if (!fs.realpathSync(path.resolve(root, ref)).startsWith(fs.realpathSync(root) + path.sep))
        issues.push(`artifact ${key} escapes repository`);
    } catch {
      issues.push(`artifact ${key} is missing`);
    }
  }
  if (index >= 6 && !state.implementation_authorized)
    issues.push('implementation has not been authorized');
  if (state.stage === 'complete' && state.blockers?.length)
    issues.push('cannot complete with blockers');
  if (state.rung === 4 && index >= 5 && !issues.length) {
    try {
      const m = JSON.parse(fs.readFileSync(path.resolve(root, artifacts.manifest)));
      issues.push(...validateManifest(m).map((i) => `${i.path}: ${i.message}`));
      if (m.agent?.id !== state.agent_id) issues.push('manifest belongs to another agent');
      const hash = createHash('sha256').update(JSON.stringify(m)).digest('hex');
      if (state.manifest_hash !== hash)
        issues.push('manifest changed: review decisions and refresh carrier hash');
      if (state.stage === 'complete') {
        if (!artifacts.conformance)
          issues.push('completion requires actual-agent conformance result');
        else {
          const result = JSON.parse(fs.readFileSync(path.resolve(root, artifacts.conformance)));
          if (
            result.status !== 'passed' ||
            result.release_ready !== true ||
            result.manifest_hash !== hash ||
            result.manifest !== state.agent_id ||
            !Array.isArray(result.observations) ||
            !result.observations.length ||
            result.observations.some((o) => o.status !== 'PASS') ||
            !result.observations.some(
              (o) => o.id === 'golden-cases' && o.scope === 'actual-agent-adapter',
            )
          )
            issues.push('conformance is incomplete, analogous, or belongs to another manifest');
        }
      }
    } catch (error) {
      issues.push(`invalid manifest or conformance artifact: ${error.message}`);
    }
  }

  if (state.stage === 'complete' && !issues.length) {
    if (!artifacts.deliverable) issues.push('completion requires built deliverable');
    if (!artifacts.evaluation_result) issues.push('completion requires observed evaluation result');
    if (!issues.length) {
      try {
        const body = fs.readFileSync(path.resolve(root, artifacts.deliverable));
        const hash = createHash('sha256').update(body).digest('hex');
        const result = JSON.parse(fs.readFileSync(path.resolve(root, artifacts.evaluation_result)));
        if (
          result.agent_id !== state.agent_id ||
          result.artifact_hash !== hash ||
          result.evidence_profile !== state.evidence_profile ||
          result.status !== 'passed' ||
          typeof result.reviewer !== 'string' ||
          !result.reviewer.trim()
        )
          issues.push('evaluation must identify this deliverable, profile, and reviewer');
        const cases = result.cases;
        const minimum = { prototype: 4, reviewed: 10, production: 20 }[state.evidence_profile];
        if (
          !Array.isArray(cases) ||
          cases.length < minimum ||
          cases.some(
            (c) =>
              !c ||
              typeof c.id !== 'string' ||
              !c.id ||
              c.status !== 'PASS' ||
              !['typical', 'edge', 'adversarial', 'must-refuse'].includes(c.band) ||
              !['real', 'synthetic'].includes(c.source),
          ) ||
          new Set(cases.map((c) => c?.id)).size !== cases.length
        )
          issues.push('evaluation cases are incomplete or failed');
        else if (state.evidence_profile === 'production') {
          for (const [band, n] of Object.entries({
            typical: 6,
            edge: 7,
            adversarial: 4,
            'must-refuse': 3,
          }))
            if (cases.filter((c) => c.band === band).length < n)
              issues.push(`missing production ${band} coverage`);
          if (cases.filter((c) => c.source === 'real').length < 14)
            issues.push('production requires at least 14 real inputs');
        } else if (
          !cases.some((c) => c.band === 'must-refuse') ||
          !cases.some((c) => c.band === 'typical')
        )
          issues.push('evaluation requires typical and refusal coverage');
      } catch (error) {
        issues.push(`invalid completion artifact: ${error.message}`);
      }
    }
  }
  return issues;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const file = process.argv[2];
    if (!file) throw new Error('usage: node harness/pipeline.js <repo>/build-state.json');
    const issues = validatePipeline(
      JSON.parse(fs.readFileSync(file)),
      path.dirname(path.resolve(file)),
    );
    issues.forEach((i) => console.error(i));
    if (!issues.length) console.log('Pipeline carrier PASS');
    process.exitCode = issues.length ? 1 : 0;
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
