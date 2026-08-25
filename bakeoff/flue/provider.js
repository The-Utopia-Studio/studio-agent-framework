// Leg 4 · model provider wiring.
//
// Flue resolves model specifiers against Pi providers (pi.dev). Two modes:
//   mock  — a custom Pi provider pointed at our local triple-format mock endpoint.
//           Used by the deterministic suite so the digest is fixed and model calls
//           are countable (PRD §2 deterministic graders, §9 invocation count).
//   live  — Pi's built-in `openai` provider, reading OPENAI_API_KEY.
//
// D-ROW: Flue/Pi does NOT honour OPENAI_BASE_URL. Unlike Mastra (D-17), there is no
// env-var route to a custom endpoint; the documented mechanism is a custom provider with
// an explicit `baseUrl`. That is arguably cleaner but it is a code change, not config.
import { createProvider } from '@earendil-works/pi-ai';
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy';

export const MOCK_MODEL = 'mock/digest-mock';

/**
 * D-ROW: the docs' keyless custom-provider example is `resolve: async () => ({ auth: {} })`.
 * That fails — openai-completions' getClientApiKey() requires an apiKey or an authorization
 * header, so `{auth:{}}` throws "No API key for provider" and returning undefined throws
 * "Provider is not configured". The working shape is `{ auth: { apiKey: <any value> } }`.
 */
export function mockProvider(baseUrl) {
  return createProvider({
    id: 'mock',
    auth: { apiKey: { name: 'mock (keyless)', resolve: async () => ({ auth: { apiKey: 'sk-mock' } }) } },
    models: [{
      id: 'digest-mock', name: 'Deterministic digest mock', api: 'openai-completions',
      provider: 'mock', baseUrl,
      reasoning: false, input: ['text'],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128000, maxTokens: 8192,
    }],
    api: openAICompletionsApi(),
  });
}
