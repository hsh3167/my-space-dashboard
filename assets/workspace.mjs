import { sampleData } from './sample.mjs';
import { dashboardHTML } from './dashboard.mjs';
import { ACCOUNT_KINDS, escapeHTML as e } from './model.mjs';
import { AssetClient, validateConfig } from './client.mjs';
import defaultConfig from './public-config.mjs';
import { mountImporter } from './import-ui.mjs';

const CONFIG_KEY = 'myspace.assets.public-config.v1';
const options = Object.entries(ACCOUNT_KINDS).map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
const numberField = (name, label) => `<label>${label}<input name="${name}" type="number" min="0" max="999999999999999" step="0.01" value="0" required></label>`;
function privateControls() {
  return `<div class="asset-tools"><details><summary>계좌 추가</summary><form data-asset-form="account" class="asset-form"><label>계좌 별칭<input name="label" maxlength="60" placeholder="예: 삼성 일반 (계좌번호 제외)" required></label><label>계좌 구분<select name="kind">${options}</select></label>${numberField('balance', '현재 총잔액 (보유종목 포함)')}${numberField('debt', '관련 부채')}<button class="primary-button" type="submit">계좌 저장</button></form></details><details><summary>주택자금 일정 추가</summary><form data-asset-form="payment" class="asset-form"><label>일정 이름<input name="label" maxlength="80" placeholder="예: 1차 중도금" required></label><label>납부일<input name="due_date" type="date" required></label>${numberField('amount', '납부금액')}<button class="primary-button" type="submit">일정 저장</button></form></details></div><div id="asset-import"></div>`;
}

