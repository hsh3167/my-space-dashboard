import test from 'node:test';
import assert from 'node:assert/strict';
import { database, asUser, OWNER, OTHER } from './db-helper.mjs';

test('PostgreSQL RLS: only the registered owner can read and mutate every asset table', async t => {
  const db = await database();
  try {
    await asUser(db);
    const [{ rows: [{ id: account }] }] = await db.exec("select public.save_asset_account('합성 증권','brokerage',100,10) as id");
    await db.query("insert into asset_holdings(account_id,name,symbol,quantity,market_value,cost_basis) values ($1,'합성 ETF','DEMO',1,80,70)", [account]);
    await db.query("insert into asset_payments(label,due_date,amount) values ('합성 중도금','2027-01-01',20)");
    await db.query("insert into asset_imports(account_id,valuation_date,fingerprint,row_count) values ($1,current_date,repeat('a',64),1)", [account]);
    const tables = ['asset_accounts','asset_holdings','asset_snapshots','asset_payments','asset_imports'];
    await t.test('owner can select, update, insert and delete with matching owner_id', async () => {
      assert.equal((await db.query('select asset_access_allowed() as allowed')).rows[0].allowed, true);
      for (const table of tables) {
        assert.equal((await db.query(`select * from ${table}`)).rows.length, 1);
        assert.equal((await db.query(`update ${table} set owner_id=owner_id returning id`)).rows.length, 1);
      }
      await db.query("insert into asset_payments(label,due_date,amount) values ('삭제 테스트','2027-01-02',1)");
      assert.equal((await db.query("delete from asset_payments where label='삭제 테스트' returning id")).rows.length, 1);
    });
    await t.test('a different signed-in account sees no rows and cannot mutate any existing row', async () => {
      await asUser(db, OTHER);
      assert.equal((await db.query('select asset_access_allowed() as allowed')).rows[0].allowed, false);
      for (const table of tables) {
        assert.equal((await db.query(`select * from ${table}`)).rows.length, 0);
        assert.equal((await db.query(`update ${table} set owner_id=owner_id returning id`)).rows.length, 0);
        assert.equal((await db.query(`delete from ${table} returning id`)).rows.length, 0);
      }
      const inserts = [
        "insert into asset_accounts(label,kind) values ('침입','bank')",
        `insert into asset_holdings(account_id,name,quantity,market_value,cost_basis) values ('${account}','침입',1,1,1)`,
        "insert into asset_snapshots(snapshot_date,total_assets,total_liabilities) values (current_date,1,0)",
        "insert into asset_payments(label,due_date,amount) values ('침입',current_date,1)",
        `insert into asset_imports(account_id,valuation_date,fingerprint,row_count) values ('${account}',current_date,repeat('b',64),1)`
      ];
      for (const sql of inserts) await assert.rejects(db.query(sql), /row-level security/);
      await assert.rejects(db.query("select save_asset_account('침입','bank',1,0)"), /insufficient_privilege/);
      await assert.rejects(db.query('select record_asset_snapshot()'), /insufficient_privilege/);
      await assert.rejects(db.query('select * from private.asset_owner'), /permission denied/);
    });
    await t.test('anonymous clients have no table, RPC, or owner registry access', async () => {
      await asUser(db, '', 'anon');
      for (const table of tables) await assert.rejects(db.query(`select * from ${table}`), /permission denied/);
      await assert.rejects(db.query('select asset_access_allowed()'), /permission denied/);
      await assert.rejects(db.query('select * from private.asset_owner'), /permission denied/);
    });
    await t.test('owner cannot spoof another owner, transfer ownership or store an account number', async () => {
      await asUser(db);
      await assert.rejects(db.query(`insert into asset_accounts(owner_id,label,kind) values ('${OTHER}','spoof','bank')`), /row-level security/);
      await assert.rejects(db.query(`update asset_accounts set owner_id='${OTHER}'`), /row-level security/);
      await assert.rejects(db.query("insert into asset_accounts(label,kind) values ('123-456789-01','bank')"), /check constraint/);
      const snapshot = (await db.query('select * from asset_snapshots')).rows[0];
      assert.equal(Number(snapshot.total_assets), 100); assert.equal(Number(snapshot.total_liabilities), 10);
    });
    await t.test('with no configured owner all authenticated access fails closed', async () => {
      await db.exec('reset role; delete from private.asset_owner'); await asUser(db);
      assert.equal((await db.query('select asset_access_allowed() as allowed')).rows[0].allowed, false);
      for (const table of tables) assert.equal((await db.query(`select * from ${table}`)).rows.length, 0);
    });
  } finally { await db.close(); }
});
