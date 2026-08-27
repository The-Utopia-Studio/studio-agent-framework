import { NextResponse } from 'next/server';

/**
 * Resolves `main`'s current commit SHA and redirects straight to GitHub's
 * archive-by-SHA zip — a genuinely pinned download, not a moving `main.zip`
 * that changes under someone between click and unzip. The browser downloads
 * directly from GitHub; nothing is proxied through this app.
 *
 * Falls back to the branch archive (still real, just unpinned) if the SHA
 * lookup fails, rather than breaking the download entirely.
 */
const OWNER = 'The-Utopia-Studio';
const REPO = 'studio-agent-framework';
const BRANCH = 'main';

export async function GET() {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/commits/${BRANCH}`,
      {
        headers: { Accept: 'application/vnd.github+json' },
        // Revalidate every 5 minutes so a burst of clicks doesn't hammer
        // GitHub's unauthenticated rate limit, while staying close to HEAD.
        next: { revalidate: 300 },
      },
    );
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const { sha } = (await res.json()) as { sha?: string };
    if (!sha) throw new Error('no sha in response');
    return NextResponse.redirect(
      `https://github.com/${OWNER}/${REPO}/archive/${sha}.zip`,
      { status: 307 },
    );
  } catch {
    return NextResponse.redirect(
      `https://github.com/${OWNER}/${REPO}/archive/refs/heads/${BRANCH}.zip`,
      { status: 307 },
    );
  }
}
