import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { consumeRecoveryURL, PasswordSetupClient, mountPasswordSetup } from '../assets/password.mjs';

const config = { url: 'https://synthetic.supabase.co', publishableKey: 'sb_publishable_synthetic_public_key' };
const pageURL = 'https://example.test/my-space-dashboard/assets/password.html';
const token = 'synthetic-recovery-access';
const credentials = { accessToken: token, expiresIn: 900 };
const fragment = '#access_token=' + token + '&refresh_token=synthetic-refresh-do-not-store&type=recovery&expires_in=3600';
const response = (value, status = 200) => new Response(JSON.stringify(value), { status });
async function tick() { for (let i = 0; i < 10; i++) await new Promise(resolve => setImmediate(resolve)); }
function backend(calls, { allowed = true, status = 200 } = {}) {
  return async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/auth/v1/user') && options.method === 'GET') return response({ id: 'synthetic-owner' }, status);
    if (url.endsWith('/asset_access_allowed')) return response(allowed);
    if (url.endsWith('/auth/v1/user') && options.method === 'PUT') return response({ id: 'synthetic-owner' });
    if (url.includes('/auth/v1/recover?') || url.endsWith('/auth/v1/logout')) return response({});
    throw new Error('Unexpected request; no financial tables may be requested.');
  };
}

