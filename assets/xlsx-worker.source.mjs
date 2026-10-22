import { parseXlsx } from './xlsx-reader.mjs';
self.onmessage = async event => {
  try { self.postMessage({ sheets: await parseXlsx(event.data) }); }
  catch { self.postMessage({ error: 'XLSX를 읽을 수 없습니다. 값만 포함된 XLSX인지, 크기·행 수·암호화·수식 여부를 확인하세요.' }); }
};
