// The storage mutation ConvexStore calls. Default function path is
// 'mastra/storage:handle', which is this file's `handle` export.
import { mastraStorage } from '@mastra/convex/server';

export const handle = mastraStorage;
