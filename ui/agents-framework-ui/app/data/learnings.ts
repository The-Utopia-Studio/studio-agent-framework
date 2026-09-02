// What the 41-hour harness run actually taught us.
//
// Every item carries a state, because the whole value of this page is that "proven" and
// "we think so" look different. `false` items are claims that were in circulation here and
// turned out to be wrong — they stay on the page rather than being quietly deleted, because a
// corrected claim keeps getting re-asserted otherwise.
export type LearningState = 'proven' | 'design' | 'open' | 'false';

export type Learning = {
  claim: string;
  detail: string;
  state: LearningState;
};

export const STATE_LABEL: Record<LearningState, string> = {
  proven: 'PROVEN',
  design: 'DESIGN',
  open: 'OPEN',
  false: 'CORRECTED',
};

export const LEARNING_GROUPS: {
  id: string;
  num: string;
  title: string;
  lede: string;
  items: Learning[];
}[] = [
  {
    id: 'harness',
    num: '01',
    title: 'THE HARNESS',
    lede:
      'Mastra + ConvexStore, re-tested on 1.63 and then run unattended for 41 hours across three sleep/wake boundaries — one of them with the laptop shut in a bag and no network.',
    items: [
      {
        claim: 'The STATE-1 kill-test still passes on 1.63.2',
        detail:
          'PASS 12 · FAIL 0 · BLOCKED 0 across 12 golden cases, live model, real Convex. Better than the 26 Aug baseline of 11 pass / 1 blocked, because Langfuse credentials now exist.',
        state: 'proven',
      },
      {
        claim: '41 hours unattended, 117 runs and cycles, 2 non-ok',
        detail:
          'Two agents on a schedule. Both non-ok events are explained. $0.19 of a $3 cap across 240,602 tokens.',
        state: 'proven',
      },
      {
        claim: 'Work is deferred, never dropped',
        detail:
          'Three sleep gaps of 3.8h, 10.8h and 10.9h. Each resume caught the backlog — 48, 37 and 50 stories. The last one fired at the moment of real wake, not on a later retry.',
        state: 'proven',
      },
      {
        claim: 'Nested workflows survive a hard kill',
        detail:
          'Parent → .branch() → nested workflow → suspend() inside it → kill -9 → a fresh process resumed from Convex with the runId as its only input. A nested workflow gets its own snapshot row, so sub-modules are independently resumable.',
        state: 'proven',
      },
      {
        claim: 'Pin @mastra/convex to 1.5.4',
        detail:
          '1.5.5 fails the kill-test. Bisected with everything else held constant. A caret range here is a live hazard.',
        state: 'proven',
      },
      {
        claim: 'A workflow is not always the answer',
        detail:
          'The reference agent ran 46 cycles over 41 hours with no workflow at all — just Agent.generate() on a trigger — because its cycles are independent. The question is whether losing work mid-flight costs anything.',
        state: 'proven',
      },
      {
        claim: 'A schedule was the test rig, not the recommendation',
        detail:
          'A recurring job is the harshest durability test available on a laptop. In production the OS dispatches — a fellow request via Agent Inventory, or a signal. Only what calls step 1 changes.',
        state: 'proven',
      },
      {
        claim: '"Durable agents are new in Mastra 1.62/1.63"',
        detail:
          'They are not. createInngestAgent shipped in 1.30.0 and untilIdle in 1.41.0 — both already in the 1.61.0 baseline the 26 Aug decision was made against. "Adopt them now they exist" was never the argument.',
        state: 'false',
      },
      {
        claim: '"sandbox.stop() suspends a run"',
        detail:
          'Not a Mastra API at all. No @mastra/sandbox on npm, no Sandbox type in core 1.63.2. It belongs to @studio/ai-runtime.',
        state: 'false',
      },
      {
        claim: 'The Convex workflow table is plural',
        detail:
          'It is singular — TABLE_WORKFLOW_SNAPSHOT = "mastra_workflow_snapshot". The package’s bundled reference doc says plural, which is an upstream doc bug; following it declares an empty table while the real one stays undeclared. We asserted the plural version in a standards doc before checking the constant.',
        state: 'false',
      },
    ],
  },
  {
    id: 'memory',
    num: '02',
    title: 'MEMORY',
    lede:
      'Memory works, and then quietly stops. This is the section that cost the most and generalises the furthest.',
    items: [
      {
        claim: 'Working memory persists across processes, and revises rather than appends',
        detail:
          'A separate OS process recalled what an earlier one wrote, with no application code carrying anything between them — verified by reading it back over raw HTTP with zero SDK. Over 24 cycles it went 666 → 1,735 chars, incrementing counts and merging under a synthesis line the agent wrote itself.',
        state: 'proven',
      },
      {
        claim: 'Semantic recall works, on Convex, with a local embedder',
        detail:
          '83 vectors, 384 dimensions, cosine. fastembed runs locally so embedding costs no API call. Mastra creates the index unprompted.',
        state: 'proven',
      },
      {
        claim: 'Nine cycles reported ok while memory was never written',
        detail:
          'Through a full night. Status ok ×9, the recall check passing on all nine, memory a plausible 1,742 chars, traces clean. The agent’s own replies said "Two themes touched. Updating memory." It had no tool with which to do that.',
        state: 'proven',
      },
      {
        claim: 'The recall channels compete, so memory maintenance decays',
        detail:
          'Reproduced A/B on one agent, same instructions, same model: with lastMessages 0 and semanticRecall off, updateWorkingMemory is offered AND called. With both on, it is offered and NOT called. Once semantic recall can answer "what have I covered?", the model has no need to persist anything — so the longer an agent runs, the less it maintains itself.',
        state: 'proven',
      },
      {
        claim: 'Never write mastra_resources.workingMemory directly',
        detail:
          'A raw out-of-band write left Mastra no longer OFFERING the update tool to the model at all. Clearing the field restored it. Raw reads for verification are essential; raw writes silently remove the agent’s ability to maintain its own memory.',
        state: 'proven',
      },
      {
        claim: 'The write is deterministic now — the model decides what, the code decides that',
        detail:
          'Fixed on the reference agent 2 Sep. The model emits the updated memory as ordinary output; the code writes it through the vendor API. Verified on a fresh resource: cycle 1 wrote +472 chars from nothing, cycles 2–3 correctly left it unchanged on an already-covered batch.',
        state: 'proven',
      },
      {
        claim: 'Mastra’s working memory is all-or-nothing',
        detail:
          'You cannot keep its context injection and own the write. With enabled:true it appends "IMPORTANT: You MUST call updateWorkingMemory in every response" to the system prompt AFTER your instructions — so the model gets contradictory orders and satisfies neither, saying "Updating memory." and moving on. Two rounds of strengthening our instruction changed nothing; the instruction was never the problem. The fix is two Memory instances: the agent’s with workingMemory false, plus a storage-only one never attached to an agent.',
        state: 'proven',
      },
      {
        claim: 'updatedAt advances on every write, even a byte-identical one',
        detail:
          'Which is what makes freshness the right signal rather than a variant of "memory must change": it measures whether the write path ran, not whether content happened to differ. Unchanged memory on already-covered input is correct.',
        state: 'proven',
      },
      {
        claim: 'Memory is the cost, and it grows',
        detail:
          'The memory-carrying agent cost 3.8× the memoryless one, and its per-call input grew +61% (1,043 → 1,678 avg) against +25%. Budget from the late figure — the first cycle understates the steady state by roughly 60%, and the curve had not plateaued.',
        state: 'proven',
      },
      {
        claim: 'Cross-run state is memory, not workflow snapshots',
        detail:
          'A snapshot resumes an interrupted run; it does not carry state across run boundaries. Reaching for snapshots to hold day-to-day state looks like it works until the first clean run boundary.',
        state: 'proven',
      },
      {
        claim: 'Module memory is a separate layer with a separate question',
        detail:
          'Agent memory answers "what have I done?". A module knowledge layer answers "what is true about the world?". Supermemory for GTM and Product, Activeloop for Investments where provenance is the deciding feature. Neither is tested here.',
        state: 'design',
      },
    ],
  },
  {
    id: 'long-horizon',
    num: '03',
    title: 'LONG-HORIZON AGENTS',
    lede:
      'The environment turned out to be the easy part. Sleep, lid closes and network loss are testable and this stack handles them. Noticing that an agent quietly stopped doing part of its job is the hard part.',
    items: [
      {
        claim: 'macOS DarkWake fires scheduled jobs with no network',
        detail:
          'Two-second maintenance wakes inside a long sleep. The worst observed result was a 44.6-minute hang: the model call died inside the workflow, so the cycle recorded as failed and Mastra could not clean up its own snapshot rows, leaving orphaned pending state.',
        state: 'proven',
      },
      {
        claim: 'Probe dependencies before starting work',
        detail:
          'A model-reachability preflight turns that hang into a 3.6-second offline skip — no workflow started, no debris, clean exit so the trigger does not thrash. Assume the trigger is hostile: every tick must be idempotent and able to no-op.',
        state: 'proven',
      },
      {
        claim: 'Four statuses, not two',
        detail:
          'ok · degraded · offline · failed. offline means the environment failed and there is nothing to debug in the agent. Collapsing them produces nightly false alarms, which get ignored — worse than no alarm.',
        state: 'proven',
      },
      {
        claim: 'A gap is not a miss until it is unexplained',
        detail:
          'Cross-check every gap against the machine’s own sleep log and classify it: asleep, jitter, partly-unexplained, unexplained. Only the last one should page anyone. And measure coverage against awake time — wall-clock scored a healthy agent at 18% for being closed.',
        state: 'proven',
      },
      {
        claim: 'A spend guard has to be able to stop itself',
        detail:
          'A soft warning stops nothing at 3am. The guard that works unloads its own scheduled job at the cap. An agent that cannot stop itself is not capped.',
        state: 'proven',
      },
      {
        claim: 'The unit of grading is the cycle, not the run',
        detail:
          'A background agent’s trace has no start and no end, so BEHAVIOR.md predicates are graded over a window of N cycles. A request-shaped run has a human at the end who notices a bad answer; a background agent has nobody.',
        state: 'proven',
      },
      {
        claim: 'A cycle that dies before it has state is abandoned, not resumed',
        detail:
          'Nothing retries it; the next tick starts fresh. That is weaker than the kill-test and must not be conflated with it. For independent cycles it costs one interval. For a real task in flight there is currently no answer.',
        state: 'open',
      },
      {
        claim: 'Inngest works. Mastra’s durable-agent layer on it does not',
        detail:
          '6 of 7 steps pass — Inngest holds a suspended run across a kill -9, re-invokes the worker unprompted, and Connect mode needs no tunnel and reconnected on its own after an 11-hour sleep. The resumed run then never completes. Five blockers, all Mastra-side.',
        state: 'proven',
      },
    ],
  },
  {
    id: 'never-again',
    num: '04',
    title: 'NOT TO DO AGAIN',
    lede:
      'Four times on this project a working system was reported as broken, or a broken one as working, because the check could not tell success from a no-op. Three were in verification code. One was in the agent’s own behaviour.',
    items: [
      {
        claim: 'A verification read that can return empty on success is not a verification',
        detail:
          'Where empty and failed look alike, the check must throw, or name which it was. A raw read of the vector table returns 0 regardless — that produced a two-day false negative asserting semantic recall was broken while 15 vectors existed and retrieval worked.',
        state: 'proven',
      },
      {
        claim: 'Never trust a metric you can satisfy by doing nothing',
        detail:
          'A frozen memory size and a healthy memory size are the same number. Grade freshness — the write timestamp — never size. Everything green for nine hours came down to this one substitution.',
        state: 'proven',
      },
      {
        claim: 'Do not conclude a feature is broken from an empty read',
        detail:
          'Reading the plural table name returned 0 rows and looked exactly like "durability is broken". The data was in the singular table the whole time. Check the constant in the package before writing the conclusion down.',
        state: 'proven',
      },
      {
        claim: 'A check that cannot tell "did not run" from "ran somewhere else" is not a check',
        detail:
          'The freshness check counted every cycle regardless of which resource it targeted, so three throwaway cycles on a test resource reported a healthy agent as stale. Cycles now record their resource. This is the fourth variant of the same bug on this project — and it appeared inside the fix for the third.',
        state: 'proven',
      },
      {
        claim: 'Do not iterate on a prompt before instrumenting the request',
        detail:
          'Two rounds of strengthening the memory instruction had no effect, because a framework-injected instruction was contradicting it 1,700 chars later. Intercepting the provider request found it in one run. When a model appears to ignore a clear instruction, read what it was actually sent.',
        state: 'proven',
      },
      {
        claim: 'Do not leave the memory write to the model',
        detail:
          'It stops doing it as the corpus grows. Ask the model for the memory content as ordinary output, then write it yourself through the vendor API. The model still does the synthesis; it just cannot skip the write.',
        state: 'proven',
      },
      {
        claim: 'Do not switch every recall channel on to be safe',
        detail:
          'They compete. More channels makes the agent less likely to maintain the ones that cost it effort. Give it the fewest that answer its question.',
        state: 'proven',
      },
      {
        claim: 'Do not write an eval clause of the form "memory must change"',
        detail:
          'It failed a correctly behaving agent for seven consecutive cycles in our own run, because the input was genuinely already covered. Unchanged state on already-covered input is correct. A judged clause compares input against state.',
        state: 'proven',
      },
      {
        claim: 'Do not put BEHAVIOR.md in the system prompt',
        detail:
          'It is a grading standard, not a prompt. The agent never reads it; it grades the trace afterwards, out of band. Injecting it turns the standard into an instruction.',
        state: 'proven',
      },
      {
        claim: 'Do not build on createInngestAgent() yet',
        detail:
          'Resumed runs do not complete. Five blockers, all in Mastra’s durable layer, including a hardcoded workflow id that cannot find its own run and a factory that returns a plain object with none of the three recovery methods its sibling has.',
        state: 'proven',
      },
    ],
  },
  {
    id: 'next',
    num: '05',
    title: 'NEXT',
    lede:
      'Named, not vague. Each of these is a thing someone can pick up. The deterministic memory write that used to head this list is done — it is under 02 · MEMORY now.',
    items: [
      {
        claim: 'Emit tool-offering in traces',
        detail:
          'We can see that a tool was called, not that it was withheld. The predicate that would have caught nine hours of failure needs both. Depends on the agent event log + Langfuse work (TUS-2758).',
        state: 'open',
      },
      {
        claim: 'Retry, and paging',
        detail:
          'An abandoned cycle has no retry. The alarm surface is a dashboard and a non-zero doctor exit. Neither is enough for an agent nobody is watching.',
        state: 'open',
      },
      {
        claim: 'Always-on agents, and a single multi-day run',
        detail:
          'Only schedule- and event-driven shapes have been run, as many short cycles. One long run spanning days — and the durable-agent APIs that would support it — is unexercised.',
        state: 'open',
      },
      {
        claim: 'Prove the module memory layer',
        detail:
          'Supermemory and Activeloop are an architecture recommendation, not a finding. Before adopting either: read the state back from outside its SDK, kill the process mid-write, and run with the harness memory disabled to check the layers do not overlap.',
        state: 'open',
      },
      {
        claim: 'Declare the singular Convex table',
        detail:
          'The real table is undeclared, so it has no validator and no declared indexes. Latent rather than active — reads and writes are self-consistent — but it needs a schema push, and that deployment currently has a live agent on it.',
        state: 'open',
      },
      {
        claim: 'Whether the cost curve plateaus',
        detail:
          'Input tokens stepped up once and had not flattened when we stopped measuring. A week-long run would answer it.',
        state: 'open',
      },
    ],
  },
];

// The rules that predate this run, loaded before anything else is designed. Kept brief on
// purpose — the skill is the source, this is the pointer.
export const ATELIER = {
  lede:
    'The hard rules every agent build here must obey, distilled from the Atelier post-mortem. Each one is traceable to a real production failure, and each is cited by ID when something gets blocked or waived.',
  families: [
    { id: 'CTX', label: 'Context discipline', note: 'what enters the window, and when it is pulled' },
    { id: 'LOOP', label: 'Loop ownership', note: 'who owns the loop and how it exits' },
    { id: 'MEM', label: 'Memory tiers', note: 'working · episodic · compounding, mapped explicitly' },
    { id: 'EVAL', label: 'Evaluator separation', note: 'the thing being judged never writes the judgement' },
    { id: 'STATE', label: 'State and stack', note: 'STATE-1 / STATE-1a — the kill-test this harness passes' },
    { id: 'TOOL', label: 'Tool boundaries', note: 'writes need an owner; a graph needs a written why' },
  ],
  punchline:
    'STATE-1a is the rule this entire harness exists to satisfy: vendor runtime state is a cache, not the source of truth, and a fresh process must recover from a canonical log. Load atelier-learnings before the first design question — without it the chain runs with its rules missing and nobody is told.',
};
