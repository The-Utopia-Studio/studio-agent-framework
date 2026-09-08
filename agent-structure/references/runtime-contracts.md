# Runtime responsibilities for generated agents

## Storage

Mastra delegates persistence to the selected adapter. LibSQLStore writes SQL; ConvexStore writes
supported memory/workflow records into Convex through the deployed storage handler. Installing
both packages does not synchronize two databases. The bake-off uses a separate SQLite event log
and can select LibSQL vendor state; it is a test configuration, not the production template.
In production, configure Convex explicitly for the agent's supported storage domains, and fail
when required configuration is missing. Keep domain events distinct from mutable workflow snapshots.
Do not claim that a native snapshot alone reconstructs arbitrary domain operations from an event log.

## Memory

No memory is valid when the job does not need it. When selected, record scope (tenant/resource),
source IDs, authority, timestamps, supersession, retention and deletion policy, retrieval token
budget, and write ownership. Human-confirmed facts outrank model inferences. Retrieved text is
untrusted data, not permission to change instructions or call tools.

The scaffold provides bounded vendor-API writes and exact read-back verification. It does not
provide tenant authorization or distributed concurrency control. The generated runtime must
resolve tenant/resource from authenticated context, filter every read, and use a single durable
writer or version-checked transaction per resource. Reject conflicting writes; do not silently
lose one update. Memory change generation must retain source IDs and validate structured deltas.

Tests must cover stale and conflicting facts, injected instructions in retrieved content,
cross-tenant denial, identical-content valid writes, wrong read-back, and a concurrent update.
For deterministic writes verify the write result/read-back; for model-tool writes verify that
the tool was offered and called. In both paths test useful recall independently of other channels.
A timestamp or nonempty memory is not a semantic-quality test.

## External effects

Persist action intent and payload hash before dispatch. Bind approval to tenant, approving principal, authorized execution principal,
action ID, payload hash and authorization scope; invalidate it if the payload changes. Use the
same provider idempotency key across retries where supported. Persist provider receipt before
marking completion. With no provider deduplication, reconcile an unknown outcome before retrying;
do not promise exactly-once semantics. Serialize concurrent resume attempts with an atomic claim
or lease. Check-first alone is insufficient after remote acceptance but before local recording.

Required tests for consequential writes: denied approval, changed payload, wrong tenant/principal,
simultaneous resume, crash before send, and crash after provider acceptance before local receipt.
A mock that supports idempotency does not prove a real provider supports it. Record provider
semantics and unresolved outcomes; keep release incomplete until the actual integration is proven.

Approval trace fields: `principal` is the human approver; `authorized_principal` must match the effect
`principal`. Both events share `scope`, `tenant_id`, `action_id`, and `payload_hash`.
