'use strict';
// WO-1 · portable tool function. PRD §8.
// ZERO harness imports by design — reused verbatim by legs 2 and 3.
// This tool is the ONLY externally-visible side effect in the agent (PRD §5).
// It posts. It never edits and never deletes — see WORKORDERS standing rules.

/**
 * Posts one digest message to the Slack incoming webhook in the environment.
 *
 * Never throws on a Slack-side failure: returns { ok:false, ... } so the harness can
 * persist the response and record a failure distinctly from `declined` (case 9).
 * Throws only when there is no webhook to call at all (a config error, not a send result).
 *
 * @param {string} digest_text
 * @param {object} [opts]
 * @param {string} [opts.webhookUrl] defaults to process.env.SLACK_WEBHOOK_URL
 * @param {function} [opts.fetchImpl] injectable for mock fixtures
 * @returns {Promise<{ok:boolean,status:number|null,body:string|null,error:string|null,postedAt:string}>}
 */
async function post_to_slack(digest_text, opts = {}) {
  if (typeof digest_text !== 'string' || digest_text.trim() === '') {
    throw new Error('post_to_slack requires non-empty digest_text');
  }

  const webhookUrl = opts.webhookUrl || process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    // PRD §8 credential failure behaviour: clean failure report, never silent.
    throw new Error('SLACK_WEBHOOK_URL is not set');
  }

  const doFetch = opts.fetchImpl || globalThis.fetch;
  const postedAt = new Date().toISOString();

  let res;
  try {
    res = await doFetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: digest_text }),
    });
  } catch (err) {
    // Network-level failure. Recorded as a send outcome, not thrown, so the
    // event log always holds a row for the attempt (LOOP-2, case 9).
    return { ok: false, status: null, body: null, error: String(err && err.message || err), postedAt };
  }

  let body = null;
  try {
    body = await res.text();
  } catch (_) {
    body = null;
  }

  return {
    ok: res.status >= 200 && res.status < 300,
    status: res.status,
    body,
    error: null,
    postedAt,
  };
}

module.exports = post_to_slack;
module.exports.post_to_slack = post_to_slack;