export function mountWorkspace(root, { config = defaultConfig, storage = globalThis.localStorage, win = globalThis.window, clientFactory = c => new AssetClient(c) } = {}) {
  let client = null, mode = 'demo', data = null, message = '', busy = false, revision = 0, active = !root.hidden;
  let unsubscribe, importer;
  try { const saved = storage?.getItem(CONFIG_KEY); if (saved) config = JSON.parse(saved); validateConfig(config); client = clientFactory(config); } catch { /* An unconfigured project defaults to a public sample. */ }
  function bindClient() { unsubscribe?.(); unsubscribe = client?.subscribe(state => {
    if (state === 'locked') { revision++; data = null; busy = false; }
    render();
  }); }
  bindClient();
  function render() {
    importer?.destroy(); importer = null;
    const authorized = client?.state === 'authorized';
    let auth = '';
    if (mode === 'private') {
      auth = authorized
        ? `<div class="asset-session"><span>본인 계정으로 연결됨 · 세션은 이 페이지에만 유지됩니다.</span><button type="button" class="ghost-button" data-asset-action="reload">새로고침</button><button type="button" class="ghost-button" data-asset-action="logout">로그아웃</button></div>`
        : `<section class="asset-panel asset-login"><h3>내 자산 로그인</h3><p>자산관리 전용 로그인입니다. 기존 링크 작업 공간은 로그인 없이 이용할 수 있습니다.</p>${client ? `<form data-asset-form="login" class="asset-form"><label>이메일<input name="email" type="email" autocomplete="username" required></label><label>비밀번호<input name="password" type="password" autocomplete="current-password" required></label><button class="primary-button" type="submit" ${busy || client.state === 'authenticating' ? 'disabled' : ''}>로그인</button></form><p>본인으로 등록된 계정만 접근할 수 있습니다. <a href="./assets/password.html">비밀번호 처음 설정 / 재설정</a></p>` : '<p>Supabase 프로젝트를 먼저 생성한 뒤 공개 연결 정보를 설정해 주세요.</p>'}
        <details><summary>Supabase 공개 연결 설정</summary><form data-asset-form="config" class="asset-form"><label>프로젝트 URL<input name="url" type="url" placeholder="https://project-id.supabase.co" required></label><label>공개 publishable / anon 키<input name="publishableKey" autocomplete="off" spellcheck="false" required></label><p>공개 연결 정보만 이 브라우저에 저장합니다. 비밀번호·service_role·secret 키를 입력하지 마세요.</p><button class="ghost-button" type="submit">연결 설정 저장</button></form></details></section>`;
    }
    root.innerHTML = `<header class="asset-heading"><div><span class="asset-eyebrow">YOUR FINANCIAL WORKSPACE</span><h1>내 자산을, <em>한눈에.</em></h1><p>오늘의 자산부터 내일의 납부 일정까지.</p></div><span class="asset-mode-badge">${mode === 'demo' ? '샘플 데이터' : authorized ? '내 자산' : '로그인 필요'}</span></header>
      <div class="asset-mode-actions"><button type="button" class="${mode === 'demo' ? 'primary-button' : 'ghost-button'}" data-asset-action="demo" aria-pressed="${mode === 'demo'}">샘플 보기</button><button type="button" class="${mode === 'private' ? 'primary-button' : 'ghost-button'}" data-asset-action="private" aria-pressed="${mode === 'private'}">내 자산 ${authorized ? '보기' : '로그인'}</button></div>
      <p class="asset-notice">${mode === 'demo' ? '데모 화면입니다. 표시된 계좌·금액·종목은 모두 가상 데이터이며 실제 금융정보가 아닙니다.' : '금융정보는 로그인과 본인 확인 후에만 요청합니다. 공유 기기에서는 사용 후 로그아웃하세요.'}</p>
      <p id="asset-message" class="asset-message" role="status" aria-live="polite">${e(message || (busy ? '처리 중입니다…' : ''))}</p>
      <div id="asset-auth">${auth}</div><div id="asset-controls">${active && mode === 'private' && authorized ? privateControls() : ''}</div>
      <div id="asset-dashboard" aria-busy="${busy}">${active && mode === 'demo' ? dashboardHTML(sampleData()) : active && authorized && data ? dashboardHTML(data) : ''}</div>`;
    if (active && mode === 'private' && authorized && data && !busy) importer = mountImporter(root.querySelector('#asset-import'), { client, accounts: data.accounts, onSaved: load, win });
  }
  async function load() {
    if (!active || mode !== 'private' || client?.state !== 'authorized') return;
    const current = ++revision; busy = true; message = ''; data = null; render();
    try { const loaded = await client.loadData(); if (current === revision && active && mode === 'private') data = loaded; }
    catch (error) { if (current === revision) message = error.name === 'AbortError' ? '' : error.message; }
    finally { if (current === revision) { busy = false; render(); } }
  }
  async function act(task, reload = false) {
    if (busy) return;
    busy = true; message = ''; render();
    try { await task(); if (reload) { busy = false; await load(); return; } }
    catch (error) { message = error.message; }
    finally { busy = false; render(); }
  }
  root.addEventListener('click', event => {
    const action = event.target.closest('[data-asset-action]')?.dataset.assetAction;
    if (action === 'demo' || action === 'private') { mode = action; revision++; data = null; message = ''; busy = false; render(); if (action === 'private') void load(); }
    if (action === 'logout') { data = null; message = ''; busy = false; void client?.logout(); }
    if (action === 'reload') void load();
    const payment = event.target.closest('[data-payment-id]');
    if (payment && mode === 'private' && client?.state === 'authorized') void act(() => client.markPayment(payment.dataset.paymentId, payment.dataset.status), true);
  });
  root.addEventListener('submit', event => {
    const form = event.target;
    if (!form.matches('[data-asset-form]')) return;
    event.preventDefault();
    const values = Object.fromEntries(new win.FormData(form));
    const type = form.dataset.assetForm;
    if (type === 'login' && client) {
      form.querySelector('[name="password"]').value = '';
      void act(async () => { try { await client.login(values.email, values.password); } finally { values.password = ''; } }, true);
    } else if (type === 'config') {
      try {
        const safe = validateConfig(values); client?.lock(); unsubscribe?.(); client = clientFactory(safe); config = safe; bindClient();
        try { storage?.setItem(CONFIG_KEY, JSON.stringify(safe)); message = '공개 연결 설정을 저장했습니다.'; } catch { message = '연결했습니다. 이 브라우저에서는 설정 저장이 불가능하여 새로고침하면 다시 설정해야 합니다.'; }
      } catch (error) { message = error.message; }
      render();
    } else if (mode === 'private' && client?.state === 'authorized' && (type === 'account' || type === 'payment')) {
      if (/[0-9][0-9 -]{5,}[0-9]/.test(values.label)) { message = '이름에 계좌번호 등 긴 숫자를 포함하지 마세요.'; render(); return; }
      for (const key of ['balance', 'debt', 'amount']) if (key in values) values[key] = Number(values[key]);
      void act(() => type === 'account' ? client.saveAccount(values) : client.savePayment(values), true);
    }
  });
  const onWorkspace = event => {
    active = event.detail.tab === 'assets'; revision++; data = null; busy = false;
    if (!active) { message = ''; render(); } else { render(); if (mode === 'private') void load(); }
  };
  win.addEventListener('myspace:workspace', onWorkspace);
  render();
  return { destroy() { importer?.destroy(); unsubscribe?.(); client?.lock(); win.removeEventListener('myspace:workspace', onWorkspace); root.replaceChildren(); } };
}

if (typeof document !== 'undefined') {
  const root = document.querySelector('#asset-workspace');
  if (root) mountWorkspace(root);
}
