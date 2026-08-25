'use strict';
// Shared eval infrastructure: a local, DUAL-FORMAT model endpoint used as a deterministic
// stand-in for the model during the mock-fixture suite. Serves:
//
//   POST /messages          -> Anthropic Messages API   (content blocks, tool_use)
//   POST /responses          -> OpenAI Responses API     (output items, function_call)
//   POST /chat/completions   -> OpenAI Chat Completions  (choices[].message.tool_calls)
//
// Both formats are implemented so the same server can back any leg regardless of which
// provider that harness's model layer speaks (leg 1 Mastra, leg 4 Flue).
//
// Why this exists: PRD §2 requires every grader to be deterministic and §9 requires a
// countable "LLM invoked exactly once". A real model gives neither a fixed digest nor an
// invocation ledger. Pointing the provider's base URL here exercises the harness's REAL
// code path while making the model side deterministic and countable.
// Live runs do not use this. See FINDINGS.md.

const http = require('node:http');

/** Deterministic digest, grouped by status, from the <issues> block in the prompt. */
function buildDigest(promptText) {
  const m = /<issues>([\s\S]*?)<\/issues>/.exec(promptText || '');
  if (!m) return 'No issues block found in prompt.';
  let issues = [];
  try { issues = JSON.parse(m[1].trim()); } catch (_) { return 'Unparseable issues block.'; }

  const trunc = /<truncation>([\s\S]*?)<\/truncation>/.exec(promptText || '');
  const groups = new Map();
  for (const i of issues) {
    if (!groups.has(i.status)) groups.set(i.status, []);
    groups.get(i.status).push(i);
  }
  const lines = [];
  if (trunc && trunc[1].trim()) lines.push(trunc[1].trim(), '');
  for (const status of [...groups.keys()].sort()) {
    lines.push(`*${status}*`);
    for (const i of groups.get(status)) lines.push(`- ${i.id} ${i.title} (${i.assignee})`);
    lines.push('');
  }
  return lines.join('\n').trim();
}

// ------------------------------------------------------------------ request readers

/** Collect every piece of prompt text, whichever wire format is in use. */
function promptTextOf(body) {
  const parts = [];
  if (!body) return '';

  // Anthropic
  if (body.system) parts.push(typeof body.system === 'string' ? body.system : JSON.stringify(body.system));
  for (const m of body.messages || []) {
    if (typeof m.content === 'string') parts.push(m.content);
    else if (Array.isArray(m.content)) {
      for (const c of m.content) if (c && c.type === 'text') parts.push(c.text);
    }
  }

  // OpenAI Responses: instructions + input[] with input_text parts
  if (body.instructions) parts.push(String(body.instructions));
  for (const item of body.input || []) {
    if (typeof item === 'string') { parts.push(item); continue; }
    if (typeof item.content === 'string') { parts.push(item.content); continue; }
    if (Array.isArray(item.content)) {
      for (const c of item.content) {
        if (c && (c.type === 'input_text' || c.type === 'output_text' || c.type === 'text')) parts.push(c.text);
      }
    }
  }
  return parts.join('\n');
}

