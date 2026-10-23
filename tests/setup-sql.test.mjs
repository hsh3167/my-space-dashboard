import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSetupSQL } from '../scripts/prepare-supabase-setup.mjs';
import { database, asUser, OWNER, OTHER } from './db-helper.mjs';

test('one-step setup installs both migrations and registers only the specified existing owner', async () => {
  const db = await database([], { registerOwner: false });
  try {
    const sql = await buildSetupSQL(OWNER); await db.exec(sql);
    await asUser(db); assert.equal((await db.query('select asset_access_allowed() as allowed')).rows[0].allowed, true);
    await db.query("select save_asset_account('합성 검증','brokerage',0,0)");
    await asUser(db, OTHER); assert.equal((await db.query('select asset_access_allowed() as allowed')).rows[0].allowed, false);
    assert.equal((await db.query('select * from asset_accounts')).rows.length, 0);
    await db.exec('reset role');
    await assert.rejects(db.exec(sql), /already initialized/); await db.exec('rollback');
    assert.equal((await db.query('select * from public.asset_accounts')).rows.length, 1);
  } finally { await db.close(); }
});
test('invalid/missing owner cannot leave a partially initialized schema', async () => {
  await assert.rejects(buildSetupSQL('not-a-uuid'), /UUID/);
  const db = await database([], { registerOwner: false });
  try {
    await assert.rejects(db.exec(await buildSetupSQL('90000000-0000-4000-8000-000000000099')), /Create the owner/); await db.exec('rollback');
    assert.equal((await db.query("select to_regclass('public.asset_accounts') as table_name")).rows[0].table_name, null);
  } finally { await db.close(); }
});
