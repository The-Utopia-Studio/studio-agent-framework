'use strict';
// WO-1 acceptance test, post_to_slack half. PRD §8, case 9.
const assert = require('node:assert');
const post_to_slack = require('../../tools/post_to_slack.js');

let pass = 0;
const check = (n, f) => { try { f(); console.log(`  PASS  ${n}`); pass++; }
  catch (e) { console.log(`  FAIL  ${n}\n        ${e.message}`); process.exitCode = 1; } };

(async () => {
  console.log('WO-1 acceptance — tools/post_to_slack.js\n');

  let captured = null;
  const ok200 = async (url, init) => { captured = { url, init }; return { status: 200, text: async () => 'ok' }; };

  const r = await post_to_slack('hello digest', { webhookUrl: 'https://hooks.example/x', fetchImpl: ok200 });
  check('2xx -> ok true', () => assert.strictEqual(r.ok, true));
  check('reports status', () => assert.strictEqual(r.status, 200));
  check('reports body', () => assert.strictEqual(r.body, 'ok'));
  check('stamps postedAt', () => assert.match(r.postedAt, /^\d{4}-\d{2}-\d{2}T/));
  check('POSTs JSON {text}', () => {
    assert.strictEqual(captured.init.method, 'POST');
    assert.deepStrictEqual(JSON.parse(captured.init.body), { text: 'hello digest' });
  });
  check('uses the injected webhook url', () => assert.strictEqual(captured.url, 'https://hooks.example/x'));

  // case 9 — non-2xx recorded, not thrown
  const bad = await post_to_slack('x', { webhookUrl: 'https://hooks.example/x',
    fetchImpl: async () => ({ status: 404, text: async () => 'no_service' }) });
  check('case 9: non-2xx -> ok false, does not throw', () => {
    assert.strictEqual(bad.ok, false);
    assert.strictEqual(bad.status, 404);
    assert.strictEqual(bad.body, 'no_service');
  });

  // case 9 — network failure recorded, not thrown
  const net = await post_to_slack('x', { webhookUrl: 'https://hooks.example/x',
    fetchImpl: async () => { throw new Error('ECONNRESET'); } });
  check('case 9: network error -> ok false with error string', () => {
    assert.strictEqual(net.ok, false);
    assert.strictEqual(net.status, null);
    assert.match(net.error, /ECONNRESET/);
  });

  // config errors DO throw (not a send outcome)
  await assert.rejects(() => post_to_slack('', { webhookUrl: 'https://x' }), /non-empty digest_text/)
    .then(() => { console.log('  PASS  empty digest_text throws'); pass++; })
    .catch((e) => { console.log(`  FAIL  empty digest_text throws\n        ${e.message}`); process.exitCode = 1; });
  await assert.rejects(() => post_to_slack('x', { webhookUrl: '' , fetchImpl: ok200}), /SLACK_WEBHOOK_URL is not set/)
    .then(() => { console.log('  PASS  missing webhook throws'); pass++; })
    .catch((e) => { console.log(`  FAIL  missing webhook throws\n        ${e.message}`); process.exitCode = 1; });

  console.log(`\n${pass} checks passed`);
})();