function chatEndTurn(n, model, text) {
  return {
    id: `chatcmpl_mock_${n}`, object: 'chat.completion', created: 1787000000,
    model: model || 'mock',
    choices: [{ index: 0, finish_reason: 'stop',
      message: { role: 'assistant', content: text, tool_calls: undefined } }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  };
}
function chatToolUse(n, model, toolName, input, callSeq) {
  return {
    id: `chatcmpl_mock_${n}`, object: 'chat.completion', created: 1787000000,
    model: model || 'mock',
    choices: [{ index: 0, finish_reason: 'tool_calls',
      message: { role: 'assistant', content: null, tool_calls: [{
        id: `call_mock_${callSeq}`, type: 'function',
        function: { name: toolName, arguments: JSON.stringify(input) },
      }] } }],
    usage: { prompt_tokens: 42, completion_tokens: 17, total_tokens: 59 },
  };
}

// ---- SSE (OpenAI Chat Completions streaming) ------------------------------------------
// FINDING: Flue/Pi calls the model with `stream: true`. A single JSON body fails with
// "Stream ended without finish_reason", so the mock must speak Server-Sent Events.
function chatStreamChunks(n, model, toolName, input, callSeq, text) {
  const base = { id: `chatcmpl_mock_${n}`, object: 'chat.completion.chunk', created: 1787000000, model: model || 'mock' };
  const out = [];
  if (toolName) {
    out.push({ ...base, choices: [{ index: 0, delta: { role: 'assistant', content: null,
      tool_calls: [{ index: 0, id: `call_mock_${callSeq}`, type: 'function',
        function: { name: toolName, arguments: JSON.stringify(input) } }] }, finish_reason: null }] });
    out.push({ ...base, choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] });
  } else {
    out.push({ ...base, choices: [{ index: 0, delta: { role: 'assistant', content: text }, finish_reason: null }] });
    out.push({ ...base, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] });
  }
  out.push({ ...base, choices: [], usage: { prompt_tokens: 42, completion_tokens: 17, total_tokens: 59 } });
  return out;
}

/** Has a tool result already been handed back to the model? */
function hasToolResult(body) {
  if (!body) return false;
  // Anthropic
  for (const m of body.messages || []) {
    if (!Array.isArray(m.content)) continue;
    for (const c of m.content) if (c && c.type === 'tool_result') return true;
  }
  // OpenAI Responses
  for (const item of body.input || []) {
    if (item && item.type === 'function_call_output') return true;
  }
  // OpenAI Chat Completions
  for (const m of body.messages || []) {
    if (m && m.role === 'tool') return true;
  }
  return false;
}

// ------------------------------------------------------------------ response builders

function anthropicEndTurn(n, model, text) {
  return {
    id: `msg_mock_${n}`, type: 'message', role: 'assistant', model: model || 'mock',
    stop_reason: 'end_turn', content: [{ type: 'text', text }],
    usage: { input_tokens: 10, output_tokens: 5 },
  };
}
function anthropicToolUse(n, model, toolName, input, callSeq) {
  return {
    id: `msg_mock_${n}`, type: 'message', role: 'assistant', model: model || 'mock',
    stop_reason: 'tool_use',
    content: [{ type: 'tool_use', id: `toolu_mock_${callSeq}`, name: toolName, input }],
    usage: { input_tokens: 42, output_tokens: 17 },
  };
}
function openaiEndTurn(n, model, text) {
  return {
    id: `resp_mock_${n}`, object: 'response', created_at: 1787000000,
    model: model || 'mock', status: 'completed', output_text: text,
    output: [{
      type: 'message', id: `msg_mock_${n}`, role: 'assistant', status: 'completed',
      content: [{ type: 'output_text', text, annotations: [] }],
    }],
    usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
  };
}
function openaiToolUse(n, model, toolName, input, callSeq) {
  return {
    id: `resp_mock_${n}`, object: 'response', created_at: 1787000000,
    model: model || 'mock', status: 'completed',
    output: [{
      type: 'function_call', id: `fc_mock_${callSeq}`, call_id: `call_mock_${callSeq}`,
      name: toolName, arguments: JSON.stringify(input), status: 'completed',
    }],
    usage: { input_tokens: 42, output_tokens: 17, total_tokens: 59 },
  };
}

/**
 * @param {object} [opts]
 * @param {number}   [opts.port]           0 = ephemeral
 * @param {string}   [opts.toolName]       default post_to_slack
 * @param {function} [opts.getMode]        live mode getter (see the singleton below)
 */
