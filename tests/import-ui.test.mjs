import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountImporter } from '../assets/import-ui.mjs';
import { AssetClient } from '../assets/client.mjs';
const accountId = '30000000-0000-4000-8000-000000000003';
async function tick() { for (let i = 0; i < 10; i++) await new Promise(resolve => setImmediate(resolve)); }

test('CSV preview never saves without explicit confirmation and never displays raw metadata', async () => {
  const dom = new JSDOM('<section></section>'); const root = dom.window.document.querySelector('section'); let payload, saved = false;
  const client = { state: 'authorized', async importHoldings(value) { payload = value; } };
  const uploader = mountImporter(root, { client, accounts: [{ id: accountId, label: '합성 일반', kind: 'brokerage' }], onSaved: async () => { saved = true; }, win: dom.window });
  try {
    const csv = '고객명,PRIVATE-METADATA-DO-NOT-STORE\n계좌번호,000-000000-00\n종목명,수량,평가금액,매입금액\n합성 ETF,1,120,100';
    const input = root.querySelector('[data-upload="file"]'); const bytes = new TextEncoder().encode(csv);
    Object.defineProperty(input, 'files', { value: [{ name: 'synthetic.csv', size: bytes.length, arrayBuffer: async () => bytes.buffer }] });
    input.dispatchEvent(new dom.window.Event('change', { bubbles: true })); await tick();
    assert.ok(!root.textContent.includes('PRIVATE-METADATA')); assert.ok(!root.textContent.includes('000-000000-00')); assert.equal(payload, undefined);
    const set = (name, value) => { const field = root.querySelector(`[data-upload="${name}"]`); if (name === 'confirm') field.checked = value; else field.value = value; field.dispatchEvent(new dom.window.Event('change', { bubbles: true })); };
    assert.equal(root.querySelector('[type="submit"]').disabled, true);
    set('account', accountId); set('cash', '0'); set('confirm', true);
    assert.equal(root.querySelector('[type="submit"]').disabled, false);
    root.querySelector('[data-upload-form]').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); await tick();
    assert.equal(saved, true); assert.deepEqual(payload.positions, [{ name: '합성 ETF', symbol: '', quantity: 1, market_value: 120, cost_basis: 100 }]);
    assert.ok(!JSON.stringify(payload).includes('PRIVATE-METADATA'));
  } finally { uploader.destroy(); dom.window.close(); }
});
test('client sends only whitelisted JSON fields, never raw File or account metadata', async () => {
  let sent;
  const client = new AssetClient({ url: 'https://synthetic.supabase.co', publishableKey: 'sb_publishable_synthetic_key' }, async (url, options) => { sent = JSON.parse(options.body); return new Response('{}'); });
  client.state = 'authorized'; client.session = { accessToken: 'synthetic', expiresAt: Date.now() + 10000 };
  await client.importHoldings({ accountId, asOf: '2020-01-01', cash: 0, filename: 'discard-me.csv', positions: [{ name: '합성', symbol: '', quantity: 1, market_value: 2, cost_basis: 1, account_number: 'discard-me', customer: 'discard-me' }] });
  assert.deepEqual(Object.keys(sent).sort(), ['p_account_id','p_as_of','p_cash','p_positions']); assert.ok(!JSON.stringify(sent).includes('discard-me'));
  client.lock();
});
