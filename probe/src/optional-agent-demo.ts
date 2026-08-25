/**
 * OPTIONAL — needs a model API key. NOT part of the kill-test.
 *
 * This demonstrates the other half of LOOP-5: pausing between the moment the
 * agent SELECTS a tool and the moment it EXECUTES it. That is the granularity
 * 12-factor Factor 6 names as the thing most orchestrators cannot do, and it
 * is what `requireApproval` on a tool gives you.
 *
 * The workflow probe covers step-boundary suspension. This covers tool-call
 * suspension. Run it once you have a key, to confirm both.
 */
import 'dotenv/config';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const dangerousWriteTool = createTool({
  id: 'commit-to-roadmap',
  description: 'Writes a line to the studio roadmap. Irreversible.',
  inputSchema: z.object({ line: z.string() }),
  outputSchema: z.object({ written: z.boolean() }),
  // LOOP-5 / Factor 6: the run stops HERE — after the model chose this tool,
  // before execute() runs. Resume with agent.approveToolCall({ runId }).
  requireApproval: true,
  execute: async ({ line }) => {
    console.log(`[commit-to-roadmap] wrote: ${line}`);
    return { written: true };
  },
});

console.log(
  'Tool defined with requireApproval: true.\n' +
    'Wire it to an Agent with a model, call streamVNext, and confirm the stream\n' +
    'closes on tool selection. See node_modules/@mastra/core/src/tools/hitl.md\n' +
    '(also at packages/core/src/tools/hitl.md in mastra-ai/mastra).',
);
