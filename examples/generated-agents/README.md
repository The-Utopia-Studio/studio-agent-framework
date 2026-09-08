# Generated-agent journey examples

These two small repositories are deliberately deterministic examples used by the framework's
end-to-end tests. They exercise the same handoff a generated agent uses: persisted carrier →
manifest → implementation → actual-agent adapter → fixture evidence.

* `briefing-agent` is a simple, stateless agent. It has no workflow and no persistent memory.
* `memory-workflow-agent` has a durable working-memory store and a resumable two-step workflow.

The examples use local adapters and synthetic fixtures. They prove that the framework connects
the stages and catches scope/context regressions; they are not claims about model quality or a
live provider's durability.
