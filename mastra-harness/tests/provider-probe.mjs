// Read what the model was ACTUALLY SENT.
//
// This is the single most useful diagnostic on this project. It found two separate memory
// failures that no amount of reading the agent's replies would have found, and in both cases
// the obvious explanation was wrong:
//
//   1. Working memory sat frozen for nine overnight cycles while every run reported `ok` and
//      the agent's own replies said "Updating memory." The probe showed OFFERED: false -- the
//      tool was not on the request at all. (Cause: a raw out-of-band write to
//      mastra_resources.workingMemory had silently disabled it.)
//
//   2. After moving the write into code, the model ignored an explicit output-format
//      instruction twice in a row. The obvious read is that the model is being careless. The
//      probe showed Mastra appending "IMPORTANT: You MUST call updateWorkingMemory in every
//      response" ~1,700 chars AFTER our instructions. The model was given contradictory
//      orders. The instruction was never the problem.
//
// The rule worth carrying: WHEN A MODEL APPEARS TO IGNORE A CLEAR INSTRUCTION, READ WHAT IT
// WAS ACTUALLY SENT before rewriting the instruction. Two rounds of prompt strengthening cost
// more than one run of this.
//
// Usage -- wrap however your agent runs one cycle:
//
//   import { withProviderProbe } from './provider-probe.mjs';
//   const { report } = await withProviderProbe(
//     () => import('../../agent/run.js'),
//     { host: /moonshot|anthropic|openai/, tool: /workingMemory/i },
//   );
//   console.log(report.summary());

/**
 * @param run       async fn that performs ONE agent cycle
 * @param opts.host RegExp matching your provider's URL (skip unrelated fetches)
 * @param opts.tool RegExp matching the tool name you care about
 * @param opts.minSystemChars ignore trivial requests -- a reachability preflight sends a bare
 *        body with no system prompt and would otherwise be reported as "no tools offered",
 *        which is how the first run of this probe produced a confusing empty result.
 * @param opts.expectTool 'yes' if this agent is supposed to use the framework's memory tool,
 *        'no' if it uses the deterministic-write architecture (workingMemory:false + a
 *        storage-only Memory instance). Default 'no', because that is what the standard
 *        recommends. Getting this right is what stops the probe warning about a correct
 *        configuration -- a test that cries wolf on the recommended setup trains people to
 *        ignore it, which is worse than no test.
 * @param opts.waitMs after `run()` resolves, keep intercepting for up to this long waiting for
 *        a qualifying request. Needed because a module that self-invokes its main() -- the
 *        common shape for a cycle script -- resolves its import BEFORE doing any work, so a
 *        naive probe restores fetch too early and captures nothing. That happened on the first
 *        real use of this file, and "captured nothing" looks exactly like "nothing to report".
 */
export async function withProviderProbe(run, opts = {}) {
  const host = opts.host ?? /moonshot|anthropic|openai/;
  const tool = opts.tool ?? /workingMemory/i;
  const minSystemChars = opts.minSystemChars ?? 200;
  const waitMs = opts.waitMs ?? 90_000;
  const expectTool = opts.expectTool ?? 'no';

  const original = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : (input && input.url) || String(input);
    let captured = null;

    if (host.test(url) && init && init.body) {
      try {
        const body = JSON.parse(init.body);
        const system = Array.isArray(body.system)
          ? body.system.map((x) => x.text || '').join('\n')
          : String(body.system || '');
        if (system.length >= minSystemChars) {
          captured = {
            tools: (body.tools || []).map((t) => t.name),
            offered: (body.tools || []).some((t) => tool.test(t.name || '')),
            system,
            called: false,
          };
          requests.push(captured);
        }
      } catch { /* not JSON we understand; leave it alone */ }
    }

    const res = await original(input, init);

    if (captured) {
      // clone() so the real consumer still gets an unread body
      try {
        const data = await res.clone().json();
        captured.called = (data.content || []).some(
          (c) => c.type === 'tool_use' && tool.test(c.name || ''),
        );
      } catch { /* streaming or non-JSON; `called` stays false */ }
    }
    return res;
  };

  let settled = false;
  try {
    await run();
    settled = true;
    // Keep intercepting until a qualifying request appears. `run()` resolving does NOT mean
    // the cycle finished when the module self-invokes -- see waitMs above.
    const deadline = Date.now() + waitMs;
    while (!requests.length && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 250));
    }
    // Give the response body time to arrive so `called` is accurate rather than a default false.
    if (requests.length) await new Promise((r) => setTimeout(r, 1500));
  } finally {
    globalThis.fetch = original;
  }

  return { requests, ranToCompletion: settled, report: buildReport(requests, tool, expectTool) };
}

