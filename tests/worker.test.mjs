import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { once } from 'node:events';
import { workbook } from './xlsx-fixture.mjs';
test('the committed Worker bundle parses synthetic XLSX and returns only sanitized error text', async () => {
  const worker = new Worker(new URL('./worker-wrapper.mjs', import.meta.url));
  try {
    const pending = once(worker, 'message');
    const bytes = workbook([['종목명','수량','평가금액','매입금액'],['합성 ETF',1,120,100]]);
    worker.postMessage(bytes.buffer, [bytes.buffer]);
    const [result] = await pending; assert.equal(result.sheets[0].matrix[1][0], '합성 ETF');
    const invalid = once(worker, 'message'); worker.postMessage(new ArrayBuffer(10));
    const [error] = await invalid; assert.match(error.error, /XLSX를 읽을 수 없습니다/); assert.equal('stack' in error, false);
  } finally { await worker.terminate(); }
});
