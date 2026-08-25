// Case 6 · trace attribution. Every run's trace must carry a git sha (PRD §10:
// "non-negotiable from the first commit, since it is one of the bake-off's own
// comparison axes"; STACK-4: "Langfuse wired in from the first commit").
//
// STATUS: the LangfuseExporter IS wired below, but it only activates when
// LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY are present. The operator instructed
// "ignore langfuse ... ill add it later", so no keys exist and no Langfuse trace id can
// be produced. That is a credential blocker, not a code gap -- see FINDINGS.md case 6.
// STACK-4 is therefore VIOLATED BY OPERATOR WAIVER, recorded rather than silently skipped.
import { Observability, BaseExporter } from '@mastra/observability';
import { LangfuseExporter } from '@mastra/langfuse';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { gitSha, RESOURCE, THREAD } = require('../store/events.js');

/** Local span exporter: stamps the git sha onto every exported tracing event. */
export class GitShaFileExporter extends BaseExporter {
  name = 'git-sha-file-exporter';
  #file;
  constructor(config = {}) {
    super(config);
    this.#file = config.filePath || path.join(process.cwd(), 'traces', 'mastra-spans.jsonl');
    fs.mkdirSync(path.dirname(this.#file), { recursive: true });
  }
  // NOTE: @mastra/observability@1.17.1's own source comment documents this hook as
  // `_exportEvent`, but BaseExporter.exportTracingEvent actually calls
  // `this._exportTracingEvent`. Implementing the documented name fails silently with
  // "[Observability] tracing handler error ... this._exportTracingEvent is not a function"
  // and the run still reports success. Recorded in FINDINGS.md as a docs-vs-reality gap.
  async _exportTracingEvent(event) {
    const span = event && (event.span || event.exportedSpan || null);
    fs.appendFileSync(this.#file, JSON.stringify({
      event_type: event && event.type,
      trace_id: span && (span.traceId ?? span.trace_id) || null,
      span_id: span && (span.id ?? span.spanId) || null,
      span_name: span && (span.name ?? null),
      span_type: span && (span.type ?? null),
      // the attribution the golden case checks for
      git_sha: gitSha(),
      resource: RESOURCE, thread: THREAD,
      at: new Date().toISOString(),
    }) + '\n');
  }
}

export function buildObservability({ tracesFile } = {}) {
  const exporters = [new GitShaFileExporter({ filePath: tracesFile })];

  const hasLangfuse = !!(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY);
  if (hasLangfuse) {
    exporters.push(new LangfuseExporter({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      baseUrl: process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
    }));
  }

  return {
    observability: new Observability({
      configs: { default: { serviceName: 'linear-digest', exporters } },
    }),
    langfuseWired: true,        // the code path exists
    langfuseActive: hasLangfuse, // ...but it is inert without credentials
  };
}
