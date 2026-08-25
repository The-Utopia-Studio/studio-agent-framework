'use strict';
// WO-3 · the M0 stub. Implements the harness contract and nothing else, so the suite
// "fails honestly": every case reports FAIL with a legible mismatch, zero ERRORs.
// EVAL-4: this is the pre-scaffolding baseline the real harness must beat.
module.exports = {
  name: 'stub (M0 — no harness wired)',
  async run(_fixture, _ctx) {
    return { stub: true };   // well-formed, deliberately empty of every graded field
  },
};
