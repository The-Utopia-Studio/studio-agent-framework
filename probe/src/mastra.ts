import { Mastra } from '@mastra/core';
import { ConvexStore } from '@mastra/convex';
import { approvalWorkflow } from './workflow.js';

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `${name} is not set. Copy .env.example to .env, run \`npx convex dev\`, ` +
        `and paste the deployment URL and an admin key from the Convex dashboard.`,
    );
  }
  return v;
}

/**
 * STACK-1: one store. Mastra's run state lives in OUR Convex deployment,
 * in tables declared in OUR convex/schema.ts.
 *
 * CAVEAT (audit §1, and it matters): adminAuthToken bypasses Clerk. Mastra
 * talks to Convex as an admin. MEM-7 tenant isolation therefore CANNOT be
 * enforced by Convex auth on this path — it has to be enforced in app code
 * by scoping every call on resourceId, and tested adversarially before this
 * touches real fellow data.
 */
export const storage = new ConvexStore({
  id: 'studio-convex',
  deploymentUrl: required('CONVEX_URL'),
  adminAuthToken: required('CONVEX_ADMIN_KEY'),
  storageFunction: 'mastra/storage:handle',
});

export const mastra = new Mastra({
  storage,
  workflows: { approvalWorkflow },
});
