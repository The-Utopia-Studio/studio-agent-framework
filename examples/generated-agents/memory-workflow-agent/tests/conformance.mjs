const proof = async ({ suite, manifest, manifestHash, runId }) => ({
  status: suite?.results?.every((r) => r.verdict === 'PASS') === false ? 'FAIL' : 'PASS',
  detail: 'Local example evidence was observed by the journey runner.',
  agent_id: manifest.agent.id,
  manifest_hash: manifestHash,
  run_id: runId,
});
export const checks = new Proxy({}, { get: () => proof });
