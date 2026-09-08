---
name: agent-structure
description: Define and check the repository layout for a Utopia Studio skill, managed agent, or coded agent. Use during agent planning and scaffolding, or when reviewing generated agent organization. Select the smallest profile and preserve an existing repository's conventions.
---

# Agent structure

Choose a structure from [repository profiles](references/repository-profiles.md), based on the
implementation rung already recorded by agent-builder. This is a Studio convention for runtime
projects; the skill profile follows the Agent Skills format. It is not an international
certification, and the framework repository need not look like a generated agent repository.

1. Read the carrier, confirmed job, identity, tools, and workflow/memory decisions.
2. Choose `skill`, `managed`, or `coded`. Do not create optional folders without actual contents.
3. Record the profile and intended artifact paths in `build-state.json` using
   [the pipeline contract](references/pipeline.md).
4. For skills: create lowercase `<skill-name>/SKILL.md` with a clear description under 1024
   characters. Put executable helpers in scripts, conditional reading in references, and copied
   output resources in assets. Keep the entry instructions focused and under 500 lines.
5. For coded agents: separate entrypoints, model decisions, deterministic tools, runtime storage,
   memory policy, and tests. Skills used by the runtime remain independent skill folders.
6. Check a generated repository with `node harness/structure.js --root=<repo> --profile=<profile>`
   from the framework checkout. A passing structure check verifies placement, not agent behavior.
7. Implement real operations before marking work complete. An unconfigured scaffold or mock-only
   test result is never evidence that an agent is ready for production.

For tool effects or persistent memory, read [runtime contracts](references/runtime-contracts.md).
The pipeline contract governs stage order and evidence proportionality; the runtime contracts
govern enforcement responsibilities. These shared contracts take precedence over historical examples.
