import test from 'node:test';
import assert from 'node:assert/strict';
import { database, asUser, OTHER } from './db-helper.mjs';

test('atomic import RPC enforces deduplication, ownership, chronology, data validation and snapshots', async t => {
  const db = await database(['001_assets.sql', '002_import_holdings.sql']);
  const positions = [{ name: '합성 ETF A', symbol: 'DEMO-A', quantity: 1, market_value: 100, cost_basis: 90 }, { name: '합성 ETF B', symbol: 'DEMO-B', quantity: 2, market_value: 200, cost_basis: 180 }];
  try {
    await asUser(db);
    const { rows: [{ id }] } = await db.query("select save_asset_account('합성 일반','brokerage',0,10) as id");
    const save = (rows = positions, date = '2020-01-01', cash = 50, account = id) => db.query('select import_asset_holdings($1,$2,$3::jsonb,$4) as result', [account, date, JSON.stringify(rows), cash]);
    await t.test('imports only projected positions, combines valuation plus cash and records today snapshot', async () => {
      assert.equal((await save()).rows[0].result.imported, 2);
      assert.equal((await db.query('select * from asset_holdings')).rows.length, 2);
      const account = (await db.query('select * from asset_accounts')).rows[0]; assert.equal(Number(account.balance), 350);
      const snapshot = (await db.query('select * from asset_snapshots')).rows[0]; assert.equal(Number(snapshot.total_assets), 350); assert.equal(Number(snapshot.total_liabilities), 10);
      const ledger = (await db.query('select * from asset_imports')).rows[0];
      assert.equal(ledger.fingerprint.length, 64); assert.equal('filename' in ledger, false);
    });
    await t.test('same content in a different row order is rejected and leaves prior data intact', async () => {
      await assert.rejects(save([...positions].reverse()), /unique constraint/);
      assert.equal((await db.query('select * from asset_imports')).rows.length, 1);
      assert.equal((await db.query('select * from asset_holdings')).rows.length, 2);
    });
    await t.test('a new date replaces holdings and updates a single daily aggregate snapshot', async () => {
      await save([positions[0]], '2020-02-01', 10);
      assert.equal((await db.query('select * from asset_holdings')).rows.length, 1);
      assert.equal((await db.query('select * from asset_snapshots')).rows.length, 1);
      assert.equal(Number((await db.query('select balance from asset_accounts')).rows[0].balance), 110);
      await assert.rejects(save(positions, '2020-01-01'), /stale valuation/);
    });
    await t.test('extra metadata, invalid values, duplicate rows, wrong account type and future dates fail without side effects', async () => {
      for (const invalid of [[{ ...positions[0], account_number: 'synthetic-only' }], [{ ...positions[0], quantity: -1 }], [{ ...positions[0], name: '계좌번호 000-000000-00' }], [positions[0], positions[0]], []]) await assert.rejects(save(invalid, '2020-03-01'));
      await assert.rejects(save(positions, '2999-01-01'));
      // The late account-balance constraint must roll back the ledger insert and holdings replacement too.
      await assert.rejects(save([{ ...positions[0], market_value: 999999999999999 }], '2020-03-01', 1), /check constraint/);
      const { rows: [{ id: bank }] } = await db.query("select save_asset_account('합성 은행','bank',0,0) as id");
      await assert.rejects(save(positions, '2020-03-01', 0, bank), /invalid account kind/);
      assert.equal((await db.query('select * from asset_imports')).rows.length, 2);
      assert.equal((await db.query('select * from asset_holdings')).rows.length, 1);
    });
    await t.test('another authenticated user and anonymous client cannot import into the owner account', async () => {
      await asUser(db, OTHER); await assert.rejects(save(), /insufficient_privilege/);
      await asUser(db, '', 'anon'); await assert.rejects(save(), /permission denied/);
    });
  } finally { await db.close(); }
});
