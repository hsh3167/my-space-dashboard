import { build } from 'esbuild';
await build({ entryPoints: ['assets/xlsx-worker.source.mjs'], outfile: 'assets/xlsx-worker.mjs', bundle: true, minify: true, format: 'esm', platform: 'browser', target: 'es2022', legalComments: 'eof' });
