'use strict';

// A deliberately small, deterministic BEHAVIOR.md compiler. It grades a recorded trajectory;
// it is never given to the generator at runtime. More subjective clauses belong in a separate,
// calibrated judge after these free checks pass.

function check(key, ok, message, actual = null) {
  return { key, ok, message: ok ? '' : message, actual };
}

/**
 * Grade the portable predicates required for a long-horizon cycle.
 * @param {object[]} events raw canonical-log rows, ordered by step_index
 * @param {{requirePreflight?: boolean, requireDurations?: boolean}} policy
 */
function gradeBehavior(events, policy = {}) {
  const rows = Array.isArray(events) ? events : [];
  const operational = rows.filter((row) => row.step_name !== 'terminal');
  const results = [];

  results.push(check(
    'B0-trajectory-exists', rows.length > 0,
    'Behaviour cannot be graded: this cycle emitted no canonical events.', rows.length,
  ));

  if (policy.requireDurations) {
    const missing = operational.filter((row) => !Number.isInteger(row.duration_ms) || row.duration_ms < 0);
    results.push(check(
      'B1-duration-recorded', missing.length === 0,
      `Behaviour cannot grade latency: ${missing.length} operational event(s) lack duration_ms.`,
      missing.map((row) => row.step_name),
    ));
  }

  const invalidBlocks = rows.filter((row) => row.blocked && !row.blocked_by);
  results.push(check(
    'B2-blocks-explained', invalidBlocks.length === 0,
    'A blocked action must name blocked_by; otherwise a prevented action is indistinguishable from a fault.',
    invalidBlocks.map((row) => row.step_name),
  ));

  if (policy.requirePreflight) {
    const preflight = rows.find((row) => row.step_name === 'precondition_checked');
    results.push(check(
      'B3-preflight-recorded', !!preflight,
      'A background cycle must record precondition_checked before work begins.',
      preflight ? preflight.step_index : null,
    ));
  }

  return { pass: results.every((result) => result.ok), results };
}

module.exports = { gradeBehavior };