// Phrases Mastra injects when workingMemory.enabled is true. If your instructions tell the
// model NOT to use a tool and any of these are present, you have a contradiction, and the
// model will satisfy neither instruction.
const MASTRA_TOOL_MANDATE = [
  'the way you update your working memory is by calling',
  'You MUST call updateWorkingMemory',
];

export function buildReport(requests, tool, expectTool = 'no') {
  const r = requests[requests.length - 1] || null;
  return {
    requestCount: requests.length,
    offered: r ? r.offered : null,
    called: r ? r.called : null,
    tools: r ? r.tools : [],
    /** Does the framework mandate the tool path in the system prompt? */
    frameworkMandatesTool: r ? MASTRA_TOOL_MANDATE.some((p) => r.system.includes(p)) : null,
    systemChars: r ? r.system.length : 0,
    summary() {
      if (!r) {
        return [
          'NO QUALIFYING PROVIDER REQUEST CAPTURED — this is not a pass, it is an inability to check.',
          'Most likely causes, in order:',
          '  1. the wrapped `run` resolved before the cycle did. A script that self-invokes main()',
          '     without exporting a promise does exactly this — wrap it so it resolves on completion,',
          '     or raise `waitMs`.',
          '  2. `host` does not match your provider URL.',
          '  3. every request fell under `minSystemChars` (a reachability preflight will).',
        ].join('\n');
      }
      const lines = [
        `tools offered: ${r.tools.join(', ') || '(none)'}`,
        `${String(tool)} — OFFERED: ${r.offered} | CALLED: ${r.called}`,
        `system prompt: ${r.system.length} chars`,
      ];
      // Four states, and only two of them are problems. Which two depends on the architecture
      // the agent is supposed to be using, which is why expectTool is not optional in practice.
      if (expectTool === 'no') {
        if (r.offered === false && !this.frameworkMandatesTool) {
          lines.push(
            'OK: no tool offered and no framework mandate — this is the deterministic-write',
            '  architecture. Memory must be written by your own code; check the write landed with',
            '  assertWriteAdvanced().',
          );
        }
        if (this.frameworkMandatesTool) {
          lines.push(
            'FAIL: the system prompt MANDATES the tool path ("You MUST call updateWorkingMemory")',
            '  while this agent is meant to write memory itself. These contradict, the mandate lands',
            '  after your instructions, and the model will satisfy NEITHER — it says "Updating',
            '  memory." and moves on. Set workingMemory:false on the agent and use a separate',
            '  storage-only Memory instance. See mastra-harness/SKILL.md §5.',
          );
        }
      } else {
        if (r.offered === false) {
          lines.push(
            'FAIL: this agent is meant to use the memory tool and the tool is not on the request at',
            '  all. A raw write to mastra_resources.workingMemory does exactly this. Never write',
            '  that column outside the vendor API.',
          );
        }
        if (r.offered && !r.called) {
          lines.push(
            'WARNING: offered but not called. Expected once other recall channels can answer the',
            '  question on their own — which is why the write should not be left to the model.',
            '  Move to the deterministic write rather than strengthening the instruction.',
          );
        }
      }
      return lines.join('\n');
    },
  };
}

/**
 * The assertion worth putting in CI for any agent with durable memory.
 *
 * Deliberately does NOT assert that content changed. Unchanged memory is correct when the
 * input was already covered, and asserting otherwise fails a well-behaved agent -- it did so
 * for seven consecutive cycles on this project. It asserts the write PATH RAN, by checking the
 * timestamp advanced. Mastra bumps updatedAt on every write even when content is identical,
 * which is exactly what makes that check safe.
 */
export async function assertWriteAdvanced(readUpdatedAt, run) {
  const before = await readUpdatedAt();
  await run();
  const after = await readUpdatedAt();
  const b = Date.parse(before ?? '');
  const a = Date.parse(after ?? '');
  if (!Number.isFinite(a)) throw new Error('no write timestamp after the cycle — cannot judge freshness');
  if (Number.isFinite(b) && a <= b) {
    throw new Error(`durable write did not advance (${before} -> ${after}) — the write path did not run`);
  }
  return { before, after };
}
