import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const OWNER = 'The-Utopia-Studio';
const REPO = 'studio-agent-framework';
const REF = 'main';

const BUNDLE_FOLDER = 'studio-agent-framework';

type ZipEntry = { name: string; bytes: Uint8Array };

function crc32(bytes: Uint8Array) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function u16(value: number) { return Uint8Array.of(value & 0xff, (value >>> 8) & 0xff); }
function u32(value: number) { return Uint8Array.of(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff); }

function join(parts: Uint8Array[]) {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output;
}

// Small standards-compliant ZIP writer using stored (uncompressed) files. It avoids a
// deployment dependency solely to package this curated, text-heavy skills bundle.
function makeZip(entries: ZipEntry[]) {
  const encoder = new TextEncoder();
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.bytes);
    const header = join([
      u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
      u32(crc), u32(entry.bytes.length), u32(entry.bytes.length), u16(name.length), u16(0), name,
    ]);
    local.push(header, entry.bytes);
    central.push(join([
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
      u32(crc), u32(entry.bytes.length), u32(entry.bytes.length), u16(name.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(offset), name,
    ]));
    offset += header.length + entry.bytes.length;
  }
  const centralBytes = join(central);
  return join([
    ...local, centralBytes,
    u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
    u32(centralBytes.length), u32(offset), u16(0),
  ]);
}

async function fetchEntries(paths: string[], commit: string) {
  const entries: ZipEntry[] = [];
  for (let index = 0; index < paths.length; index += 12) {
    const batch = await Promise.all(paths.slice(index, index + 12).map(async (file) => {
      const response = await fetch(`https://raw.githubusercontent.com/${OWNER}/${REPO}/${commit}/${file}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Could not download ${file}`);
      const text = await response.text();
      const relativeName = file.endsWith('/SKILL.md') ? file.replace(/SKILL\.md$/, 'INSTRUCTIONS.md') : file;
      return { name: `${BUNDLE_FOLDER}/${relativeName}`, bytes: new TextEncoder().encode(file.endsWith('.md') ? text.replace(/\/SKILL\.md/g, '/INSTRUCTIONS.md') : text) };
    }));
    entries.push(...batch);
  }
  return entries;
}

export async function GET() {
  try {
    // Resolve once: every file in this response comes from the same immutable commit.
    const revision = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/commits/${REF}`, { cache: 'no-store' });
    if (!revision.ok) throw new Error('Could not resolve bundle revision');
    const revisionData: unknown = await revision.json();
    const sha = revisionData && typeof revisionData === 'object' && 'sha' in revisionData ? revisionData.sha : null;
    if (typeof sha !== 'string' || !/^[a-f0-9]{40}$/.test(sha)) throw new Error('Invalid revision');
    const fileListResponse = await fetch(`https://raw.githubusercontent.com/${OWNER}/${REPO}/${sha}/ui/agents-framework-ui/app/data/bundle-files.json`, { cache: 'no-store' });
    if (!fileListResponse.ok) throw new Error('Could not read bundle file list');
    const files: unknown = await fileListResponse.json();
    if (!Array.isArray(files) || !files.length || files.some((file: unknown) => typeof file !== 'string' || !/^[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*$/.test(file) || file.split('/').some(part => part === '..' || part === '.'))) throw new Error('Invalid bundle file list');
    const exclusionResponse = await fetch(`https://raw.githubusercontent.com/${OWNER}/${REPO}/${sha}/ui/agents-framework-ui/app/data/bundle-excludes.json`, { cache: 'no-store' });
    if (!exclusionResponse.ok) throw new Error('Could not read bundle exclusions');
    const exclusions: unknown = await exclusionResponse.json();
    if (!Array.isArray(exclusions) || exclusions.some((source: unknown) => typeof source !== 'string')) throw new Error('Invalid bundle exclusions');
    const patterns = exclusions.map((source) => new RegExp(source));
    const includedFiles = files.filter((file) => !patterns.some((pattern) => pattern.test(file)));
    // Claude accepts at most 200 ZIP entries. Reserve two entries for SKILL.md and version metadata.
    if (includedFiles.length + 2 > 200) throw new Error('Bundle exceeds host file limit');
    const entries = await fetchEntries(includedFiles, sha);
    const root = entries.find(entry => entry.name === `${BUNDLE_FOLDER}/scripts/bundle-root.md`);
    if (!root) throw new Error('Bundle root instructions missing');
    const zip = makeZip([
      { name: `${BUNDLE_FOLDER}/SKILL.md`, bytes: root.bytes },
      ...entries,
      { name: `${BUNDLE_FOLDER}/bundle-version.json`, bytes: new TextEncoder().encode(JSON.stringify({ commit: sha, files: includedFiles })) },
    ]);
    return new NextResponse(zip, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="studio-agent-framework-claude-skills.zip"',
        // A stale bundle is structurally invalid to Claude's uploader. Never let a browser
        // or CDN hand out a previous archive after this format changes.
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch {
    return NextResponse.json({ error: 'The Claude skills bundle could not be prepared. Please try again shortly.' }, { status: 503 });
  }
}
