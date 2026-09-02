import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const OWNER = 'The-Utopia-Studio';
const REPO = 'studio-agent-framework';
const REF = 'main';

// This is intentionally a short, explicit allow-list—not a repository archive.
// `long-horizon` stays because learnings and mastra-harness link to it directly.
const BUNDLE_FILES = [
  'agent-builder/SKILL.md', 'agent-builder/hermes/README.md', 'agent-builder/hermes/RESULTS.md', 'agent-builder/hermes/cases/adversarial.md', 'agent-builder/hermes/cases/golden.md', 'agent-builder/hermes/rubric.json',
  'agent-design/SKILL.md', 'agent-design/examples/sample.md', 'agent-design/template.md',
  'agent-prd/SKILL.md',
  'eval-first-spec/SKILL.md', 'eval-first-spec/examples/sample.md', 'eval-first-spec/template.md',
  'learnings/SKILL.md',
  'long-horizon/BEHAVIOR.md', 'long-horizon/HARNESS.md', 'long-horizon/INNGEST.md', 'long-horizon/MEMORY.md', 'long-horizon/README.md', 'long-horizon/STANDARD.md',
  'mastra-harness/SKILL.md', 'mastra-harness/scaffold/budget.js', 'mastra-harness/scaffold/doctor.js', 'mastra-harness/scaffold/freshness.js', 'mastra-harness/scaffold/harness.js', 'mastra-harness/scaffold/memory.js', 'mastra-harness/scaffold/preflight.js', 'mastra-harness/scaffold/status.js', 'mastra-harness/template.md', 'mastra-harness/tests/README.md', 'mastra-harness/tests/nested-kill-resume.js', 'mastra-harness/tests/provider-probe.mjs',
  'workflow-design/SKILL.md', 'workflow-design/examples/sample.md', 'workflow-design/template.md',
];

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

async function fetchEntries(paths: string[]) {
  const entries: ZipEntry[] = [];
  for (let index = 0; index < paths.length; index += 12) {
    const batch = await Promise.all(paths.slice(index, index + 12).map(async (file) => {
      const response = await fetch(`https://raw.githubusercontent.com/${OWNER}/${REPO}/${REF}/${file}`, { next: { revalidate: 300 } });
      if (!response.ok) throw new Error(`Could not download ${file}`);
      return { name: file, bytes: new Uint8Array(await response.arrayBuffer()) };
    }));
    entries.push(...batch);
  }
  return entries;
}

export async function GET() {
  try {
    const zip = makeZip(await fetchEntries(BUNDLE_FILES));
    return new NextResponse(zip, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="studio-agent-framework-claude-skills.zip"',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch {
    return NextResponse.json({ error: 'The Claude skills bundle could not be prepared. Please try again shortly.' }, { status: 503 });
  }
}
