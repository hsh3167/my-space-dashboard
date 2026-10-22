import { FIELDS, MAX_FILE_BYTES, parseCSV, decodeCSV, autoMap, detectHeader, inferAccountKind, prepareRows, parseNumber, safeHeader, preflightXlsx } from './import-core.mjs';
import { escapeHTML as e, money, seoulDate } from './model.mjs';

export function mountImporter(root, { client, accounts, onSaved, win = window }) {
  let sheets = [], sheetIndex = 0, header = 0, mapping = {}, kind = 'brokerage', accountId = '', asOf = seoulDate(), cash = '', unit = 1, confirmed = false;
  let message = '', busy = false, destroyed = false, generation = 0, cancelWorker = null;
  const matrix = () => sheets[sheetIndex]?.matrix || [];
  const prepared = () => prepareRows(matrix(), header, mapping, { unit });
  function validation() {
    const result = prepared(); const errors = [...result.errors];
    if (!accounts.some(a => a.id === accountId && a.kind === kind)) errors.push('일반 증권/퇴직연금 구분에 맞는 계좌를 선택하세요.');
    if (asOf < '2000-01-01' || asOf > seoulDate() || !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) errors.push('기준일을 확인하세요.');
    try { parseNumber(cash); } catch { errors.push('예수금을 원 단위로 입력하세요. 없으면 0을 입력하세요.'); }
    const inferred = inferAccountKind(matrix(), header);
    if (inferred && inferred !== kind) errors.push('파일에 표시된 계좌 구분과 선택한 계좌 구분이 다릅니다.');
    if (!confirmed) errors.push('원화 총액과 보유종목 전체 교체를 확인하세요.');
    return { ...result, errors };
  }
  function selectSheet() { header = detectHeader(matrix()); mapping = autoMap(matrix()[header] || []); const inferred = inferAccountKind(matrix(), header); if (inferred) { kind = inferred; accountId = ''; } confirmed = false; }
  function render() {
    if (destroyed) return;
    const result = sheets.length ? prepared() : null;
    root.innerHTML = `<section class="asset-panel asset-upload"><div class="asset-panel-heading"><h3>삼성증권 보유현황 가져오기</h3><span>CSV · XLSX</span></div><p>원본 파일은 이 브라우저 메모리에서만 읽습니다. 파일명·계좌번호·고객정보는 저장하지 않습니다. 최대 5MB / 5,000종목이며 원화로 환산된 금액만 지원합니다.</p><label class="asset-file-label">보유현황 파일 선택<input data-upload="file" type="file" accept=".csv,.xlsx" ${busy ? 'disabled' : ''}></label><p class="asset-message" role="status">${e(message)}</p>
${sheets.length ? `<form data-upload-form class="asset-form"><label>시트<select data-upload="sheet">${sheets.map((s, i) => `<option value="${i}" ${i === sheetIndex ? 'selected' : ''}>${e(safeHeader(s.name, i).replace('열', '시트'))}</option>`).join('')}</select></label><label>헤더 행 (1부터)<input type="number" data-upload="header" min="1" max="${Math.min(matrix().length, 50)}" value="${header + 1}" required></label><label>계좌 구분<select data-upload="kind"><option value="brokerage" ${kind === 'brokerage' ? 'selected' : ''}>일반 증권</option><option value="retirement" ${kind === 'retirement' ? 'selected' : ''}>퇴직연금 / IRP</option></select></label><label>저장할 계좌<select data-upload="account" required><option value="">계좌 선택</option>${accounts.filter(a => a.kind === kind).map(a => `<option value="${e(a.id)}" ${a.id === accountId ? 'selected' : ''}>${e(a.label)}</option>`).join('')}</select></label><label>평가 기준일<input data-upload="date" type="date" min="2000-01-01" max="${seoulDate()}" value="${e(asOf)}" required></label><label>파일의 금액 단위<select data-upload="unit">${[[1,'원'],[1000,'천원'],[1000000,'백만원']].map(([v,l]) => `<option value="${v}" ${unit === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label>예수금 (원, 없으면 0)<input data-upload="cash" inputmode="decimal" value="${e(cash)}" placeholder="0" required></label><p>예수금은 보유종목 합계에 별도로 더합니다. 매입단가 대신 매입금액 총액을 선택해 주세요. 외화 원금은 환산 기능이 없어 지원하지 않습니다.</p>
<fieldset class="asset-mapping"><legend>컬럼 자동 매핑 · 직접 수정</legend>${Object.entries(FIELDS).map(([key, field]) => `<label>${e(field.label)}${field.required ? ' *' : ''}<select data-mapping="${key}"><option value="-1">선택 안 함</option>${(matrix()[header] || []).map((h, i) => `<option value="${i}" ${mapping[key] === i ? 'selected' : ''}>${e(safeHeader(h, i))}</option>`).join('')}</select></label>`).join('')}</fieldset>
<div class="asset-upload-preview"><h4>저장 전 미리보기</h4><p>검증된 ${result.positions.length}종목 · 평가금액 ${money(result.positions.reduce((sum, p) => sum + p.market_value, 0))} · 합계행 ${result.skipped}개 제외 · 최대 20행 표시</p>${result.errors.length ? `<ul class="asset-validation">${result.errors.slice(0, 10).map(error => `<li>${e(error)}</li>`).join('')}</ul><p>오류 ${result.errors.length}개가 있어 저장할 수 없습니다.</p>` : ''}<div class="asset-table-wrap"><table><thead><tr><th>종목명</th><th>종목코드</th><th>수량</th><th>평가금액</th><th>매입금액</th></tr></thead><tbody>${result.positions.slice(0, 20).map(p => `<tr><td>${e(p.name)}</td><td>${e(p.symbol)}</td><td>${e(p.quantity)}</td><td>${money(p.market_value)}</td><td>${money(p.cost_basis)}</td></tr>`).join('')}</tbody></table></div></div>
<label class="asset-confirm"><input data-upload="confirm" type="checkbox" ${confirmed ? 'checked' : ''}>금액이 원화 총액이며 선택한 계좌의 보유종목 전체를 교체함을 확인했습니다. 해당 파일의 모든 보유종목이 포함되어야 합니다.</label><div class="asset-upload-actions"><button type="button" class="ghost-button" data-upload-clear>미리보기 지우기</button><button type="submit" class="primary-button" ${busy || validation().errors.length ? 'disabled' : ''}>${busy ? '저장 중…' : '확인 후 Supabase에 저장'}</button></div><p>같은 계좌·기준일·내용은 중복 저장되지 않습니다. 새로운 기준일의 보유현황은 이전 보유종목을 교체하고 오늘의 자산 스냅샷을 갱신합니다.</p></form>` : '<p>먼저 계좌 추가에서 일반 증권 또는 퇴직연금 계좌의 별칭을 등록하세요.</p>'}</section>`;
  }
  async function readXlsx(buffer) {
    preflightXlsx(buffer);
    return new Promise((resolve, reject) => {
      const worker = new win.Worker(new URL('./xlsx-worker.mjs', import.meta.url), { type: 'module' });
      const finish = (error, data) => { clearTimeout(timeout); worker.terminate(); cancelWorker = null; error ? reject(error) : resolve(data); };
      const timeout = setTimeout(() => finish(new Error('파일 처리 시간이 초과되었습니다. 파일을 줄여 다시 시도하세요.')), 15000);
      cancelWorker = () => finish(new Error('파일 처리가 취소되었습니다.'));
      worker.onmessage = event => event.data.error ? finish(new Error(event.data.error)) : finish(null, event.data.sheets);
      worker.onerror = () => finish(new Error('XLSX 처리에 실패했습니다. 파일 형식을 확인하세요.'));
      worker.postMessage(buffer, [buffer]);
    });
  }
  async function readFile(file) {
    if (client.state !== 'authorized' || !file) return;
    const current = ++generation; busy = true; sheets = []; message = ''; render();
    try {
      if (file.size === 0 || file.size > MAX_FILE_BYTES || !/\.(csv|xlsx)$/i.test(file.name)) throw new Error('5MB 이하의 CSV 또는 XLSX 파일을 선택하세요.');
      const buffer = await file.arrayBuffer();
      if (destroyed || current !== generation) return;
      const parsed = /\.csv$/i.test(file.name) ? [{ name: 'CSV', matrix: parseCSV(decodeCSV(buffer)) }] : await readXlsx(buffer);
      if (destroyed || current !== generation || client.state !== 'authorized') return;
      sheets = parsed.filter(sheet => sheet.matrix.length); sheetIndex = 0;
      if (!sheets.length) throw new Error('보유종목이 있는 시트를 찾을 수 없습니다.');
      selectSheet();
    } catch (error) { if (current === generation && !destroyed) message = error.message; }
    finally { if (current === generation && !destroyed) { busy = false; render(); } }
  }
  function change(event) {
    const target = event.target;
    if (target.dataset.upload === 'file') { const file = target.files?.[0]; target.value = ''; void readFile(file); return; }
    if (target.dataset.mapping) { mapping[target.dataset.mapping] = Number(target.value); confirmed = false; render(); return; }
    switch (target.dataset.upload) {
      case 'sheet': sheetIndex = Number(target.value); selectSheet(); break;
      case 'header': header = Number(target.value) - 1; mapping = autoMap(matrix()[header] || []); confirmed = false; break;
      case 'kind': kind = target.value; accountId = ''; confirmed = false; break;
      case 'account': accountId = target.value; confirmed = false; break;
      case 'unit': unit = Number(target.value); confirmed = false; break;
      case 'date': asOf = target.value; updateButton(); return;
      case 'cash': cash = target.value; updateButton(); return;
      case 'confirm': confirmed = target.checked; break;
      default: return;
    }
    render();
  }
  function updateButton() { const button = root.querySelector('[data-upload-form] button[type="submit"]'); if (button) button.disabled = busy || validation().errors.length > 0; }
  function input(event) {
    if (event.target.dataset.upload === 'cash') { cash = event.target.value; confirmed = false; }
    else if (event.target.dataset.upload === 'date') { asOf = event.target.value; confirmed = false; }
    else return;
    const checkbox = root.querySelector('[data-upload="confirm"]'); if (checkbox) checkbox.checked = false;
    updateButton();
  }
  async function submit(event) {
    if (!event.target.matches('[data-upload-form]')) return;
    event.preventDefault(); if (busy || client.state !== 'authorized') return;
    const result = validation();
    if (result.errors.length) { message = result.errors[0]; render(); return; }
    busy = true; message = ''; render();
    try {
      await client.importHoldings({ accountId, asOf, positions: result.positions, cash: parseNumber(cash) });
      sheets = []; confirmed = false;
      if (!destroyed) await onSaved();
    } catch (error) { if (!destroyed) message = error.message; }
    finally { if (!destroyed) { busy = false; render(); } }
  }
  function clear(event) {
    if (!event.target.closest('[data-upload-clear]')) return;
    generation++; cancelWorker?.(); sheets = []; confirmed = false; busy = false; message = ''; render();
  }
  root.addEventListener('change', change); root.addEventListener('input', input); root.addEventListener('submit', submit); root.addEventListener('click', clear); render();
  return { destroy() { destroyed = true; generation++; cancelWorker?.(); sheets = []; mapping = {}; root.replaceChildren(); root.removeEventListener('change', change); root.removeEventListener('input', input); root.removeEventListener('submit', submit); root.removeEventListener('click', clear); } };
}
