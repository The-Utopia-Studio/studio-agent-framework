export const BUILD_TOOLS = [
  {
    id: 'claude',
    name: 'Claude',
    color: '#d97757',
    bg: '#fdf4f0',
    logo: '/logos/claude.png',
    description: '',
  },
  {
    id: 'codex',
    name: 'Codex',
    color: '#10a37f',
    bg: '#f0fdf8',
    logo: '/logos/codex.svg',
    description: '',
  },
  {
    id: 'cursor',
    name: 'Cursor',
    color: '#1a1a1a',
    bg: '#f3f3f3',
    logo: '/logos/cursor.png',
    description: '',
  },
  {
    id: 'manus',
    name: 'Manus',
    color: '#6366f1',
    bg: '#f5f3ff',
    logo: '/logos/manus.svg',
    description: '',
  },
  {
    id: 'codewords',
    name: 'Codewords',
    color: '#2563eb',
    bg: '#eff6ff',
    logo: '/logos/codewords.png',
    description: '',
  },
] as const;

export type BuildTool = (typeof BUILD_TOOLS)[number];

export const PATH_EXAMPLES = {
  SKILL: {
    name: 'Weekly research brief',
    owner: 'Studio',
    status: 'READY',
    summary: 'Haniyah kicks it off every Monday. Agent reads sources, drafts the brief. Studio reviews before send.',
  },
  'MANAGED SURFACE': {
    name: 'Founder follow-up',
    owner: 'Growth',
    status: 'PILOT',
    summary: 'Runs after every founder call. Drafts follow-up, writes to CRM. Growth reviews before it goes out.',
  },
  'CODED AGENT': {
    name: 'Website agent',
    owner: 'Haniyah',
    status: 'PILOT',
    summary: 'Runs on deploy events. Writes to the live site. Feeds analytics and the event log automatically.',
  },
} as const;
