# Journey results

The framework test runs both example repositories through structure validation, every persisted
carrier stage, actual-agent fixture conformance, and completion validation. It repeats each
conformance run to check deterministic output, probes fresh and already-active context for the
stateless agent, and simulates a process restart plus tenant scope change for the memory agent.

This is local deterministic evidence. It does not certify model quality, human scoring, Convex
production recovery, or provider-specific side-effect semantics; those remain release checks for
the generated agent that uses a live integration.
