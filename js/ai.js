/* Claude API integration (raw HTTP from the browser). The key is held in a
   cookie on this device only and is sent solely to api.anthropic.com. */
(function () {
  'use strict';
  const COOKIE = 'sima_claude_key';
  const API = 'https://api.anthropic.com/v1/messages';
  const DEFAULT_MODEL = 'claude-opus-5-5';

  function getKey() {
    const m = document.cookie.match(new RegExp('(?:^|; )' + COOKIE + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }
  function setKey(key) {
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    if (!key) { document.cookie = COOKIE + '=; Max-Age=0; path=/; SameSite=Strict' + secure; return; }
    document.cookie = COOKIE + '=' + encodeURIComponent(key) + '; Max-Age=' + 60 * 60 * 24 * 365 + '; path=/; SameSite=Strict' + secure;
  }

  async function request(body, opts) {
    const key = getKey();
    if (!key) throw new Error('No Claude API key saved. Add one in Settings.');
    const model = (opts && opts.model) || DEFAULT_MODEL;
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    };
    const payload = Object.assign({ model, max_tokens: 8000 }, body);
    // Server-side refusal fallbacks (Claude Opus 5.5 / Fable 5.1): if the
    // primary model declines, the API re-runs on a fallback model.
    if (/claude-(opus-5|fable-5)/.test(model)) {
      headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
      payload.fallbacks = 'default';
    }
    const res = await fetch(API, { method: 'POST', headers, body: JSON.stringify(payload) });
    if (!res.ok) {
      let msg = res.status + ' ' + res.statusText;
      try { const j = await res.json(); if (j.error && j.error.message) msg = j.error.message; } catch (e) { /* ignore */ }
      const err = new Error(msg); err.status = res.status; throw err;
    }
    const data = await res.json();
    if (data.stop_reason === 'refusal') throw new Error('Claude declined this request' + (data.stop_details && data.stop_details.explanation ? ': ' + data.stop_details.explanation : '.'));
    return data;
  }
  function textOf(msg) {
    return (msg.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  }

  // Plain chat turn. `messages` = [{role, content}] history.
  async function chat({ system, messages, model, maxTokens }) {
    const data = await request({ system, messages, max_tokens: maxTokens || 4000 }, { model });
    return textOf(data);
  }

  // Ask for a JSON object. Tries structured outputs first; if the API rejects
  // the parameter, falls back to prompting for JSON and parsing it.
  async function json({ system, messages, schema, model, maxTokens }) {
    let data;
    try {
      data = await request({ system, messages, max_tokens: maxTokens || 8000, output_config: { format: { type: 'json_schema', schema } } }, { model });
    } catch (e) {
      if (e.status !== 400) throw e;
      const sys2 = system + '\n\nRespond with a single JSON object only, matching this JSON schema, no prose and no code fences:\n' + JSON.stringify(schema);
      data = await request({ system: sys2, messages, max_tokens: maxTokens || 8000 }, { model });
    }
    const raw = textOf(data);
    return parseJson(raw);
  }
  function parseJson(raw) {
    try { return JSON.parse(raw); } catch (e) { /* fall through */ }
    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) { try { return JSON.parse(fence[1]); } catch (e) { /* fall through */ } }
    const start = raw.indexOf('{'), end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
    throw new Error('Claude did not return valid JSON.');
  }

  async function testKey(model) {
    const data = await request({ messages: [{ role: 'user', content: 'Reply with the single word OK.' }], max_tokens: 16 }, { model });
    return textOf(data);
  }

  window.AI = { getKey, setKey, chat, json, testKey, parseJson, DEFAULT_MODEL,
    MODELS: [
      { id: 'claude-opus-5-5', name: 'Claude Opus 5.5 (recommended)' },
      { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5 (faster, cheaper)' },
      { id: 'claude-fable-5-1', name: 'Claude Fable 5.1 (most capable, premium)' },
      { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5 (budget)' },
    ] };
})();