test('recovery/invite credentials are consumed and URL secrets removed, without retaining refresh tokens', () => {
  for (const type of ['recovery','invite']) {
    const dom = new JSDOM('', { url: pageURL + '?secret=do-not-retain' + fragment.replace('type=recovery', 'type=' + type) });
    try {
      assert.deepEqual(consumeRecoveryURL(dom.window), { accessToken: token, expiresIn: 3600 });
      assert.equal(dom.window.location.href, pageURL);
      assert.equal(dom.window.localStorage.length, 0);
      assert.equal(dom.window.sessionStorage.length, 0);
      assert.equal(consumeRecoveryURL(dom.window), null);
    } finally { dom.window.close(); }
  }
});
test('expired, missing and unrelated URL tokens are cleared without Auth requests', async () => {
  for (const hash of ['#error=access_denied&error_code=otp_expired', '#access_token=synthetic&type=magiclink', '#type=recovery']) {
    const dom = new JSDOM('<div></div>', { url: pageURL + hash }), calls = [];
    const view = mountPasswordSetup(dom.window.document.querySelector('div'), { config, win: dom.window, fetcher: backend(calls) });
    try {
      await view.ready;
      assert.equal(dom.window.location.hash, ''); assert.equal(calls.length, 0);
      assert.match(dom.window.document.body.textContent, /유효하지 않거나 만료/);
      assert.ok(dom.window.document.querySelector('[name="email"]'));
    } finally { view.destroy(); dom.window.close(); }
  }
});
test('password update requires server-verified owner and keeps recovery credentials only in memory', async () => {
  const calls = [], client = new PasswordSetupClient(config, backend(calls));
  try {
    await assert.rejects(client.setPassword('synthetic-new-password'), /설정 링크/);
    assert.equal(calls.length, 0);
    await client.verify(credentials);
    assert.equal(client.token, token);
    await assert.rejects(client.setPassword('short'), /12~128/);
    await client.setPassword('synthetic-new-password');
    assert.deepEqual(calls.map(c => [new URL(c.url).pathname, c.options.method]), [
      ['/auth/v1/user','GET'], ['/rest/v1/rpc/asset_access_allowed','POST'],
      ['/auth/v1/user','PUT'], ['/auth/v1/logout','POST']
    ]);
    assert.deepEqual(JSON.parse(calls[2].options.body), { password: 'synthetic-new-password' });
    assert.equal(client.token, null);
    assert.equal(client.api.session, null);
  } finally { client.clear(); }
});
test('other accounts, expired credentials, cancelled verification and expired setup sessions cannot update passwords', async () => {
  for (const options of [{ allowed: false }, { status: 401 }]) {
    const calls = [], client = new PasswordSetupClient(config, backend(calls, options));
    try {
      await assert.rejects(client.verify(credentials));
      await assert.rejects(client.setPassword('synthetic-new-password'));
      assert.ok(!calls.some(c => c.options.method === 'PUT'));
      assert.equal(client.token, null);
    } finally { client.clear(); }
  }
  const calls = [], client = new PasswordSetupClient(config, backend(calls));
  try {
    await client.verify(credentials); client.expiresAt = Date.now() - 1;
    await assert.rejects(client.setPassword('synthetic-new-password'), /설정 링크/);
    assert.equal(client.token, null);
    let release, pausedCalls = 0;
    const paused = new PasswordSetupClient(config, async () => { pausedCalls++; return new Promise(resolve => { release = () => resolve(response({ id: 'synthetic-owner' })); }); });
    const pending = paused.verify(credentials); paused.clear(); release();
    await assert.rejects(pending);
    assert.equal(pausedCalls, 1);
    assert.equal(paused.token, null); paused.clear();
  } finally { client.clear(); }
});
test('setup email is requested only on submit and uses an explicit clean HTTPS redirect without signup', async () => {
  const dom = new JSDOM('<div></div>', { url: pageURL }), calls = [];
  const root = dom.window.document.querySelector('div');
  const view = mountPasswordSetup(root, { config, win: dom.window, fetcher: backend(calls) });
  try {
    await view.ready; assert.equal(calls.length, 0);
    root.querySelector('[name="email"]').value = 'synthetic@example.test';
    root.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await tick();
    assert.equal(calls.length, 1);
    const request = new URL(calls[0].url);
    assert.equal(request.pathname, '/auth/v1/recover');
    assert.equal(request.searchParams.get('redirect_to'), pageURL);
    assert.deepEqual(JSON.parse(calls[0].options.body), { email: 'synthetic@example.test' });
    assert.match(root.textContent, /등록된 이메일이면/);
    assert.equal(dom.window.localStorage.length, 0);
    assert.equal(dom.window.sessionStorage.length, 0);
  } finally { view.destroy(); dom.window.close(); }
});
test('password form rejects mismatches, clears fields and never stores secrets or fetches financial tables', async () => {
  const dom = new JSDOM('<div></div>', { url: pageURL + fragment }), calls = [];
  const root = dom.window.document.querySelector('div');
  const view = mountPasswordSetup(root, { config, win: dom.window, fetcher: backend(calls) });
  try {
    await view.ready;
    assert.equal(dom.window.location.href, pageURL);
    const submit = async (confirmation) => {
      root.querySelector('[name="password"]').value = 'synthetic-new-password';
      root.querySelector('[name="confirmation"]').value = confirmation;
      root.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
      await tick();
    };
    await submit('synthetic-other-password');
    assert.match(root.textContent, /일치하지/);
    assert.equal(root.querySelector('[name="password"]').value, '');
    assert.ok(!calls.some(c => c.options.method === 'PUT'));
    await submit('synthetic-new-password');
    assert.match(root.textContent, /비밀번호를 저장했습니다/);
    assert.equal(root.querySelector('form'), null);
    assert.equal(dom.window.localStorage.length, 0); assert.equal(dom.window.sessionStorage.length, 0);
    assert.ok(!root.innerHTML.includes(token)); assert.ok(!root.innerHTML.includes('synthetic-new-password'));
    assert.ok(!calls.some(c => /asset_(accounts|holdings|payments|snapshots|imports)/.test(c.url)));
  } finally { view.destroy(); dom.window.close(); }
});
test('closing setup clears password fields and late verification cannot reveal a password form', async () => {
  const dom = new JSDOM('<div></div>', { url: pageURL + fragment });
  const root = dom.window.document.querySelector('div'); let release, calls = 0;
  const view = mountPasswordSetup(root, { config, win: dom.window, fetcher: async () => { calls++; return new Promise(resolve => { release = () => resolve(response({ id: 'synthetic-owner' })); }); } });
  try {
    dom.window.dispatchEvent(new dom.window.Event('pagehide')); release();
    await view.ready;
    assert.equal(calls, 1);
    assert.equal(root.querySelector('[name="password"]'), null);
    assert.equal(dom.window.location.hash, '');
  } finally { view.destroy(); dom.window.close(); }
});
