import { createAgent } from '../src/index.mjs';

export async function run(fixture) {
  return createAgent().run(fixture.input, { context: fixture.input?.context });
}
