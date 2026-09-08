import { validateSchema } from '../../harness/schema.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const routerSchema = JSON.parse(fs.readFileSync(path.join(HERE, '../../schemas/router-output.schema.json'), 'utf8'));
const inputSchemas = new Map();

/** Explicit registry — mirrors STANDARD §1a "typed input belongs to the agent". */
// Deliberately explicit -- no filesystem glob at dispatch time until the registry owns this.
// tests/manifest-join.test.js asserts this map stays in step with examples/manifests/, because
// the two were built separately and originally had ZERO agents in common while every test on
// both sides passed.
export const AGENT_INPUT_SCHEMAS = {
  'tech-news-reference': path.join(HERE, 'agents', 'tech-news-reference.input.schema.json'),
  'approval-gated-module': path.join(HERE, 'agents', 'approval-gated-module.input.schema.json'),
  // Teaching example from the README walkthrough; intentionally has no manifest.
  'example-leads': path.join(HERE, 'agents', 'example-leads.input.schema.json'),
};

function issue(issues, pathName, message) {
  issues.push({ path: pathName, message });
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Validate a router OUT payload per STANDARD §1a.
 * Returns { ok, mayStart, issues }. mayStart is false unless validation passes
 * and confidence is not explicitly "low".
 */
export function validateRouterOutput(output) {
  const issues = [];
  if (!output || typeof output !== 'object' || Array.isArray(output)) {
    return { ok: false, mayStart: false, issues: [{ path: '$', message: 'router output must be an object' }] };
  }

  issues.push(...validateSchema(routerSchema, output));
  const agentId = output.agentId;
  if (typeof agentId !== 'string' || !/^[a-z][a-z0-9-]{2,63}$/.test(agentId)) {
    issue(issues, 'agentId', 'is required and must match an agent id pattern');
  }

  if (!('input' in output)) {
    issue(issues, 'input', 'is required');
  } else if (!output.input || typeof output.input !== 'object' || Array.isArray(output.input)) {
    issue(issues, 'input', 'must be an object');
  }

  if (output.confidence !== undefined && !['high', 'low'].includes(output.confidence)) {
    issue(issues, 'confidence', 'must be high or low when present');
  }

  if (issues.length) return { ok: false, mayStart: false, issues };

  const schemaPath = AGENT_INPUT_SCHEMAS[agentId];
  if (!schemaPath) {
    issue(issues, 'agentId', `no typed input schema registered for "${agentId}" — nothing starts`);
    return { ok: false, mayStart: false, issues };
  }

  if (!inputSchemas.has(schemaPath)) inputSchemas.set(schemaPath, loadJson(schemaPath));
  const schema = inputSchemas.get(schemaPath);
  issues.push(...validateSchema(schema, output.input, 'input'));

  if (output.confidence === 'low') {
    issue(issues, 'confidence', 'is low — ask the fellow; nothing starts');
  }

  const ok = issues.length === 0;
  return { ok, mayStart: ok, issues };
}
