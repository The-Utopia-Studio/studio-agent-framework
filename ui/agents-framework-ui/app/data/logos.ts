export const BUILD_TOOL_LOGOS: Record<string, string> = {
  claude: '/logos/claude.png',
  codex: '/logos/codex.svg',
  cursor: '/logos/cursor.png',
  manus: '/logos/manus.svg',
  codewords: '/logos/codewords.png',
};

export const INTEGRATION_LOGOS: Record<string, string> = {
  notion: '/logos/stack/notion.svg',
  rss: '/logos/stack/rss.svg',
  crm: '/logos/stack/hubspot.svg',
  calendar: '/logos/stack/google-calendar.svg',
  mastra: '/logos/stack/mastra.png',
  convex: '/logos/stack/convex.svg',
  claude: '/logos/claude.png',
  codex: '/logos/codex.svg',
  cursor: '/logos/cursor.png',
};

export function getLogoForId(id: string): string | undefined {
  return BUILD_TOOL_LOGOS[id] ?? INTEGRATION_LOGOS[id];
}
