import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from 'yaml';
export const skills = [
  'agent-builder',
  'agent-design',
  'workflow-design',
  'eval-first-spec',
  'agent-prd',
  'learnings',
  'mastra-harness',
  'agent-structure',
];
export function checkSkills(root) {
  const issues = [];
  for (const name of skills) {
    const file = ['SKILL.md', 'INSTRUCTIONS.md']
      .map((n) => path.join(root, name, n))
      .find(fs.existsSync);
    if (!file) {
      issues.push(`${name}: missing skill`);
      continue;
    }
    const source = fs.readFileSync(file, 'utf8');
    try {
      const header = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      const meta = parse(header?.[1] || '');
      if (!meta || meta.name !== name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(meta.name))
        issues.push(`${name}: invalid name`);
      if (
        typeof meta?.description !== 'string' ||
        !meta.description.trim() ||
        meta.description.length > 1024
      )
        issues.push(`${name}: description must be 1–1024 characters`);
      for (const key of Object.keys(meta || {}))
        if (
          ![
            'name',
            'description',
            'license',
            'compatibility',
            'metadata',
            'allowed-tools',
          ].includes(key)
        )
          issues.push(`${name}: unsupported metadata ${key}`);
      if (source.split('\n').length > 500) issues.push(`${name}: entrypoint exceeds 500 lines`);
      for (const [, ref] of source.matchAll(/\]\(([^)]+)\)/g)) {
        if (/^(https?:|#|mailto:)/.test(ref)) continue;
        const target = path.resolve(path.dirname(file), ref.split('#')[0]);
        if (!fs.existsSync(target)) issues.push(`${name}: missing reference ${ref}`);
      }
    } catch (e) {
      issues.push(`${name}: ${e.message}`);
    }
  }
  return issues;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const issues = checkSkills(process.cwd());
  issues.forEach((i) => console.error(i));
  if (!issues.length)
    console.log(`${skills.length} skills: metadata, length and direct references PASS`);
  process.exit(issues.length ? 1 : 0);
}
