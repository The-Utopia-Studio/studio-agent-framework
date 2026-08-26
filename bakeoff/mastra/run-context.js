// Per-process run context.
//
// WORKAROUND (recorded in FINDINGS.md), with an accurate note on the alternative:
// Mastra's createTool `execute(input, execOpts)` DOES expose a per-run channel -- the
// observed execOpts keys are:
//   mastra, memory, runId, requestContext, actor, workspace, browser, observe, writer,
//   tracing, loggerVNext, metrics
// so `requestContext` and `runId` are available. We use a module-scoped context anyway
// because (a) the runner executes exactly one run per process, and (b) requestContext is
// undocumented for @mastra/core@1.61.0 in the published docs, so relying on its shape
// would be an undocumented-API dependency. This is a CHOICE, not a missing primitive --
// the primitive exists. A multi-run-per-process deployment should use requestContext.
let ctx = null;
export function setRunContext(c) { ctx = c; }
export function getRunContext() {
  if (!ctx) throw new Error('run context not set: setRunContext() must run before agent.generate()');
  return ctx;
}
export function clearRunContext() { ctx = null; }
