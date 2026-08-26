'use strict';
// Typed errors so the harness can discriminate failure_stage without string matching.
// CTX-3: every handoff is a typed contract with no silent defaults.

class LinearFetchError extends Error {
  constructor(message, meta = {}) {
    super(message);
    this.name = 'LinearFetchError';
    this.failure_stage = 'fetch';
    Object.assign(this, meta);
  }
}

class IssueValidationError extends Error {
  constructor(field, issueIndex, meta = {}) {
    // Message string is fixed by PRD §9 validator checklist.
    super(`Malformed issue in fetch response: missing ${field} - failing run per Gate 6 validation`);
    this.name = 'IssueValidationError';
    this.failure_stage = 'validation';
    this.field = field;
    this.issueIndex = issueIndex;
    Object.assign(this, meta);
  }
}

module.exports = { LinearFetchError, IssueValidationError };
