// Entirely fictional fixtures. Never replace these with personal financial data.
export function sampleData() {
  return {
    accounts: [
      { id: 'sample-bank', label: '생활비 통장 (샘플)', kind: 'bank', balance: 18000000, debt: 0 },
      { id: 'sample-savings', label: '주택 저축 (샘플)', kind: 'savings', balance: 12000000, debt: 10000000 },
      { id: 'sample-broker', label: '일반 증권 (샘플)', kind: 'brokerage', balance: 43000000, debt: 0 },
      { id: 'sample-pension', label: '퇴직연금 (샘플)', kind: 'retirement', balance: 22000000, debt: 0 }
    ],
    holdings: [
      { account_id: 'sample-broker', name: '샘플 국내주식 ETF', symbol: 'DEMO-A', quantity: 100, market_value: 15000000, cost_basis: 13000000 },
      { account_id: 'sample-broker', name: '샘플 글로벌 ETF', symbol: 'DEMO-B', quantity: 80, market_value: 25000000, cost_basis: 23000000 },
      { account_id: 'sample-pension', name: '샘플 채권 혼합', symbol: 'DEMO-C', quantity: 200, market_value: 22000000, cost_basis: 21000000 }
    ],
    snapshots: [
      ['2026-05-31', 82000000, 12000000], ['2026-06-30', 85000000, 12000000],
      ['2026-07-31', 83000000, 11500000], ['2026-08-31', 90000000, 11000000],
      ['2026-09-30', 92000000, 10000000], ['2026-10-23', 95000000, 10000000]
    ].map(([snapshot_date, total_assets, total_liabilities]) => ({ snapshot_date, total_assets, total_liabilities })),
    payments: [
      { id: 'sample-paid', label: '계약금 (샘플)', due_date: '2026-09-15', amount: 10000000, status: 'paid' },
      { id: 'sample-next', label: '1차 중도금 (샘플)', due_date: '2026-12-15', amount: 20000000, status: 'scheduled' },
      { id: 'sample-final', label: '잔금 (샘플)', due_date: '2027-06-15', amount: 30000000, status: 'scheduled' }
    ]
  };
}
