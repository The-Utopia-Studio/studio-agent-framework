export type AgentNode = {
  id: string;
  label: string;
  kind: 'trigger' | 'agent' | 'output' | 'file' | 'tool';
};

export type AgentBlueprint = {
  name: string;
  pathType: string;
  owner: string;
  status: string;
  summary: string;
  nodes: AgentNode[];
  edges: [string, string][];
  buildTools: string[];
  harness: {
    id: 'claude' | 'mastra';
    label: string;
    detail: string;
  };
};

export const AGENT_BLUEPRINTS: Record<string, AgentBlueprint> = {
  SKILL: {
    name: 'Weekly research brief',
    pathType: 'SKILL',
    owner: 'Studio',
    status: 'READY',
    summary:
      'Haniyah kicks it off every Monday. The agent reads sources.md, drafts weekly-brief.md from brief-prd.md. Studio reviews before send.',
    nodes: [
      { id: 'trigger', label: 'Haniyah · Monday kickoff', kind: 'trigger' },
      { id: 'agent', label: 'Weekly research brief', kind: 'agent' },
      { id: 'output', label: 'Studio reviews', kind: 'output' },
      { id: 'prd', label: 'brief-prd.md', kind: 'file' },
      { id: 'sources', label: 'sources.md', kind: 'file' },
      { id: 'brief', label: 'weekly-brief.md', kind: 'file' },
      { id: 'rss', label: 'RSS feeds', kind: 'tool' },
      { id: 'notion', label: 'Notion', kind: 'tool' },
      { id: 'claude', label: 'Claude', kind: 'tool' },
    ],
    edges: [
      ['trigger', 'agent'],
      ['agent', 'output'],
      ['agent', 'prd'],
      ['agent', 'sources'],
      ['agent', 'brief'],
      ['sources', 'rss'],
      ['prd', 'notion'],
      ['brief', 'claude'],
    ],
    buildTools: ['claude'],
    harness: {
      id: 'claude',
      label: 'Claude',
      detail: 'Scheduled task harness',
    },
  },
  'MANAGED SURFACE': {
    name: 'Founder follow-up',
    pathType: 'MANAGED SURFACE',
    owner: 'Growth',
    status: 'PILOT',
    summary:
      'Runs after every founder call. Agent drafts follow-up.md, writes to CRM. Growth reviews before it goes out.',
    nodes: [
      { id: 'trigger', label: 'Post-call event', kind: 'trigger' },
      { id: 'agent', label: 'Founder follow-up', kind: 'agent' },
      { id: 'output', label: 'Growth reviews', kind: 'output' },
      { id: 'prd', label: 'followup-prd.md', kind: 'file' },
      { id: 'transcript', label: 'call-notes.md', kind: 'file' },
      { id: 'draft', label: 'follow-up.md', kind: 'file' },
      { id: 'crm', label: 'HubSpot CRM', kind: 'tool' },
      { id: 'calendar', label: 'Google Calendar', kind: 'tool' },
      { id: 'cursor', label: 'Cursor', kind: 'tool' },
    ],
    edges: [
      ['trigger', 'agent'],
      ['agent', 'output'],
      ['agent', 'prd'],
      ['agent', 'transcript'],
      ['agent', 'draft'],
      ['transcript', 'calendar'],
      ['draft', 'crm'],
      ['prd', 'cursor'],
    ],
    buildTools: ['claude', 'codex', 'cursor'],
    harness: {
      id: 'mastra',
      label: 'Mastra',
      detail: 'Standard agent harness',
    },
  },
  'CODED AGENT': {
    name: 'Website agent',
    pathType: 'CODED AGENT',
    owner: 'Haniyah',
    status: 'PILOT',
    summary:
      'Runs on deploy. Agent reads site-prd.md, patches live site, logs to Convex. Analytics ingests automatically.',
    nodes: [
      { id: 'trigger', label: 'Deploy event', kind: 'trigger' },
      { id: 'agent', label: 'Website agent', kind: 'agent' },
      { id: 'output', label: 'Analytics pipeline', kind: 'output' },
      { id: 'prd', label: 'site-prd.md', kind: 'file' },
      { id: 'orders', label: 'work-orders.md', kind: 'file' },
      { id: 'changelog', label: 'changelog.md', kind: 'file' },
      { id: 'mastra', label: 'Mastra', kind: 'tool' },
      { id: 'convex', label: 'Convex', kind: 'tool' },
      { id: 'codex', label: 'Codex', kind: 'tool' },
    ],
    edges: [
      ['trigger', 'agent'],
      ['agent', 'output'],
      ['agent', 'prd'],
      ['agent', 'orders'],
      ['agent', 'changelog'],
      ['prd', 'mastra'],
      ['orders', 'codex'],
      ['changelog', 'convex'],
    ],
    buildTools: ['claude', 'codex', 'cursor'],
    harness: {
      id: 'mastra',
      label: 'Mastra',
      detail: 'Standard agent harness',
    },
  },
};

export function getAgentBlueprint(pathType: string): AgentBlueprint {
  return AGENT_BLUEPRINTS[pathType] ?? AGENT_BLUEPRINTS.SKILL;
}
