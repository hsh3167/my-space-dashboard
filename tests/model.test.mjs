import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleData } from '../assets/sample.mjs';
import { summary, monthlySnapshots, chartPoints } from '../assets/model.mjs';
import { dashboardHTML } from '../assets/dashboard.mjs';

test('account totals include holdings once and subtract debt for net worth', () => {
  assert.deepEqual(summary(sampleData()), { total: 95000000, debt: 10000000, net: 85000000, investment: 62000000, gain: 5000000 });
});
test('monthly chart picks latest observation per month without mutating input', () => {
  const rows = [{ snapshot_date: '2026-02-01' }, { snapshot_date: '2026-01-31' }, { snapshot_date: '2026-02-28' }];
  assert.deepEqual(monthlySnapshots(rows).map(r => r.snapshot_date), ['2026-01-31', '2026-02-28']);
  assert.equal(rows[0].snapshot_date, '2026-02-01');
});
test('empty and negative-net chart data produce finite coordinates', () => {
  assert.equal(chartPoints([], 'total'), '');
  assert.ok(!/NaN|Infinity/.test(chartPoints([{ total_assets: 0, total_liabilities: 5 }], 'net')));
  assert.equal(summary({ accounts: [], holdings: [] }).total, 0);
});
test('sample view includes accounts, portfolio, history and housing payments, escaping labels', () => {
  const data = sampleData(); data.accounts[0].label = '<img src=x onerror=alert(1)>';
  const html = dashboardHTML(data);
  for (const label of ['계좌별 자산 구성', '투자 포트폴리오', '월별 자산 변화', '주택자금 납부 일정']) assert.ok(html.includes(label));
  assert.ok(html.includes('&lt;img')); assert.ok(!html.includes('<img src=x'));
  assert.ok(!html.includes('data-payment-id=')); // Sample data cannot mutate the database.
});
