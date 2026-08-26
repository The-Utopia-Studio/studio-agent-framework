-- WO-2 · canonical event-log schema. PRD §5.
-- FIXED AND IDENTICAL ACROSS ALL THREE LEGS (Mastra / Claude Agent SDK / Deep Agents).
-- Do not fork per-SDK. Do not reshape to fit a harness's native model — the friction of
-- mapping a harness's native state into this schema is itself a recorded finding (WO-9).
--
-- This schema is the SOLE source of truth for run state. Mastra's own LibSQL tables may
-- exist alongside it and are never authoritative; the probes never query them.
-- MEM-8: readable from outside the tool that wrote it — plain `sqlite3`, no framework API.

CREATE TABLE IF NOT EXISTS events (
  -- surrogate key; append order is the audit trail
  event_id        INTEGER PRIMARY KEY AUTOINCREMENT,

  -- ---- the 11 columns fixed by WO-2 ----
  run_id          TEXT    NOT NULL,
  step_index      INTEGER NOT NULL,
  step_name       TEXT    NOT NULL,
  timestamp       TEXT    NOT NULL,
  tool_selected   TEXT,
  tool_args       TEXT,             -- canonical JSON; byte-compared at approval (PRD §9)
  approver        TEXT,
  decision        TEXT,             -- approved | declined | NULL
  slack_response  TEXT,             -- canonical JSON of the Slack send result
  outcome         TEXT,             -- set only on the terminal event
  git_sha         TEXT    NOT NULL,

  -- ---- documented extensions, identical across all three legs ----
  -- MEM-7: every memory table keys off the tenant id, indexed, never a freeform name.
  -- WO-8 requires events scoped to resource=utopia-studio, thread=digest-test.
  resource        TEXT    NOT NULL DEFAULT 'utopia-studio',
  thread          TEXT    NOT NULL DEFAULT 'digest-test',
  -- CTX-3: typed contract, no silent defaults. Cases 8/9/10b each require a failure
  -- distinguishable from the others and from `declined`; packing two facts into
  -- `outcome` would be exactly the silent default CTX-3 forbids.
  failure_stage   TEXT,             -- fetch | validation | post | NULL
  error_message   TEXT,
  -- SCHEMA-MAPPING FRICTION (Open Question 1 predicted this; WO-9 records it).
  -- Mastra mints its own runId for a suspended run and `approveToolCall({runId})` is the
  -- only way to resume one. To resume in a FRESH process after a crash we must persist that
  -- harness-native identifier -- our schema had nowhere to put it. This column is the seam
  -- between the harness's state model and ours. It is identical across all three legs;
  -- legs 2 and 3 populate it with whatever their own native run identity is, or leave NULL.
  harness_run_id  TEXT,

  CHECK (decision IS NULL OR decision IN ('approved','declined')),
  CHECK (outcome  IS NULL OR outcome  IN ('posted','declined','nothing-to-digest','budget-exhausted','failed')),
  CHECK (failure_stage IS NULL OR failure_stage IN ('fetch','validation','post'))
);

-- One row per (run, step). Makes a re-append of the same step a loud failure, not a silent
-- duplicate — the write-side half of LOOP-6 idempotency.
CREATE UNIQUE INDEX IF NOT EXISTS events_run_step ON events (run_id, step_index);
CREATE INDEX IF NOT EXISTS events_run     ON events (run_id);
CREATE INDEX IF NOT EXISTS events_tenant  ON events (resource, thread);   -- MEM-7: indexed
CREATE INDEX IF NOT EXISTS events_outcome ON events (outcome) WHERE outcome IS NOT NULL;

-- MEM-3 / LOOP-6: append-only, enforced by the database rather than by convention.
-- A resume appends new events; it never rewrites a prior one.
CREATE TRIGGER IF NOT EXISTS events_no_update
BEFORE UPDATE ON events
BEGIN
  SELECT RAISE(ABORT, 'events is append-only: UPDATE is forbidden (MEM-3, LOOP-6)');
END;

CREATE TRIGGER IF NOT EXISTS events_no_delete
BEFORE DELETE ON events
BEGIN
  SELECT RAISE(ABORT, 'events is append-only: DELETE is forbidden (MEM-3, LOOP-6)');
END;
