import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountWorkspace } from '../assets/workspace.mjs';
import { AssetClient } from '../assets/client.mjs';
const config = { url: 'https://synthetic.supabase.co', publishableKey: 'sb_publishable_synthetic_public_key' };
const response = value => new Response(JSON.stringify(value));
async function tick() { for (let i = 0; i < 10; i++) await new Promise(resolve => setImmediate(resolve)); }

test('sample is public, financial data appears only after owner login and disappears on logout', async () => {
  const dom = new JSDOM('<section id="asset-workspace"></section>', { url: 'https://example.test' });
  const root = dom.window.document.querySelector('section'); const calls = [];
  const client = new AssetClient(config, async path => {
    calls.push(path);
    if (path.includes('/token?')) return response({ access_token: 'synthetic', expires_in: 3600 });
    if (path.endsWith('/user')) return response({ id: 'owner' });
    if (path.endsWith('/asset_access_allowed')) return response(true);
    if (path.includes('asset_accounts?')) return response([{ id: 'a', label: 'PRIVATE-ONLY', kind: 'bank', balance: 123, debt: 0 }]);
    return response([]);
  });
  const workspace = mountWorkspace(root, { config, storage: dom.window.localStorage, win: dom.window, clientFactory: () => client });
  try {
    assert.match(root.textContent, /가상 데이터/); assert.equal(calls.length, 0);
    root.querySelector('[data-asset-action="private"]').click(); assert.equal(calls.length, 0);
    assert.equal(root.querySelector('#asset-dashboard').textContent, '');
    const form = root.querySelector('[data-asset-form="login"]');
    form.querySelector('[name="email"]').value = 'synthetic@example.test'; form.querySelector('[name="password"]').value = 'synthetic-password';
    form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); await tick();
    assert.match(root.querySelector('#asset-dashboard').textContent, /PRIVATE-ONLY/);
    assert.equal(dom.window.localStorage.length, 0);
    root.querySelector('[data-asset-action="logout"]').click();
    assert.ok(!root.textContent.includes('PRIVATE-ONLY')); assert.equal(client.session, null);
  } finally { workspace.destroy(); dom.window.close(); }
});
test('leaving asset tab or choosing demo prevents stale financial responses from being displayed', async () => {
  const dom = new JSDOM('<section></section>', { url: 'https://example.test' }); const root = dom.window.document.querySelector('section');
  let resolve;
  const client = { state: 'authorized', subscribe() { return () => {}; }, lock() {}, loadData() { return new Promise(r => { resolve = r; }); } };
  const workspace = mountWorkspace(root, { config, storage: dom.window.localStorage, win: dom.window, clientFactory: () => client });
  try {
    root.querySelector('[data-asset-action="private"]').click();
    dom.window.dispatchEvent(new dom.window.CustomEvent('myspace:workspace', { detail: { tab: 'personal' } }));
    resolve({ accounts: [{ label: 'STALE-PRIVATE', balance: 123, debt: 0 }], holdings: [], snapshots: [], payments: [] }); await tick();
    assert.ok(!root.textContent.includes('STALE-PRIVATE')); assert.equal(root.querySelector('#asset-dashboard').textContent, '');
  } finally { workspace.destroy(); dom.window.close(); }
});
