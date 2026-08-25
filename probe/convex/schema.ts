import { defineSchema } from 'convex/server';
import { defineTable } from 'convex/server';
import { v } from 'convex/values';
import {
  mastraThreadsTable,
  mastraMessagesTable,
  mastraResourcesTable,
  mastraWorkflowSnapshotsTable,
  mastraScoresTable,
  mastraSchedulesTable,
  mastraScheduleTriggersTable,
  mastraChannelInstallationsTable,
  mastraChannelConfigTable,
  mastraBackgroundTasksTable,
  mastraObservationalMemoryTable,
  mastraVectorIndexesTable,
  mastraVectorsTable,
  mastraCacheTable,
  mastraCacheListItemsTable,
  mastraDocumentsTable,
} from '@mastra/convex/schema';

/**
 * Two families of tables, deliberately.
 *
 * `mastra_*`  — Mastra's storage contract. Canonical for RESUME.
 *               Vendor-shaped, but in OUR deployment and queryable from the
 *               Convex dashboard, so MEM-8 holds. This is what STATE-1's
 *               kill-test reads from.
 *
 * `agentRuns` / `agentEvents` — ours. Canonical for AUDIT, EVALS and the
 *               trace archive. Append-only, never mutated (LOOP-6, MEM-3).
 *               A workflow SNAPSHOT tells you where a run ended up; it does
 *               not tell you why. LOOP-2 wants an event per iteration.
 *
 * These are not two sources of truth for the same fact. One answers
 * "where was I", the other answers "what happened".
 */
export default defineSchema({
  // ---- Mastra storage contract ----
  mastra_threads: mastraThreadsTable,
  mastra_messages: mastraMessagesTable,
  mastra_resources: mastraResourcesTable,
  mastra_workflow_snapshots: mastraWorkflowSnapshotsTable,
  mastra_scorers: mastraScoresTable,
  mastra_schedules: mastraSchedulesTable,
  mastra_schedule_triggers: mastraScheduleTriggersTable,
  mastra_channel_installations: mastraChannelInstallationsTable,
  mastra_channel_config: mastraChannelConfigTable,
  mastra_background_tasks: mastraBackgroundTasksTable,
  mastra_observational_memory: mastraObservationalMemoryTable,
  mastra_vector_indexes: mastraVectorIndexesTable,
  mastra_vectors: mastraVectorsTable,
  mastra_cache: mastraCacheTable,
  mastra_cache_list_items: mastraCacheListItemsTable,
  mastra_documents: mastraDocumentsTable,

  // ---- Studio-owned run log (audit decision 13) ----
  agentRuns: defineTable({
    runId: v.string(),
    tenantId: v.string(),          // MEM-7: tenant-keyed, indexed, never a freeform name
    manifestRef: v.string(),       // -> AgentManifest id@version
    kind: v.union(v.literal('builder'), v.literal('runtime')),
    status: v.union(
      v.literal('queued'),
      v.literal('running'),
      v.literal('awaiting_human'),
      v.literal('succeeded'),
      v.literal('failed'),
      v.literal('cancelled'),
    ),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
  })
    .index('by_run', ['runId'])
    .index('by_tenant', ['tenantId'])
    .index('by_tenant_status', ['tenantId', 'status']),

  agentEvents: defineTable({
    runId: v.string(),
    tenantId: v.string(),
    seq: v.number(),               // monotonic per run
    type: v.string(),              // run.started | step.completed | human.requested | ...
    payload: v.any(),
    createdAt: v.number(),
  })
    .index('by_run_seq', ['runId', 'seq'])
    .index('by_tenant', ['tenantId']),
});
