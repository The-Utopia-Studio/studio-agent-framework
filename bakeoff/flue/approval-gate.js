// Leg 4 · THE APPROVAL SCAFFOLD.
//
// Flue has NO approval primitive: defineTool's contract is
// {name, description, input?, output?, harness?, durable?, run} -- no gating flag, and no
// HITL/approval/interrupt page exists in its 95 doc pages. Flue's own answer is
// "conditional tools" (gate a tool's PRESENCE on usePersistentState), which approves a
// CAPABILITY, not this call with these arguments -- the wrong side of the line LOOP-5 draws
// ("check whether the pause can happen between tool selection and tool invocation").
//
// This is the thinnest scaffold that reaches the required granularity, built from two
// documented primitives that were not designed for it:
//   * observe()     -- the `tool_start` event carries {toolCallId, toolName, args}
//   * interceptor() -- wraps tool execution; awaiting defers invocation, and NOT calling
//                      next() skips the work entirely, the interceptor's return value
//                      becoming the operation's result
// Verified ordering: turn(toolCall) -> tool_start(args) -> INTERCEPT -> run.
import { instrument } from '@flue/runtime';

/**
 * @param {object} o
 * @param {string} o.gatedTool           tool name to gate
 * @param {function} o.onSelected        async (args, toolCallId) => void  -- SAVE POINT, runs before the pause
 * @param {function} o.decide            async (args, toolCallId) => 'approved' | 'declined'
 * @param {function} [o.onDecision]      async (decision, args, toolCallId) => void
 * @param {function} [o.declinedResult]  (args) => tool output returned when declined
 */
export function installApprovalGate(o) {
  const argsByCallId = new Map();
  const seen = new Set();
  const state = { pauses: 0, decisions: [], argsSeen: null, interceptedBeforeRun: false };

  const dispose = instrument({
    key: Symbol('linear-digest-approval-gate'),
    observe: (obs) => {
      if (obs && obs.type === 'tool_start' && obs.toolCallId) {
        argsByCallId.set(obs.toolCallId, obs.args);
      }
    },
    interceptor: async (op, ctx, next) => {
      if (op.type !== 'tool' || op.toolName !== o.gatedTool) return next();

      const args = argsByCallId.get(op.toolCallId);
      state.argsSeen = args;
      state.interceptedBeforeRun = true;
      // ctx carries the harness-native identifiers; submissionId is what a fresh process
      // needs to re-attach to this run (Flue's handle.read is re-attachable by design).
      if (ctx && ctx.submissionId) state.submissionId = ctx.submissionId;
      if (ctx && ctx.conversationId) state.conversationId = ctx.conversationId;

      // Idempotent save point: the gate is re-entered on a durable re-execution after a
      // crash, and a resume must not append a second selection event (PRD §9 / V3).
      if (!seen.has(op.toolCallId)) {
        seen.add(op.toolCallId);
        await o.onSelected(args, op.toolCallId, ctx);
      }

      state.pauses++;
      const decision = await o.decide(args, op.toolCallId);
      state.decisions.push(decision);
      if (o.onDecision) await o.onDecision(decision, args, op.toolCallId);

      if (decision === 'declined') {
        // Not calling next() skips the wrapped work AND the rest of the chain.
        const dr = o.declinedResult ? o.declinedResult(args) : { output: { ok: false, declined: true } };
        // End the turn on decline too, so a declined run does not incur a concluding
        // model call (matches the approved path's `terminate: true`).
        return { ...dr, terminate: true };
      }
      return next();
    },
    dispose: () => {},
  });

  return { state, dispose };
}
