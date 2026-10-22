import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV, decodeCSV, autoMap, detectHeader, inferAccountKind, prepareRows, preflightXlsx, parseNumber } from '../assets/import-core.mjs';
import { parseXlsx } from '../assets/xlsx-reader.mjs';
import { workbook } from './xlsx-fixture.mjs';
const header = ['종목명', '보유수량', '평가금액', '매입금액', '종목코드', '통화'];
const position = ['합성 ETF', 10, 12000, 10000, 'DEMO', 'KRW'];

test('Samsung-style CSV with metadata, BOM, quoted comma, CRLF and sensitive columns maps only holdings', () => {
  const csv = '\uFEFF퇴직연금 보유현황\r\n계좌번호,000-000000-00\r\n종목명,보유수량,평가금액,매입금액,종목코드,고객명\r\n"합성 ETF, A",10,"12,000","10,000",DEMO,가상고객\r\n합계,,"12,000","10,000",,\r\n';
  const matrix = parseCSV(csv); const index = detectHeader(matrix);
  assert.equal(index, 2); assert.equal(inferAccountKind(matrix, index), 'retirement');
  const result = prepareRows(matrix, index, autoMap(matrix[index]));
  assert.deepEqual(result.errors, []); assert.equal(result.skipped, 1);
  assert.deepEqual(result.positions, [{ name: '합성 ETF, A', symbol: 'DEMO', quantity: 10, market_value: 12000, cost_basis: 10000 }]);
  assert.ok(!JSON.stringify(result).includes('000-000000-00')); assert.ok(!JSON.stringify(result).includes('가상고객'));
});
test('manual mapping, tab delimiters and explicit thousand-won unit work', () => {
  const matrix = parseCSV('이름\t수\t평가\t원금\n합성\t2\t12\t10');
  assert.deepEqual(prepareRows(matrix, 0, { name: 0, quantity: 1, market_value: 2, cost_basis: 3 }, { unit: 1000 }).positions[0], { name: '합성', symbol: '', quantity: 2, market_value: 12000, cost_basis: 10000 });
  assert.equal(decodeCSV(Uint8Array.from([0xb0, 0xa1])), '가');
});
test('bad amounts, currencies, duplicate positions, formula strings and sensitive names block import', () => {
  for (const bad of [NaN, Infinity, -1, '', '12,00', '=1+1', '1e3', '(1,000)', 1e16]) assert.throws(() => parseNumber(bad));
  for (const [column, value] of [[0, '=HYPERLINK("x")'], [0, '가상계좌 000-000000-00'], [2, -1], [5, 'USD']]) {
    const row = [...position]; row[column] = value;
    assert.ok(prepareRows([header, row], 0, autoMap(header)).errors.length);
  }
  assert.ok(prepareRows([header, position, position], 0, autoMap(header)).errors.some(e => e.includes('중복')));
  assert.ok(prepareRows([header, position], 0, { name: 0, quantity: 1, market_value: 2, cost_basis: 2 }).errors.length);
  assert.ok(prepareRows([['고객명', ...header.slice(1)], position], 0, autoMap(header)).errors.some(e => e.includes('고객정보')));
  assert.throws(() => parseCSV('a,b\n"unterminated'));
  assert.throws(() => parseCSV('a,b\n"a"x,b'));
});
test('actual generated XLSX is parsed by the same parser bundled for the worker', async () => {
  const bytes = workbook([header, position]); preflightXlsx(bytes.buffer);
  const sheets = await parseXlsx(bytes.buffer);
  assert.equal(sheets.length, 1); assert.equal(sheets[0].name, '합성 보유현황');
  const result = prepareRows(sheets[0].matrix, 0, autoMap(sheets[0].matrix[0]));
  assert.deepEqual(result.errors, []); assert.equal(result.positions[0].market_value, 12000);
});
test('XLSX formulas, huge dimensions, external connections and invalid archives are rejected', async () => {
  await assert.rejects(parseXlsx(workbook([header, position], { formula: true }).buffer), /수식/);
  await assert.rejects(parseXlsx(workbook([header, position], { dimension: 'A1:XFD1048576' }).buffer), /행\/열/);
  assert.throws(() => preflightXlsx(workbook([header], { extra: { 'xl/externalLinks/externalLink1.xml': '<x/>' } }).buffer), /외부 연결/);
  assert.throws(() => preflightXlsx(new ArrayBuffer(30)), /유효한 XLSX/);
  const bytes = workbook([header, position]); const view = new DataView(bytes.buffer);
  for (let i = 0; i < bytes.length - 24; i++) if (view.getUint32(i, true) === 0x02014b50) { view.setUint32(i + 24, 30 * 1024 * 1024, true); break; }
  assert.throws(() => preflightXlsx(bytes.buffer), /크기/);
});
