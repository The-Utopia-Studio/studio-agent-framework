> Apply the current [pipeline contract](../../agent-structure/references/pipeline.md) first. It defines the proportional evidence profile and manifest handoff; historical examples below do not override it.

## How to run the interview

This is the part that determines whether the PRD is any good.

### Pacing

- Work through the gates **in order**. Each one depends on the last.
- Ask **3–5 questions at a time.** Never dump a whole gate's worth of questions at once, and never ask forty questions in one message.
- After each gate, give a **two-line summary of what you recorded** and confirm before moving on.
- Expect 20–40 minutes. Say so up front. If the user wants a fast pass, run Gates 1, 1B, 2, 4 and 5 only, and mark the rest as Open Questions in the PRD — but tell them what they are deferring.

### Interrogation standards

**Reject vague answers.** Do not accept them politely and move on. Name the problem
and offer two or three concrete alternatives to choose between. An agent with a vague
input hallucinates; an agent with a vague output is unverifiable.

Answers to push back on, every time:

| They say | The problem | What to do |
|---|---|---|
| "Various context" / "the relevant data" | Undefined input | Ask for the exact object or file, with a field list |
| "A good website" / "a useful summary" | Unverifiable output | Ask what a reviewer would check, then turn each check into a criterion |
| "It should keep trying until it works" | No exit condition | Ask what happens on attempt four, and who gets told |
| "It'll remember the context" | Undefined memory | Walk them through the four memory tiers in Appendix B |
| "We'll know it's good when we see it" | No eval | Ask for the last three things they rejected and why — those are the first eval tasks |
| "Just use the best model" | No baseline | Fine, but record which one and that it is the baseline to beat |

**Infer before you ask.** If you have repo access, read first: existing schema, prior
agent files, `AGENTS.md` or `CLAUDE.md`, package manifests, environment variable
names. Then ask the user to confirm or correct what you found. Do not make them type
what you could have read.

**"I don't know" is a legitimate answer** and it is the most useful signal in the
interview. It means that item is design work, not documentation. Record it in Open
Questions with an owner and a date. Never invent an answer to keep the flow moving,
and never quietly drop the question.

**Keep a running draft.** After each gate, hold the accumulated answers so a
long session can be resumed. If the user comes back later, restate what is captured
and resume at the next gate.

### The strategy-doc failure mode — read this before starting

The most likely way this interview fails is not that it stalls. It is that it goes
brilliantly through Gates 0–2, produces genuinely exciting strategy, and then quietly
skips Gates 3, 5, 8 and 9 because those are boring and the document already *feels*
finished. The result is a beautiful positioning document with no loop, no exit
conditions, no event schema, no tools inventory and no validator — which cannot be
built from.

Discovery gates (0, 1, 2, 4, 7) are the enjoyable half. Engineering gates
(3, 5, 6, 8, 9) are the half that determines whether the thing ships.

So:

- **After Gate 2, announce the transition explicitly.** Say that the strategy half is
  done and the engineering half is starting, and that it is shorter but less fun. Naming
  it prevents drifting past it.
- **Never offer to write the PRD before Gate 9**, even if the user says there is enough
  to go on. If they insist, write it with the unmet engineering gates listed at the top
  of Open Questions as blocking, and say plainly that it is not yet buildable.
- **Do not let strategy depth substitute for engineering depth.** A twelve-criterion
  evaluation rubric with no thresholds is not an evaluation design. A beautiful
  architecture diagram is not an event schema. Weights without bars, and boxes without
  save points, are the two most common versions of this.
- **If the user is visibly enjoying the strategy phase, say so and hold the line
  anyway.** "This is the strongest part of the doc — and it is the part that will get
  rebuilt if we don't pin down what closes the loop."

**Do not write implementation code during the interview.** Pseudocode for a schema or
an exit condition is fine when it clarifies a question. A working function is not.

---

