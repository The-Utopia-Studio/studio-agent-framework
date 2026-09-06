import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Explicit registry — mirrors STANDARD §1a "typed input belongs to the agent". */
export const AGENT_INPUT_SCHEMAS = {
  'example-leads': path.join(HERE, 'agents', 'example-leads.input.schema.json'),
};

function issue(issues, pathName, message) {
  issues.push({ path: pathName, message });
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Tiny subset of JSON Schema draft-2020-12 used by the example agent schemas.
 * Enough to check required fields, types, enums, and additionalProperties:false —
 * not a general-purpose validator.
 */
function validateAgainstSchema(value, schema, pathName, issues) {
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      issue(issues, pathName, 'must be an object');
      return;
    }
    for (const key of schema.required || []) {
      if (value[key] === undefined || value[key] === null || value[key] === '') {
        issue(issues, pathName === '$' ? key : `${pathName}.${key}`, 'is required and must be filled');
      }
    }
    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(schema.properties || {}));
      for (const key of Object.keys(value)) {
        if (!allowed.has(key)) issue(issues, pathName === '$' ? key : `${pathName}.${key}`, 'is not allowed');
      }
    }
    for (const [key, propSchema] of Object.entries(schema.properties || {})) {
      if (value[key] === undefined || value[key] === null) continue;
      validateAgainstSchema(value[key], propSchema, pathName === '$' ? key : `${pathName}.${key}`, issues);
    }
    return;
  }

  if (schema.type === 'string') {
    if (typeof value !== 'string') {
      issue(issues, pathName, 'must be a string');
      return;
    }
    if (schema.minLength && value.length < schema.minLength) {
      issue(issues, pathName, `must be at least ${schema.minLength} characters`);
    }
    if (schema.enum && !schema.enum.includes(value)) {
      issue(issues, pathName, `must be one of: ${schema.enum.join(', ')}`);
    }
    return;
  }

  if (schema.type === 'integer') {
    if (!Number.isInteger(value)) {
      issue(issues, pathName, 'must be an integer');
      return;
    }
    if (schema.minimum !== undefined && value < schema.minimum) {
      issue(issues, pathName, `must be >= ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      issue(issues, pathName, `must be <= ${schema.maximum}`);
    }
  }
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

  const schema = loadJson(schemaPath);
  validateAgainstSchema(output.input, schema, 'input', issues);

  if (output.confidence === 'low') {
    issue(issues, 'confidence', 'is low — ask the fellow; nothing starts');
  }

  const ok = issues.length === 0;
  return { ok, mayStart: ok, issues };
}
