---
name: studio-agent-framework
description: Build agents through the Utopia Studio pipeline. Use when someone asks to build, plan, scope, or ship an agent. First classify the audience/data profile and runtime home, then carry one intake through workflow design, agent design, eval-first specification, and an agent PRD. Use the supporting instructions in this bundle; do not treat this as permission to access any data or tools.
---

# Studio Agent Framework

This is one bundled Claude skill. The stage instructions live in the folders beside this file.

## Required sequence

1. Read `learnings/INSTRUCTIONS.md` first and cite its rule IDs when blocking or waiving a design.
2. Read `agent-builder/INSTRUCTIONS.md` and run its intake. Record both the audience/data profile (internal team, fellow-scoped, public, or privileged admin) and runtime home (Utopia OS, standalone, or local/managed). These are separate decisions.
3. Follow the stage sequence the Builder specifies: `workflow-design/INSTRUCTIONS.md`, `agent-design/INSTRUCTIONS.md`, `eval-first-spec/INSTRUCTIONS.md`, then `agent-prd/INSTRUCTIONS.md`.
4. Read `agent-structure/INSTRUCTIONS.md` and persist the shared build-state.json carrier. For coded agents, the PRD must emit a validated agent-manifest.json.
5. For a coded agent, use `mastra-harness/INSTRUCTIONS.md` after the PRD and work orders exist.

## Security baseline

Every design names its principal, allowed data, tool allowlist, audit path, refusal tests, and approval requirements. Fellow-scoped work requires cross-fellow isolation proof. Internal-team work must not claim fellow-private access. The bundle gives instructions only; it does not grant access to data, connectors, or credentials.
