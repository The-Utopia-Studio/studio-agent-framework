export function createAgent() {
  return {
    run(input, { context = {} } = {}) {
      const topic = String(input?.topic || '').trim();
      if (!topic)
        return {
          output: 'I need a topic.',
          context_used: false,
          events: [
            { step_index: 0, step_name: 'precondition_checked', duration_ms: 0, blocked: 0 },
            { step_index: 1, step_name: 'terminal', blocked: 0 },
          ],
        };
      const prior = typeof context.lastTopic === 'string' ? context.lastTopic : null;
      return {
        output: `Brief: ${topic}`,
        context_used: Boolean(prior),
        prior_topic: prior,
        events: [
          { step_index: 0, step_name: 'precondition_checked', duration_ms: 0, blocked: 0 },
          { step_index: 1, step_name: 'agent_decision', duration_ms: 0, blocked: 0 },
          { step_index: 2, step_name: 'terminal', blocked: 0 },
        ],
      };
    },
  };
}
