export const ACCOUNT_KINDS = { bank: '입출금', savings: '저축', brokerage: '일반 증권', retirement: '퇴직연금', other: '기타' };
export function money(value) { return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(Number(value) || 0) + '원'; }
export function escapeHTML(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]); }
export function seoulDate() { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date()); }
export function summary(data) {
  const total = data.accounts.reduce((sum, a) => sum + Number(a.balance), 0);
  const debt = data.accounts.reduce((sum, a) => sum + Number(a.debt || 0), 0);
  const investment = data.holdings.reduce((sum, h) => sum + Number(h.market_value), 0);
  const costKnown = data.holdings.every(h => h.cost_basis != null);
  const cost = costKnown ? data.holdings.reduce((sum, h) => sum + Number(h.cost_basis), 0) : null;
  return { total, debt, net: total - debt, investment, gain: costKnown ? investment - cost : null };
}
export function monthlySnapshots(rows) {
  const months = new Map();
  [...rows].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date)).forEach(row => months.set(row.snapshot_date.slice(0, 7), row));
  return [...months.values()].slice(-12);
}
export function chartPoints(rows, key, width = 560, height = 150) {
  const values = rows.flatMap(r => [Number(r.total_assets), Number(r.total_assets) - Number(r.total_liabilities)]);
  const min = Math.min(0, ...values), max = Math.max(1, ...values);
  return rows.map((r, i) => {
    const value = key === 'net' ? Number(r.total_assets) - Number(r.total_liabilities) : Number(r.total_assets);
    return `${20 + (rows.length === 1 ? 0.5 : i / (rows.length - 1)) * (width - 40)},${height - 15 - (value - min) / (max - min) * (height - 30)}`;
  }).join(' ');
}
