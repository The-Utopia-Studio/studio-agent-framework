import { createAgent } from '../src/index.mjs';

export async function run(fixture) {
  const agent = createAgent();
  if (fixture.input.workflow === 'resume') {
    await agent.run({
      tenant_id: fixture.input.tenant_id,
      resource: fixture.input.resource,
      note: fixture.input.seed,
    });
  }
  return agent.run(fixture.input);
}
