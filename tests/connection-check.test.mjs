import test from 'node:test';
import assert from 'node:assert/strict';
import { checkConnection } from '../scripts/check-supabase-connection.mjs';
const config = { url: 'https://synthetic.supabase.co', publishableKey: 'sb_publishable_synthetic_test_public_key' };
const cors = { 'access-control-allow-origin': 'https://hsh3167.github.io', 'access-control-allow-headers': 'apikey, authorization, content-type, prefer' };
test('hosted readiness checks auth/CORS and denies anonymous metadata requests without fetching financial records', async () => {
  const requests = [];
  const report = await checkConnection(config, { fetcher: async (url, options) => {
    requests.push({ url, options });
    if (url.endsWith('/settings')) return new Response(JSON.stringify({ disable_signup: true }));
    if (options.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    assert.ok(options.method === 'HEAD' || url.endsWith('/asset_access_allowed'));
    return new Response(null, { status: 401 });
  } });
  assert.equal(report.ready, true); assert.equal(report.signupDisabled, true);
  assert.equal(requests.filter(r => r.options.method === 'HEAD').length, 5);
});
test('missing schema, publicly readable tables, invalid CORS and unavailable auth cannot pass readiness', async () => {
  for (const status of [200,404]) {
    const report = await checkConnection(config, { fetcher: async (url, options) => url.endsWith('/settings') ? new Response('{}') : options.method === 'OPTIONS' ? new Response(null, { status: 204, headers: cors }) : new Response(null, { status }) });
    assert.equal(report.ready, false);
  }
  assert.equal((await checkConnection(config, { authOnly: true, fetcher: async url => url.endsWith('/settings') ? new Response('{}') : new Response(null, { status: 204 }) })).ready, false);
  assert.equal((await checkConnection(config, { fetcher: async () => new Response(null, { status: 401 }) })).ready, false);
});
