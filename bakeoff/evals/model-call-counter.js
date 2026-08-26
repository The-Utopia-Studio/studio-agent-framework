'use strict';
// Counts REAL model HTTP calls by wrapping globalThis.fetch.
//
// Why this exists: the suite counted model calls via the local mock server's request log.
// That works only when the mock is in the path. With DIGEST_REAL_MODEL=1 there is no mock,
// so mockCallsSinceReset() returns 0 unconditionally -- and `model_calls_after_resume: 0`
// was REPORTED AS MEASURED when nothing had been measured. That produced a false PASS on
// golden case 4's "LLM not re-invoked" assertion on every real-model run. This counter
// closes the hole: it counts actual outbound POSTs to a model endpoint, mock or live.
const MODEL_HOST_RE = /(api\.moonshot\.(ai|cn)|api\.anthropic\.com|api\.openai\.com|127\.0\.0\.1|localhost)/i;
const MODEL_PATH_RE = /\/(messages|responses|chat\/completions)\b/;

let installed = false;
const calls = [];
let mark = 0;

function install() {
  if (installed) return;
  installed = true;
  const orig = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : (input && input.url) || String(input);
    const method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    if (method === 'POST' && MODEL_HOST_RE.test(url) && MODEL_PATH_RE.test(url)) {
      let model = null;
      try { model = JSON.parse((init && init.body) || '{}').model || null; } catch (_) {}
      calls.push({ url, model });
    }
    return orig(input, init);
  };
}
const reset = () => { mark = calls.length; };
const since = () => calls.length - mark;
const total = () => calls.length;
const detail = () => calls.map((c) => ({ model: c.model, url: String(c.url).replace(/^https?:\/\//, '') }));

module.exports = { install, reset, since, total, detail };
