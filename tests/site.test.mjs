import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareSite, SITE_FILES } from '../scripts/prepare-site.mjs';

test('Pages artifact contains only the static application and refuses privileged credentials', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'myspace-site-'));
  try {
    await prepareSite(dir);
    const files = await readdir(dir, { recursive: true });
    for (const file of files) assert.ok(file === 'assets' || SITE_FILES.includes(file) || file === 'assets/public-config.mjs', file);
    const config = await readFile(join(dir, 'assets/public-config.mjs'), 'utf8'); assert.match(config, /"url":""/);
    assert.ok(!files.some(f => /node_modules|supabase\/|tests\/|\.env|\.csv|\.xlsx/.test(f)));
    await assert.rejects(prepareSite(dir, { url: 'https://synthetic.supabase.co', publishableKey: 'sb_secret_should_never_be_published' }));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
