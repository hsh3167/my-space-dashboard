export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 5000;
export const FIELDS = {
  name: { label: '종목명', required: true, aliases: ['종목명','상품명','펀드명','보유종목','종목/상품명','name'] },
  symbol: { label: '종목코드 (선택)', aliases: ['종목코드','상품코드','단축코드','티커','ticker','symbol'] },
  quantity: { label: '수량', required: true, aliases: ['수량','보유수량','잔고수량','잔고좌수','보유좌수','quantity'] },
  market_value: { label: '평가금액 (총액)', required: true, aliases: ['평가금액','평가액','잔고평가금액','평가잔고금액','평가금액(원)','원화평가금액','marketvalue'] },
  cost_basis: { label: '매입금액 (총액)', required: true, aliases: ['매입금액','매수금액','취득금액','매입원금','투자원금','원화매입금액','costbasis'] },
  currency: { label: '통화 (선택)', aliases: ['통화','통화코드','currency'] }
};
const headerKey = value => String(value ?? '').toLowerCase().replace(/[\s_()\[\]/]/g, '');
export function isSensitiveText(value) { return /[0-9][0-9 -]{7,}[0-9]|[\w.+-]+@[\w.-]+\.[a-z]{2,}|계좌번호|주민등록|주민번호/i.test(value); }
export function safeHeader(value, index) {
  const text = String(value ?? '').slice(0, 80);
  return `${index + 1}열 · ${isSensitiveText(text) ? '민감정보 숨김' : text || '이름 없음'}`;
}
export function autoMap(headers) {
  const result = {};
  for (const [key, field] of Object.entries(FIELDS)) result[key] = headers.findIndex(h => field.aliases.some(alias => headerKey(alias) === headerKey(h)));
  return result;
}
export function detectHeader(matrix) {
  let best = 0, score = -1;
  matrix.slice(0, 50).forEach((row, i) => {
    const mapping = autoMap(row); const current = Object.keys(FIELDS).reduce((n, k) => n + (mapping[k] >= 0 ? (FIELDS[k].required ? 3 : 1) : 0), 0);
    if (current > score) { best = i; score = current; }
  });
  return best;
}
export function inferAccountKind(matrix, headerIndex) {
  const text = matrix.slice(0, headerIndex).flat().map(v => String(v ?? '')).join(' ');
  if (/퇴직|연금|\bIRP\b|\bDC\b/i.test(text)) return 'retirement';
  if (/종합매매|일반증권|위탁계좌/.test(text)) return 'brokerage';
  return '';
}
export function validateMatrix(matrix) {
  if (!Array.isArray(matrix) || !matrix.length || matrix.length > MAX_ROWS + 51) throw new Error('빈 파일이거나 최대 5,000개 보유종목 제한을 초과했습니다.');
  if (matrix.some(row => !Array.isArray(row) || row.length > 128 || row.some(v => String(v ?? '').length > 500))) throw new Error('열 수 또는 셀 길이 제한을 초과했습니다.');
  return matrix;
}
export function decodeCSV(bytes) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { return new TextDecoder('euc-kr', { fatal: true }).decode(bytes); }
}
export function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  if (text.length > MAX_FILE_BYTES) throw new Error('CSV 크기 제한을 초과했습니다.');
  const scores = { ',': 0, '\t': 0, ';': 0 }; let quoted = false;
  for (const ch of text.slice(0, 20000)) { if (ch === '"') quoted = !quoted; else if (!quoted && ch in scores) scores[ch]++; }
  const delimiter = Object.keys(scores).sort((a, b) => scores[b] - scores[a])[0];
  const matrix = []; let row = [], cell = '', inQuote = false, afterQuote = false;
  const pushCell = () => { if (cell.length > 500 || row.length >= 128) throw new Error('열 수 또는 셀 길이 제한을 초과했습니다.'); row.push(cell); cell = ''; afterQuote = false; };
  const pushRow = () => { pushCell(); if (row.some(v => v.trim())) matrix.push(row); row = []; if (matrix.length > MAX_ROWS + 51) throw new Error('최대 5,000개 보유종목 제한을 초과했습니다.'); };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuote) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else { inQuote = false; afterQuote = true; } } else cell += ch; }
    else if (ch === delimiter) pushCell();
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; pushRow(); }
    else if (ch === '"') { if (cell.trim() || afterQuote) throw new Error('CSV 따옴표 형식을 확인하세요.'); cell = ''; inQuote = true; }
    else { if (afterQuote && ch.trim()) throw new Error('CSV 따옴표 뒤의 문자를 확인하세요.'); if (!afterQuote) cell += ch; }
  }
  if (inQuote) throw new Error('CSV 따옴표가 닫히지 않았습니다.');
  if (cell || row.length || afterQuote) pushRow();
  return validateMatrix(matrix);
}
export function parseNumber(value, quantity = false) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0 || value > (quantity ? 999999999999 : 999999999999999)) throw new Error('0 이상의 유효한 숫자가 필요합니다.');
    return Number(value.toFixed(quantity ? 8 : 2));
  }
  const text = String(value ?? '').trim().replace(/^[₩￦]\s*/, '').replace(/\s*원$/, '');
  if (!/^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,8})?$/.test(text)) throw new Error('숫자·쉼표 형식과 원화 총액을 확인하세요.');
  return parseNumber(Number(text.replaceAll(',', '')), quantity);
}
export function prepareRows(matrix, headerIndex, mapping, { unit = 1 } = {}) {
  const errors = [], positions = [], seen = new Set(); let skipped = 0;
  if (!Number.isInteger(headerIndex) || headerIndex < 0 || headerIndex >= matrix.length) return { positions, errors: ['헤더 행을 선택하세요.'], skipped };
  const used = [];
  for (const [key, field] of Object.entries(FIELDS)) {
    const index = mapping[key];
    if (!Number.isInteger(index) || index < 0) { if (field.required) errors.push(`${field.label} 열을 선택하세요.`); continue; }
    if (index >= matrix[headerIndex].length || used.includes(index)) errors.push('서로 다른 유효한 열을 매핑하세요.');
    if (/계좌|주민|고객|성명|전화|휴대|주소|예금주|가입자/i.test(String(matrix[headerIndex][index] ?? ''))) errors.push('고객정보 열은 보유종목 필드로 매핑할 수 없습니다.');
    used.push(index);
  }
  if (![1, 1000, 1000000].includes(unit)) errors.push('금액 단위를 확인하세요.');
  if (errors.length) return { positions, errors, skipped };
  matrix.slice(headerIndex + 1).forEach((row, index) => {
    const line = headerIndex + index + 2;
    if (row.every(v => v == null || String(v).trim() === '')) return;
    const name = String(row[mapping.name] ?? '').trim();
    if (/^(합계|총계|소계|total)$/i.test(name)) { skipped++; return; }
    try {
      if (!name || name.length > 120 || isSensitiveText(name) || /^[=+@-]/.test(name) || /[\u0000-\u001f]/.test(name)) throw new Error('종목명 또는 민감정보 포함 여부를 확인하세요.');
      let symbol = mapping.symbol >= 0 ? String(row[mapping.symbol] ?? '').trim() : '';
      if (typeof row[mapping.symbol] === 'number' && /^\d{1,6}$/.test(symbol)) symbol = symbol.padStart(6, '0');
      if (!/^[A-Za-z0-9._-]{0,24}$/.test(symbol) || /^\d{7,}$/.test(symbol) || isSensitiveText(symbol)) throw new Error('종목코드를 확인하세요. 계좌번호는 저장할 수 없습니다.');
      const currency = mapping.currency >= 0 ? String(row[mapping.currency] ?? '').trim().toUpperCase() : '';
      if (currency && !['KRW', '원', '원화', '₩'].includes(currency)) throw new Error('원화로 환산된 금액만 지원합니다.');
      const quantity = parseNumber(row[mapping.quantity], true);
      const market_value = parseNumber(parseNumber(row[mapping.market_value]) * unit);
      const cost_basis = parseNumber(parseNumber(row[mapping.cost_basis]) * unit);
      const identity = `${name}\u0000${symbol}`;
      if (seen.has(identity)) throw new Error('동일 종목이 중복되어 있습니다. 합산된 보유현황 파일을 사용하세요.');
      seen.add(identity);
      positions.push({ name, symbol, quantity, market_value, cost_basis });
    } catch (error) { errors.push(`${line}행: ${error.message}`); }
  });
  if (positions.length === 0) errors.push('저장할 유효한 보유종목이 없습니다.');
  if (positions.length > MAX_ROWS) errors.push('최대 5,000개 보유종목 제한을 초과했습니다.');
  return { positions, errors, skipped };
}

