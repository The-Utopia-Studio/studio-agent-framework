import fs from 'node:fs';
import path from 'node:path';

const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const STATUSES = new Set(['ok', 'degraded', 'offline', 'failed']);

function issue(issues, pathName, message) {
  issues.push({ path: pathName, message });
}

function checkCheck(check, pathName, issues) {
  if (!check || typeof check !== 'object') {
    issue(issues, pathName, 'must declare a check object');
    return;
  }
  if (!check.id) issue(issues, `${pathName}.id`, 'is required');
  if (!check.failure_condition || check.failure_condition.length < 12) {
    issue(issues, `${pathName}.failure_condition`, 'must name a meaningful failure condition');
  }
  if (!['runtime', 'repository-ci', 'manual', 'none'].includes(check.enforcement)) {
    issue(issues, `${pathName}.enforcement`, 'must be runtime, repository-ci, manual, or none');
  }
  if (check.enforcement === 'none' && check.command) {
    issue(issues, `${pathName}.command`, 'must be absent when enforcement is none');
  }
  if (check.enforcement !== 'none' && !check.command) {
    issue(issues, `${pathName}.command`, 'is required for an enforceable check');
  }
}

/**
 * Validates the high-value conditional rules in AgentManifest v1. The JSON Schema remains the
 * portable shape contract; these checks are deliberately duplicated in executable form so the
 * repository can run with Node alone and report useful, decision-level failures.
 */
export function validateManifest(manifest) {
  const issues = [];
  if (!manifest || typeof manifest !== 'object') return [{ path: '$', message: 'must be a JSON object' }];
  if (manifest.schema_version !== '1.0.0') issue(issues, 'schema_version', 'must be 1.0.0');
  if (!manifest.agent?.id) issue(issues, 'agent.id', 'is required');

  const security = manifest.security;
  const profiles = new Set(['internal-team', 'fellow-scoped', 'public', 'privileged-admin']);
  if (!security || !profiles.has(security.data_profile)) {
    issue(issues, 'security.data_profile', 'must be internal-team, fellow-scoped, public, or privileged-admin');
  } else {
    const expectedPrincipal = {
      'internal-team': 'named-team-service-account',
      'fellow-scoped': 'authenticated-fellow-context',
      public: 'anonymous-or-user-session',
      'privileged-admin': 'break-glass-admin-context',
    }[security.data_profile];
    if (security.principal_source !== expectedPrincipal) issue(issues, 'security.principal_source', `must be ${expectedPrincipal} for ${security.data_profile}`);
    if (!Array.isArray(security.tool_allowlist) || !security.tool_allowlist.length) issue(issues, 'security.tool_allowlist', 'must name the only tools this agent may use');
    const declaredTools = new Set((manifest.tools || []).map((tool) => tool.name));
    for (const tool of security.tool_allowlist || []) {
      if (!declaredTools.has(tool)) issue(issues, 'security.tool_allowlist', `${tool} is not declared in tools`);
    }
    for (const tool of declaredTools) {
      if (!security.tool_allowlist?.includes(tool)) issue(issues, 'security.tool_allowlist', `${tool} is declared in tools but not allowlisted`);
    }
    for (const checkName of ['audit_log_check', 'undeclared_tool_check', 'out_of_scope_data_check', 'secret_output_check']) {
      checkCheck(security[checkName], `security.${checkName}`, issues);
    }
    if (security.data_profile === 'fellow-scoped') {
      if (!security.allowed_data_classes?.includes('fellow-private')) issue(issues, 'security.allowed_data_classes', 'must explicitly declare fellow-private data for fellow-scoped agents');
      checkCheck(security.tenant_isolation_check, 'security.tenant_isolation_check', issues);
    }
    if (security.data_profile === 'internal-team' && security.allowed_data_classes?.includes('fellow-private')) issue(issues, 'security.allowed_data_classes', 'internal-team agents cannot declare fellow-private data');
    if (security.data_profile === 'public' && security.allowed_data_classes?.some((value) => value !== 'public')) issue(issues, 'security.allowed_data_classes', 'public agents may only declare public data');
    if (security.data_profile === 'privileged-admin') checkCheck(security.elevated_access_check, 'security.elevated_access_check', issues);
  }

  const packages = manifest.runtime?.packages;
  if (!Array.isArray(packages) || !packages.length) issue(issues, 'runtime.packages', 'must declare exact runtime packages');
  for (const [index, pkg] of (packages || []).entries()) {
    if (!pkg?.name) issue(issues, `runtime.packages[${index}].name`, 'is required');
    if (!EXACT_VERSION.test(pkg?.version || '')) issue(issues, `runtime.packages[${index}].version`, 'must be an exact semver version, not a range');
  }

  const workflow = manifest.runtime?.workflow;
  if (!workflow || typeof workflow.required !== 'boolean' || !workflow.rationale) {
    issue(issues, 'runtime.workflow', 'must state whether a workflow is required and why');
  }
  if (workflow?.approval && workflow.required !== true) issue(issues, 'runtime.workflow.required', 'must be true when approval is required');

  if (manifest.lifecycle?.trigger === 'schedule' && manifest.operations?.preflight?.required !== true) {
    issue(issues, 'operations.preflight.required', 'must be true for a scheduled agent');
  }
  checkCheck(manifest.operations?.preflight?.record_check, 'operations.preflight.record_check', issues);

  const statuses = manifest.operations?.statuses || [];
  if (statuses.length !== 4 || !statuses.every((status) => STATUSES.has(status))) {
    issue(issues, 'operations.statuses', 'must declare exactly ok, degraded, offline, and failed');
  }
  checkCheck(manifest.operations?.budget?.enforcement_check, 'operations.budget.enforcement_check', issues);

  for (const [index, tool] of (manifest.tools || []).entries()) {
    if (tool.effect === 'external-write') {
      if (!['check-first', 'idempotency-key'].includes(tool.idempotency)) issue(issues, `tools[${index}].idempotency`, 'external writes need check-first or idempotency-key');
      if (typeof tool.approval_required !== 'boolean') issue(issues, `tools[${index}].approval_required`, 'external writes must state whether approval is required');
    }
  }

  const memory = manifest.state?.memory;
  if (!memory?.channels?.length) issue(issues, 'state.memory.channels', 'is required');
  if (memory?.channels?.includes('working')) {
    if (memory.deterministic_write !== true) issue(issues, 'state.memory.deterministic_write', 'must be true for working memory');
    checkCheck(memory.freshness_check, 'state.memory.freshness_check', issues);
    checkCheck(memory.write_behavior_check, 'state.memory.write_behavior_check', issues);
  }
  checkCheck(manifest.state?.event_log?.external_read_check, 'state.event_log.external_read_check', issues);

  if (manifest.evaluation?.adapter_contract !== 'run(fixture, ctx) -> report') {
    issue(issues, 'evaluation.adapter_contract', 'must use the shared harness adapter contract');
  }
  checkCheck(manifest.evaluation?.output_eval?.check, 'evaluation.output_eval.check', issues);
  checkCheck(manifest.evaluation?.behavior_eval?.check, 'evaluation.behavior_eval.check', issues);

  for (const [index, claim] of (manifest.conformance || []).entries()) {
    checkCheck(claim.check, `conformance[${index}].check`, issues);
    if (claim.status === 'verified' && claim.check?.enforcement === 'none') issue(issues, `conformance[${index}]`, 'verified claims cannot use an unenforced check');
    if (claim.status === 'unenforced' && (claim.check?.enforcement !== 'none' || !claim.note)) issue(issues, `conformance[${index}]`, 'unenforced claims need enforcement:none and an explanatory note');
  }
  return issues;
}

