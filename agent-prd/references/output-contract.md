## Output contract

This skill produces **two** documents, in order:

1. `<agent-slug>-PRD.md` — what the agent is and how it will be judged. Always.
2. `<agent-slug>-WORKORDERS.md` — how it gets built, as sequenced tasks with
   acceptance tests. Only after the PRD clears its hard gates.

Never produce work orders from an incomplete PRD. Tasks built on undefined success
criteria are the exact failure this skill exists to prevent — they look like progress
and cannot be verified. If the hard gates are unmet, say which ones and offer to
finish them instead.

Detect the environment and deliver accordingly. Work down this list and use the first
case that applies.

**1. You can run code and create documents** (Claude with file creation, Claude Code
with a sandbox): produce a real document as the primary deliverable, plus the `.md`
alongside it. The document must contain the rendered diagrams and the agent checklist
as real tables, not code fences. This is the deliverable non-engineers actually read,
so it is the default whenever the environment supports it. Do not ask whether they want
a document; produce one and mention the `.md` exists too.

**Which format:**

- **`.docx` is the default.** A PRD gets commented on, edited, and added to — open
  questions get answered, owners get assigned. A format nobody can edit fights that.
- **`.pdf` when it is being circulated as a record** rather than worked on: sending to
  someone outside the team, attaching to a Linear project, or filing an approved version.
- **If they want both, build the `.docx` and convert it.** Do not generate the PDF
  separately — two independent builds drift, and the converted file is guaranteed to
  match. Convert with the LibreOffice helper script referenced in the `docx` skill.
- If they explicitly ask for PDF only and there is no docx step, read the `pdf` skill.

**Read the relevant skill before writing any code** — `docx` for Word output, `pdf` for
PDF-first output. Both encode environment constraints that are not worth rediscovering.

**2. You can write files but not render documents** (Cursor, Codex CLI, most agentic
IDEs): write `docs/agents/<agent-slug>-PRD.md`. Create the directory if needed. Tell
the user the path. Do not also paste the whole document into chat. Diagrams go in as
Mermaid fenced blocks, which render in most IDE previews.

**3. You cannot write files** (mobile, plain API): output the complete document in one
fenced markdown block so it can be copied in a single action. Do not split it across
messages. Do not summarise it and offer to expand. Diagrams as Mermaid blocks.

**Every case:** the document must be complete and standalone. Someone who was not in
the interview should be able to build from it. No "TBD" without an owner and a date
in the Open Questions section.

**Filename slug:** lowercase, hyphenated, from the agent's job — `website-generator`,
`design-critic`, `icp-simulator`. Not `agent`, not `new-agent`.

---

