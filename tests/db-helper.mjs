import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
export const OWNER = '10000000-0000-4000-8000-000000000001';
export const OTHER = '20000000-0000-4000-8000-000000000002';
export async function database(migrations = ['001_assets.sql']) {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema public,auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;
    insert into auth.users values ('${OWNER}'),('${OTHER}');`);
  for (const file of migrations) await db.exec(await readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8'));
  await db.exec(`insert into private.asset_owner(user_id) values ('${OWNER}')`);
  return db;
}
export async function asUser(db, id = OWNER, role = 'authenticated') {
  await db.exec(`reset role; set role ${role}; select set_config('request.jwt.claim.sub','${id}',false);`);
}
