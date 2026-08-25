'use strict';
// WO-1 · portable tool function. PRD §8, §1 input contract.
// ZERO harness imports by design: legs 2 (Claude Agent SDK) and 3 (Deep Agents)
// reuse this file verbatim. Do not import '@mastra/*' here.

const { LinearFetchError, IssueValidationError } = require('./errors.js');

const MAX_ISSUES = 5;                       // PRD §6 authority table: hard-coded 5
const CLOSED_STATE_TYPES = new Set(['completed', 'canceled']);
const UNASSIGNED = 'unassigned';            // PRD §6 / case 10a: deterministic, never a guess

const QUERY = `query IssuesForProject($projectId: String!) {
  project(id: $projectId) {
    id
    name
    issues(first: 250) {
      nodes {
        id
        identifier
        title
        updatedAt
        state { name type }
        assignee { name }
      }
    }
  }
}`;

/**
 * Reads open issues from one Linear project.
 *
 * Returns an Array (max 5) of { id, title, status, assignee, updatedAt } — and only
 * those five fields, per PRD §1. Truncation metadata is attached as properties on the
 * returned array so the value stays Array.isArray()-true for WO-1's acceptance test
 * while still letting the caller report truncation explicitly (case 7 forbids silence).
 *
 * @param {string} projectId
 * @param {object} [opts]
 * @param {string} [opts.apiKey]     defaults to process.env.LINEAR_API_KEY
 * @param {function} [opts.fetchImpl] injectable for mock fixtures
 * @param {number} [opts.maxIssues]  defaults to 5
 * @returns {Promise<Array & {truncated:boolean,totalOpenCount:number,projectId:string}>}
 */
async function fetch_linear_issues(projectId, opts = {}) {
  if (!projectId || typeof projectId !== 'string') {
    throw new LinearFetchError('fetch_linear_issues requires a non-empty project id');
  }

  const apiKey = opts.apiKey || process.env.LINEAR_API_KEY;
  const doFetch = opts.fetchImpl || globalThis.fetch;
  const maxIssues = Number.isInteger(opts.maxIssues) ? opts.maxIssues : MAX_ISSUES;

  if (!apiKey) {
    // PRD §8 credential failure behaviour: clean failure, never a silent exit.
    throw new LinearFetchError('LINEAR_API_KEY is not set', { credential: 'LINEAR_API_KEY' });
  }

  let res;
  try {
    res = await doFetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: apiKey },
      body: JSON.stringify({ query: QUERY, variables: { projectId } }),
    });
  } catch (err) {
    throw new LinearFetchError(`Linear request failed: ${err.message}`, { cause: String(err) });
  }

  if (!res.ok) {
    throw new LinearFetchError(`Linear API returned ${res.status}`, { status: res.status });
  }

  let payload;
  try {
    payload = await res.json();
  } catch (err) {
    throw new LinearFetchError(`Linear response was not JSON: ${err.message}`);
  }

  if (payload && Array.isArray(payload.errors) && payload.errors.length) {
    throw new LinearFetchError(
      `Linear GraphQL error: ${payload.errors.map((e) => e.message).join('; ')}`,
      { graphqlErrors: payload.errors }
    );
  }

  const project = payload && payload.data && payload.data.project;
  if (!project) {
    throw new LinearFetchError(`Linear project not found: ${projectId}`, { projectId });
  }

  const nodes = (project.issues && project.issues.nodes) || [];

  // "Open" == state type is neither completed nor canceled.
  const open = nodes.filter((n) => !CLOSED_STATE_TYPES.has(n && n.state && n.state.type));

  // Deterministic order so persisted tool args are byte-stable across a resume
  // (PRD §9 args-match validator; LOOP-6).
  open.sort((a, b) => {
    const t = String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
    return t !== 0 ? t : String(a.identifier || a.id || '').localeCompare(String(b.identifier || b.id || ''));
  });

  const totalOpenCount = open.length;
  const kept = open.slice(0, maxIssues);

  const issues = kept.map((n, i) => {
    // Pre-run field validation, PRD §6: id/title/status must be non-empty.
    // assignee absence is tolerated; title absence fails the run (case 10b).
    const id = n && (n.identifier || n.id);
    const title = n && n.title;
    const status = n && n.state && n.state.name;

    if (!id || String(id).trim() === '') throw new IssueValidationError('id', i);
    if (!title || String(title).trim() === '') throw new IssueValidationError('title', i);
    if (!status || String(status).trim() === '') throw new IssueValidationError('status', i);

    return {
      id: String(id),
      title: String(title),
      status: String(status),
      // Normalised here, not at render time, so the model can never invent a name
      // (PRD §9 hallucination watch item 1; case 10a is deterministic as a result).
      assignee: n.assignee && n.assignee.name && String(n.assignee.name).trim() !== ''
        ? String(n.assignee.name)
        : UNASSIGNED,
      updatedAt: String(n.updatedAt || ''),
    };
  });

  const result = issues;
  Object.defineProperty(result, 'truncated', { value: totalOpenCount > maxIssues, enumerable: false });
  Object.defineProperty(result, 'totalOpenCount', { value: totalOpenCount, enumerable: false });
  Object.defineProperty(result, 'projectId', { value: projectId, enumerable: false });
  Object.defineProperty(result, 'projectName', { value: project.name || null, enumerable: false });
  return result;
}

module.exports = fetch_linear_issues;
module.exports.fetch_linear_issues = fetch_linear_issues;
module.exports.MAX_ISSUES = MAX_ISSUES;
module.exports.UNASSIGNED = UNASSIGNED;
