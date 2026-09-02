export type StackStatus =
  | 'in-use'
  | 'decided'
  | 'pilot'
  | 'pilot-quarter'
  | 'standard'
  | 'experimental'
  | 'testing';

export type StackItem = {
  id: string;
  name: string;
  subtitle: string;
  status: StackStatus;
  statusLabel: string;
  logos: string[];
};

export const STACK_GRID: StackItem[] = [
  {
    id: 'convex',
    name: 'Convex',
    subtitle: 'store + event log',
    status: 'in-use',
    statusLabel: 'IN USE',
    logos: ['/logos/stack/convex.svg'],
  },
  {
    id: 'inngest',
    name: 'Inngest / Trigger.dev',
    subtitle: 'durable execution',
    status: 'experimental',
    statusLabel: 'EXPERIMENTAL',
    logos: ['/logos/stack/inngest.svg', '/logos/stack/triggerdev.svg'],
  },
  {
    id: 'aisdk',
    name: 'Raw fetch / AI SDK',
    subtitle: 'per tier',
    status: 'decided',
    statusLabel: 'DECIDED',
    logos: ['/logos/stack/vercel.svg'],
  },
  {
    id: 'langfuse',
    name: 'Langfuse',
    subtitle: 'tracing',
    status: 'in-use',
    statusLabel: 'IN USE',
    logos: ['/logos/stack/langfuse.svg'],
  },
  {
    id: 'composio',
    name: 'Composio',
    subtitle: 'tool connections + auth',
    status: 'pilot',
    statusLabel: 'PILOT',
    logos: ['/logos/stack/composio.svg'],
  },
  {
    id: 'activeloop',
    name: 'Deep Lake / Activeloop',
    subtitle: 'shared semantic memory (candidate)',
    status: 'experimental',
    statusLabel: 'EXPERIMENTAL',
    logos: ['/logos/stack/activeloop.svg'],
  },
  {
    id: 'supermemory',
    name: 'Supermemory',
    subtitle: 'shared semantic memory (candidate)',
    status: 'testing',
    statusLabel: 'TESTING',
    logos: ['/logos/stack/supermemory.svg'],
  },
];

export const STACK_FEATURED = {
  id: 'mastra',
  name: 'Mastra',
  subtitle: 'standard agent harness',
  status: 'standard' as StackStatus,
  statusLabel: 'STUDIO STANDARD',
  logos: ['/logos/stack/mastra.png'],
  description:
    'Mastra runs the agent loop — durable execution, tool routing, and the standard harness for coded agents.',
  verified: 'STATE-1A VERIFIED',
  specs: 'live model · hard kill · fresh-process resume · no duplicate send',
  footnote: 'AUG 2026 · STANDARD SELECTED',
  footnoteBody:
    'Mastra passed the Studio crash-resume and durable-state gate. Skills, projects, and managed surfaces do not need a coded runtime — this is the standard for the high-autonomy, coded-agent path only.',
};
