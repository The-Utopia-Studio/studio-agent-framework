// Leg 3 · case 6 · trace attribution.
// Deep Agents inherits LangChain's callback/tracer surface, so two things are wired:
//   * a local BaseTracer that stamps the git sha onto every run it sees (always on)
//   * Langfuse's official LangChain CallbackHandler (only when credentials exist)
// Langfuse integration DOES exist for this stack (`langfuse-langchain@3.38.20`), unlike
// leg 4 (Flue), where no Langfuse package exists at all.
import { BaseTracer } from '@langchain/core/tracers/base';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { gitSha, RESOURCE, THREAD } = require('../store/events.js');

export class GitShaFileTracer extends BaseTracer {
  name = 'git-sha-file-tracer';
  constructor(opts = {}) {
    super({});
    this.file = opts.filePath || path.join(process.cwd(), 'traces', 'deepagents-spans.jsonl');
    this.runId = opts.runId || null;
    this.count = 0;
    this.traceKey = null;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
  }
  async persistRun(run) {
    this.count++;
    if (!this.traceKey) this.traceKey = run.id || null;
    fs.appendFileSync(this.file, JSON.stringify({
      trace_id: run.id || null,
      parent_run_id: run.parent_run_id || null,
      span_name: run.name || null,
      span_type: run.run_type || null,
      run_id: this.runId,
      git_sha: gitSha(),
      resource: RESOURCE, thread: THREAD,
      at: new Date().toISOString(),
    }) + '\n');
  }
}

export async function buildCallbacks({ runId, tracesFile }) {
  const local = new GitShaFileTracer({ runId, filePath: tracesFile });
  const handlers = [local];
  const hasLangfuse = !!(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY);
  if (hasLangfuse) {
    const { CallbackHandler } = await import('langfuse-langchain');
    handlers.push(new CallbackHandler({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      baseUrl: process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
      metadata: { git_sha: gitSha(), resource: RESOURCE, thread: THREAD },
    }));
  }
  return { handlers, local, langfuseWired: true, langfuseActive: hasLangfuse };
}
