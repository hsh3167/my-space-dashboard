import readExcelFile from 'read-excel-file/universal';
import { unzipSync, strFromU8 } from 'fflate';
import { preflightXlsx, validateMatrix, MAX_ROWS } from './import-core.mjs';

export async function parseXlsx(buffer) {
  preflightXlsx(buffer);
  const files = unzipSync(new Uint8Array(buffer), { filter: entry => /\.xml$/.test(entry.name) });
  for (const [name, bytes] of Object.entries(files)) {
    const xml = strFromU8(bytes);
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('외부 XML 선언은 지원하지 않습니다.');
    if (/^xl\/worksheets\//.test(name)) {
      if (/<(?:\w+:)?f(?:\s|>)/.test(xml)) throw new Error('수식 셀은 지원하지 않습니다. 값만 있는 파일을 사용하세요.');
      for (const match of xml.matchAll(/\b(?:r|ref)=["'][^"']*?([A-Z]+)(\d+)["']/g)) {
        const col = [...match[1]].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
        if (col > 128 || Number(match[2]) > MAX_ROWS + 51) throw new Error('XLSX 행/열 제한을 초과했습니다.');
      }
    }
  }
  const sheets = await readExcelFile(buffer);
  if (sheets.length > 20) throw new Error('시트는 최대 20개까지 지원합니다.');
  return sheets.map(sheet => ({ name: String(sheet.sheet).slice(0, 80), matrix: sheet.data.length ? validateMatrix(sheet.data) : [] }));
}
