import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from 'yaml';
export function validateStructure(root, profile) {
  const required = {
    skill: ['SKILL.md'],
    managed: ['instructions.md', 'config.json', 'README.md', 'tests'],
    coded: [
      'README.md',
      'package.json',
      'package-lock.json',
      '.env.example',
      'agent-manifest.json',
      'build-state.json',
      'docs/agents',
      'src/index.ts',
      'src/agents',
      'src/tools',
      'src/runtime',
      'tests/input.schema.json',
      'tests/fixtures',
      'tests/conformance.mjs',
    ],
  };
  if (!required[profile]) return ['unknown profile'];
  const issues = required[profile]
    .filter((f) => !fs.existsSync(path.join(root, f)))
    .map((f) => `missing ${f}`);
  if (profile === 'skill' && !issues.length) {
    const source = fs.readFileSync(path.join(root, 'SKILL.md'), 'utf8');
    try {
      const meta = parse(source.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] || '');
      if (
        !meta ||
        meta.name !== path.basename(path.resolve(root)) ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(meta.name) ||
        meta.name.length > 64
      )
        issues.push('skill name must match its lowercase folder name');
      if (
        typeof meta?.description !== 'string' ||
        !meta.description.trim() ||
        meta.description.length > 1024
      )
        issues.push('description must be 1–1024 characters');
    } catch (error) {
      issues.push(`invalid metadata: ${error.message}`);
    }
  }
  if (profile === 'coded' && fs.existsSync(path.join(root, 'agent-manifest.json'))) {
    try {
      const m = JSON.parse(fs.readFileSync(path.join(root, 'agent-manifest.json')));
      for (const folder of [
        m.runtime?.workflow?.required && 'src/workflows',
        m.state?.memory?.channels?.some((c) => c !== 'none') && 'src/memory',
        m.runtime?.harness === 'mastra-convex' && 'convex',
      ]) {
        if (folder && !fs.existsSync(path.join(root, folder)))
          issues.push(`selected capability requires ${folder}`);
      }
    } catch {
      issues.push('invalid manifest JSON');
    }
  }
  return issues;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
  if (!arg('root')) {
    console.error('--root and --profile are required');
    process.exit(2);
  }
  const issues = validateStructure(path.resolve(arg('root')), arg('profile'));
  issues.forEach((i) => console.error(i));
  if (!issues.length) console.log('Structure PASS (placement only; not runtime proof)');
  process.exit(issues.length ? 1 : 0);
}