function startMockModel(opts = {}) {
  const toolName = opts.toolName || 'post_to_slack';
  const requests = [];
  let toolUseCount = 0;

  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      let body = null;
      try { body = JSON.parse(raw); } catch (_) {}
      const isResponses = /\/responses\b/.test(req.url || '');
      const isChat = /\/chat\/completions\b/.test(req.url || '');
      const format = isResponses ? 'openai-responses'
        : isChat ? 'openai-chat-completions' : 'anthropic-messages';
      requests.push({ at: new Date().toISOString(), url: req.url, format, model: body && body.model });

      const mode = typeof opts.getMode === 'function' ? (opts.getMode() || {}) : opts;
      const n = requests.length;
      const model = body && body.model;
      const repeats = mode.repeatToolUse || 1;

      const endTurn = (text) => isResponses ? openaiEndTurn(n, model, text)
        : isChat ? chatEndTurn(n, model, text) : anthropicEndTurn(n, model, text);
      const useTool = (input, seq) => isResponses ? openaiToolUse(n, model, toolName, input, seq)
        : isChat ? chatToolUse(n, model, toolName, input, seq)
        : anthropicToolUse(n, model, toolName, input, seq);

      let payload, lastText = null, lastInput = null;
      if (mode.neverSelectTool) {
        lastText = 'Nothing to digest.';
        payload = endTurn(lastText);
      } else if (hasToolResult(body) && toolUseCount >= repeats) {
        lastText = 'Digest posted.';
        payload = endTurn(lastText);
      } else {
        toolUseCount++;
        lastInput = { digest_text: mode.forcedDigest || buildDigest(promptTextOf(body)) };
        payload = useTool(lastInput, toolUseCount);
      }

      // Streaming path: Flue/Pi sets stream:true and requires SSE with a finish_reason.
      if (body && body.stream && isChat) {
        const chunks = mode.neverSelectTool || (hasToolResult(body) && toolUseCount >= repeats)
          ? chatStreamChunks(n, model, null, null, null, lastText)
          : chatStreamChunks(n, model, toolName, lastInput, toolUseCount, null);
        res.writeHead(200, {
          'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive',
        });
        for (const c of chunks) res.write(`data: ${JSON.stringify(c)}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }

      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(payload));
    });
  });

  return new Promise((resolve) => {
    server.listen(opts.port || 0, '127.0.0.1', () => {
      const { port } = server.address();
      server.unref();   // must not hold the event loop open: the suite has to exit
      resolve({
        url: `http://127.0.0.1:${port}`, port,
        get callCount() { return requests.length; },
        get toolUseCount() { return toolUseCount; },
        requests,
        stop: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

// ---------------------------------------------------------------------------------------
// Process-wide singleton.
//
// FINDING (FINDINGS.md D-14): Mastra's model router resolves the provider -- including its
// baseURL -- once per process and caches it. Re-assigning the base-URL env var between runs
// in the same process has NO effect: later runs keep dialling the first URL. So the suite
// must stand up ONE endpoint before the first agent is constructed and vary behaviour per
// case through mutable server-side mode instead of through env.
let _singleton = null;
let _mode = {};
let _countAtReset = 0;

async function ensureMockModel() {
  if (_singleton) return _singleton;
  _singleton = await startMockModel({ getMode: () => _mode });
  // Point every provider we might exercise at the same endpoint.
  process.env.OPENAI_BASE_URL = _singleton.url;
  process.env.ANTHROPIC_BASE_URL = _singleton.url;
  if (!process.env.OPENAI_API_KEY) process.env.OPENAI_API_KEY = 'sk-mock';
  if (!process.env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = 'sk-ant-mock';
  return _singleton;
}
function setMockMode(mode = {}) { _mode = mode; }
function resetMockCounters() { _countAtReset = _singleton ? _singleton.callCount : 0; }
function mockCallsSinceReset() { return _singleton ? _singleton.callCount - _countAtReset : 0; }
function stopMockModel() { const s = _singleton; _singleton = null; return s ? s.stop() : Promise.resolve(); }

module.exports = {
  startMockModel, buildDigest,
  ensureMockModel, setMockMode, resetMockCounters, mockCallsSinceReset, stopMockModel,
};
