// Convex schema for the leg-1 re-test (studio-standard-agent-framework PR #1, finding 2).
//
// STATE-1a permits vendor state PROVIDED it lands in our own schema, queryable and
// tenant-keyed. These are Mastra's storage tables declared HERE, in a schema we own --
// which is the whole point of the re-test. `mastra_workflow_snapshots` is the one that
// matters most: a suspended approval run resumes from a workflow snapshot, so this is the
// table that decides whether Mastra-on-Convex satisfies STATE-1a natively.
//
// Cache tables are omitted deliberately: we use ConvexStore, not ConvexServerCache.
import { defineSchema } from 'convex/server';
import {
  mastraThreadsTable,
  mastraMessagesTable,
  mastraResourcesTable,
  mastraWorkflowSnapshotsTable,
  mastraScoresTable,
  mastraObservationalMemoryTable,
  mastraVectorIndexesTable,
  mastraVectorsTable,
  mastraDocumentsTable,
} from '@mastra/convex/schema';

export default defineSchema({
  mastra_threads: mastraThreadsTable,
  mastra_messages: mastraMessagesTable,
  mastra_resources: mastraResourcesTable,
  // NOTE: the package's own bundled reference doc names this table
  // "mastra_workflow_snapshots" (plural). The RUNTIME writes to
  // TABLE_WORKFLOW_SNAPSHOT = "mastra_workflow_snapshot" (singular) -- confirmed by
  // tracing real HTTP traffic during the leg-1 Convex re-test. Declared under the name
  // the runtime actually uses, so `npx convex data` can browse it; Convex does not
  // require schema declaration to accept writes to a table, which is why resume worked
  // even while this mismatch existed.
  mastra_workflow_snapshot: mastraWorkflowSnapshotsTable,
  mastra_scorers: mastraScoresTable,
  mastra_observational_memory: mastraObservationalMemoryTable,
  mastra_vector_indexes: mastraVectorIndexesTable,
  mastra_vectors: mastraVectorsTable,
  mastra_documents: mastraDocumentsTable,
});
