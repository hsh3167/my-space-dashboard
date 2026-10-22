import { mkdir, copyFile, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import defaultConfig from '../assets/public-config.mjs';
import { validateConfig } from '../assets/client.mjs';

// An explicit allowlist prevents tests, SQL, dependencies or local financial files from entering the Pages artifact.
export const SITE_FILES = ['index.html', 'app.js', 'styles.css', 'favicon.svg', '.nojekyll', 'THIRD_PARTY_NOTICES.md',
  'assets/assets.css', 'assets/workspace.mjs', 'assets/sample.mjs', 'assets/model.mjs', 'assets/dashboard.mjs',
  'assets/client.mjs', 'assets/import-core.mjs', 'assets/import-ui.mjs', 'assets/xlsx-worker.mjs'];
export async function prepareSite(destination, config = defaultConfig) {
  const connection = config.url || config.publishableKey ? validateConfig(config) : { url: '', publishableKey: '' };
  for (const file of SITE_FILES) {
    await mkdir(resolve(destination, file, '..'), { recursive: true });
    await copyFile(new URL('../' + file, import.meta.url), resolve(destination, file));
  }
  await writeFile(resolve(destination, 'assets/public-config.mjs'), `// Public Supabase connection only. RLS protects financial data.\nexport default Object.freeze(${JSON.stringify(connection)});\n`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const config = { url: process.env.SUPABASE_URL || defaultConfig.url, publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || defaultConfig.publishableKey };
  await rm('_site', { recursive: true, force: true });
  await prepareSite('_site', config);
  console.log('Static Pages artifact prepared in _site (public configuration only).');
}