export function verifyPins(manifest, packagePath, lockfilePath) {
  const issues = [];
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const lock = JSON.parse(fs.readFileSync(lockfilePath, 'utf8'));
  const declared = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

  for (const pin of manifest.runtime.packages || []) {
    if (declared[pin.name] !== pin.version) {
      issue(issues, `package.json:${pin.name}`, `expected ${pin.version}, found ${declared[pin.name] || 'missing'}`);
    }
    const locked = lock.packages?.[`node_modules/${pin.name}`]?.version;
    if (locked !== pin.version) issue(issues, `package-lock.json:${pin.name}`, `expected ${pin.version}, found ${locked || 'missing'}`);
  }
  return issues;
}

/**
 * Resolves the fixtures a manifest explicitly names.  Fixture paths are data, not commands:
 * they must remain inside the shared fixture directory and identify a real golden case.
 */
export function resolveFixtureCases(manifest, repositoryRoot = process.cwd()) {
  const issues = [];
  const cases = [];
  const fixtureRoot = path.resolve(repositoryRoot, 'bakeoff/evals/fixtures');
  const refs = manifest.evaluation?.output_eval?.fixture_refs || [];

  for (const ref of refs) {
    if (!ref.startsWith('bakeoff/evals/fixtures/')) {
      issue(issues, 'evaluation.output_eval.fixture_refs', `must name a repository fixture, found ${JSON.stringify(ref)}`);
      continue;
    }
    const fixturePath = path.resolve(repositoryRoot, ref);
    if (!fixturePath.startsWith(`${fixtureRoot}${path.sep}`) || path.extname(fixturePath) !== '.json') {
      issue(issues, 'evaluation.output_eval.fixture_refs', `must resolve to a JSON file inside bakeoff/evals/fixtures, found ${JSON.stringify(ref)}`);
      continue;
    }
    try {
      const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
      if (!fixture.case || typeof fixture.case !== 'string') {
        issue(issues, 'evaluation.output_eval.fixture_refs', `${JSON.stringify(ref)} has no fixture case name`);
      } else {
        cases.push(fixture.case);
      }
    } catch (error) {
      issue(issues, 'evaluation.output_eval.fixture_refs', `${JSON.stringify(ref)} cannot be read: ${error.message}`);
    }
  }
  return { cases: [...new Set(cases)], issues };
}

export function loadManifest(manifestPath) {
  return JSON.parse(fs.readFileSync(path.resolve(manifestPath), 'utf8'));
}
