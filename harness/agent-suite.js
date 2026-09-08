// Generic fixtures for a generated agent. The adapter is explicit operator input; fixture data
// never contains executable code. Production integrations still need their declared proof checks.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import behavior from '../bakeoff/evals/behavior.js';
const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const adapterPath = path.resolve(arg('harness'));
const module = await import(pathToFileURL(adapterPath));
const adapter = module.default || module;
if (typeof adapter.run !== 'function') throw new Error('adapter must export run(fixture, ctx)');
const root = fs.realpathSync(arg('fixture-root'));
const cases = arg('case').split(',');
const available = fs
  .readdirSync(root)
  .filter((f) => f.endsWith('.json'))
  .map((f) => {
    const file = path.join(root, f);
    if (!fs.realpathSync(file).startsWith(root + path.sep)) throw new Error('fixture escapes root');
    return JSON.parse(fs.readFileSync(file));
  });
const results = [];
for (const name of cases) {
  try {
    const matches = available.filter((f) => f.case === name);
    if (matches.length !== 1) throw new Error(`fixture ${name} must be unique`);
    const fixture = matches[0];
    if (
      !fixture.expect ||
      typeof fixture.expect !== 'object' ||
      !Object.keys(fixture.expect).length
    )
      throw new Error('fixture requires explicit expected report fields');
    const report = await adapter.run(fixture, {
      runId: arg('suite-id'),
      agentId: arg('agent-id'),
      live: false,
    });
    const checks = Object.entries(fixture.expect).map(([key, value]) => ({
      key,
      ok: isDeepStrictEqual(report?.[key], value),
    }));
    if (arg('policy'))
      checks.push(...behavior.gradeBehavior(report?.events, JSON.parse(arg('policy'))).results);
    const verdict = checks.every((c) => c.ok) ? 'PASS' : 'FAIL';
    results.push({ case: name, verdict, checks });
  } catch (e) {
    results.push({ case: name, verdict: 'ERROR', detail: e.message });
  }
}
fs.writeFileSync(
  arg('result'),
  JSON.stringify(
    {
      suite_id: arg('suite-id'),
      agent_id: arg('agent-id'),
      adapter: adapterPath,
      live: false,
      results,
    },
    null,
    2,
  ),
);
console.log(results.map((r) => `${r.verdict} ${r.case}`).join('\n'));
process.exitCode = results.every((r) => r.verdict === 'PASS') ? 0 : 1;
