import test from 'node:test';
import assert from 'node:assert/strict';
import { AssetClient, validateConfig } from '../assets/client.mjs';
const config = { url: 'https://example-project.supabase.co', publishableKey: 'sb_publishable_synthetic_test_key' };
const response = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const auth = (path, allowed = true) => path.includes('/token?') ? response({ access_token: 'synthetic-token', refresh_token: 'never-store-this', expires_in: 3600 }) : path.endsWith('/user') ? response({ id: 'owner' }) : path.endsWith('/asset_access_allowed') ? response(allowed) : response([]);

test('fetch is called with the global receiver required by browser implementations', async () => {
  const client = new AssetClient(config, async function (path) { assert.equal(this, globalThis); return auth(path); });
  await client.login('synthetic@example.test', 'synthetic-password');
  await client.loadData(); client.lock();
});

test('locked, denied and expired clients never request financial tables', async () => {
  const calls = []; const client = new AssetClient(config, async path => { calls.push(path); return auth(path, false); });
  await assert.rejects(client.loadData(), /먼저 본인/); assert.equal(calls.length, 0);
  await assert.rejects(client.login('synthetic@example.test', 'synthetic-password'), /본인 계정/);
  await assert.rejects(client.loadData(), /먼저 본인/);
  assert.equal(calls.length, 3); assert.equal(client.session, null);
  assert.ok(calls.every(path => path.includes('/auth/') || path.endsWith('/asset_access_allowed')));
  client.state = 'authorized'; client.session = { accessToken: 'expired', expiresAt: Date.now() - 1 };
  await assert.rejects(client.loadData(), /먼저 본인/); assert.equal(calls.length, 3); assert.equal(client.session, null);
});
test('a rejected expired server token locks the session without exposing response text', async () => {
  const client = new AssetClient(config, async () => response({ code: 'expired', details: 'PRIVATE-SERVER-DETAILS' }, 401));
  client.state = 'authorized'; client.session = { accessToken: 'invalid-token', expiresAt: Date.now() + 10000 };
  await assert.rejects(client.request('asset_accounts?select=id'), /로그인이 만료/); assert.equal(client.session, null); assert.equal(client.state, 'locked');
});
test('verified login gates data, discards refresh token, and logout locks before network completes', async () => {
  const calls = []; const client = new AssetClient(config, async (path, options) => { calls.push({ path, options }); return auth(path); });
  await client.login('synthetic@example.test', 'synthetic-password');
  assert.equal(client.state, 'authorized'); assert.equal('refresh_token' in client.session, false);
  const data = await client.loadData(); assert.deepEqual(data.accounts, []);
  assert.equal(calls.filter(c => c.path.includes('?select=')).length, 4);
  const dataCall = calls.find(c => c.path.includes('?select='));
  assert.equal(dataCall.options.headers.Authorization, 'Bearer synthetic-token'); assert.equal(dataCall.options.cache, 'no-store');
  const logout = client.logout(); assert.equal(client.session, null); await logout;
  await assert.rejects(client.loadData(), /먼저 본인/);
});
test('in-flight financial result is rejected after sign-out, even when transport ignores abort', async () => {
  let resolve; const client = new AssetClient(config, async path => path.includes('asset_accounts?') ? new Promise(r => { resolve = r; }) : auth(path));
  await client.login('synthetic@example.test', 'synthetic-password');
  const pending = client.request('asset_accounts?select=id'); client.lock(); resolve(response([{ balance: 123 }]));
  await assert.rejects(pending, /취소/); assert.equal(client.session, null);
});
test('invalid connection, service-role keys and secret keys are rejected', () => {
  for (const candidate of ['http://example.supabase.co', 'https://example.com', 'https://example.supabase.co/redirect']) assert.throws(() => validateConfig({ ...config, url: candidate }));
  const jwt = 'header.' + btoa(JSON.stringify({ role: 'service_role' })) + '.signature';
  for (const publishableKey of [jwt, 'sb_secret_do_not_use_this_key']) assert.throws(() => validateConfig({ ...config, publishableKey }));
});
