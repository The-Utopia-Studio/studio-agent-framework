'use strict';
// Fixture-driven mock fetch implementations, shared by the runner and the crash child so a
// resumed run sees byte-identical mock behaviour to the process that died.

function makeLinearFetch(spec) {
  return async () => {
    if (spec.mode === 'network') throw new Error('ETIMEDOUT (mock Linear network failure)');
    if (spec.mode === 'http_error') {
      return { ok: false, status: spec.status, text: async () => spec.body || '', json: async () => ({}) };
    }
    if (spec.mode === 'graphql_error') {
      return { ok: true, status: 200, json: async () => ({ errors: [{ message: spec.message || 'boom' }] }) };
    }
    return {
      ok: true, status: 200,
      json: async () => ({ data: { project: { id: 'fixture-project', name: 'Fixture Project',
        issues: { nodes: spec.nodes || [] } } } }),
    };
  };
}

function makeSlackFetch(spec, counter = { attempts: 0 }) {
  return async () => {
    counter.attempts++;
    if (spec.mode === 'network') throw new Error('ECONNRESET (mock Slack network failure)');
    if (spec.mode === 'http_error') return { status: spec.status, text: async () => spec.body || '' };
    return { status: spec.status || 200, text: async () => spec.body || 'ok' };
  };
}

module.exports = { makeLinearFetch, makeSlackFetch };