// Inspect ZIP central and local directory sizes before decompressing any XLSX bytes.
export function preflightXlsx(buffer) {
  const bytes = new Uint8Array(buffer), view = new DataView(buffer);
  if (bytes.length < 22 || bytes.length > MAX_FILE_BYTES || view.getUint32(0, true) !== 0x04034b50) throw new Error('유효한 XLSX 파일이 아닙니다. XLS/암호화 파일은 지원하지 않습니다.');
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
  if (end < 0) throw new Error('XLSX 압축 구조를 확인하세요.');
  const count = view.getUint16(end + 10, true), size = view.getUint32(end + 12, true), offset = view.getUint32(end + 16, true);
  if (view.getUint32(end + 4, true) !== 0 || view.getUint16(end + 8, true) !== count || count > 200 || offset + size !== end || end + 22 + view.getUint16(end + 20, true) !== bytes.length) throw new Error('지원하지 않는 XLSX 압축 구조입니다.');
  let pos = offset, total = 0; const names = new Set();
  for (let i = 0; i < count; i++) {
    if (pos + 46 > end || view.getUint32(pos, true) !== 0x02014b50) throw new Error('손상된 XLSX 파일입니다.');
    const flags = view.getUint16(pos + 8, true), method = view.getUint16(pos + 10, true), compressed = view.getUint32(pos + 20, true), unpacked = view.getUint32(pos + 24, true);
    const nameLength = view.getUint16(pos + 28, true), extraLength = view.getUint16(pos + 30, true), commentLength = view.getUint16(pos + 32, true), local = view.getUint32(pos + 42, true);
    if (pos + 46 + nameLength + extraLength + commentLength > end) throw new Error('손상된 XLSX 파일입니다.');
    const name = new TextDecoder().decode(bytes.slice(pos + 46, pos + 46 + nameLength));
    total += unpacked;
    if ((flags & 1) || ![0, 8].includes(method) || total > 20 * 1024 * 1024 || unpacked > 10 * 1024 * 1024 || unpacked > Math.max(1, compressed) * 300 || /(?:^|\/)\.\.|^\/|\\|vbaproject|externallinks/i.test(name) || names.has(name)) throw new Error('XLSX 크기·압축률·암호화·외부 연결 제한을 확인하세요.');
    if (local + 30 > offset || view.getUint32(local, true) !== 0x04034b50 || view.getUint16(local + 8, true) !== method) throw new Error('손상된 XLSX 파일입니다.');
    const localNameLength = view.getUint16(local + 26, true), localExtraLength = view.getUint16(local + 28, true);
    if (local + 30 + localNameLength + localExtraLength + compressed > offset || new TextDecoder().decode(bytes.slice(local + 30, local + 30 + localNameLength)) !== name) throw new Error('손상된 XLSX 파일입니다.');
    names.add(name); pos += 46 + nameLength + extraLength + commentLength;
  }
  if (pos !== end || !names.has('xl/workbook.xml')) throw new Error('Excel 통합문서가 없습니다.');
  return true;
}
