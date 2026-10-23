import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function buildSetupSQL(ownerId) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ownerId || '')) throw new Error('Authentication → Users에 표시된 본인 User UID(UUID)가 필요합니다.');
  const migrations = await Promise.all(['001_assets.sql', '002_import_holdings.sql'].map(async file => {
    const sql = await readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8');
    return sql.replace(/^begin;\s*$/gmi, '').replace(/^commit;\s*$/gmi, '');
  }));
  return `-- Run once in this project's Supabase SQL Editor as the project administrator.
-- Contains your owner UUID; keep this generated file out of Git.
-- Existing asset data is never reset or deleted by this setup script.
begin;
do $$
begin
  if not exists (select 1 from auth.users where id = '${ownerId}'::uuid) then
    raise exception 'Create the owner Auth user before running setup';
  end if;
  if to_regclass('public.asset_accounts') is not null or to_regclass('private.asset_owner') is not null then
    raise exception 'Asset database already initialized; do not rerun initial setup';
  end if;
end $$;
${migrations.join('\n')}
insert into private.asset_owner(user_id) values ('${ownerId}'::uuid);
notify pgrst, 'reload schema';
commit;
select 'Asset database setup complete' as result;
`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const sql = await buildSetupSQL(process.env.SUPABASE_OWNER_ID || process.argv[2]);
    await mkdir('private', { recursive: true });
    await writeFile('private/supabase-setup.sql', sql, { mode: 0o600 });
    console.log('Prepared private/supabase-setup.sql. Run it once in the Supabase SQL Editor. This file is ignored by Git.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
