import { AssetClient } from './client.mjs';
import defaultConfig from './public-config.mjs';

const invalidLink = '설정 링크가 유효하지 않거나 만료되었습니다. 새 설정 메일을 요청해 주세요.';

// The fragment is consumed once and removed before any Auth request. Never retain a refresh token.
export function consumeRecoveryURL(win) {
  const url = new URL(win.location.href);
  const values = new URLSearchParams(url.hash.slice(1));
  if (url.hash || url.search) win.history.replaceState(null, '', url.pathname);
  if (!url.hash) return null;
  if (values.has('error') || !['recovery', 'invite'].includes(values.get('type'))) throw new Error(invalidLink);
  const accessToken = values.get('access_token');
  if (!accessToken || accessToken.length > 8192) throw new Error(invalidLink);
  return { accessToken, expiresIn: Number(values.get('expires_in')) || 900 };
}

export class PasswordSetupClient {
  constructor(config, fetcher = globalThis.fetch, onExpire = () => {}) {
    this.api = new AssetClient(config, fetcher); this.onExpire = onExpire;
    this.token = null; this.expiresAt = 0; this.timer = null; this.epoch = 0;
  }
  clear() {
    this.epoch++; clearTimeout(this.timer); this.timer = null;
    this.token = null; this.expiresAt = 0; this.api.lock();
  }
  async verify(credentials) {
    this.clear(); const epoch = this.epoch;
    try {
      const user = await this.api.fetchJSON('/auth/v1/user', { token: credentials.accessToken });
      if (epoch !== this.epoch) throw new Error(invalidLink);
      if (!user?.id) throw new Error(invalidLink);
      const allowed = await this.api.fetchJSON('/rest/v1/rpc/asset_access_allowed', {
        token: credentials.accessToken, method: 'POST', body: {}
      });
      if (epoch !== this.epoch) throw new Error(invalidLink);
      if (allowed !== true) throw new Error('등록된 본인 계정의 설정 메일을 사용해 주세요.');
      const lifetime = Math.max(1, Math.min(Number(credentials.expiresIn) || 900, 900));
      this.token = credentials.accessToken; this.expiresAt = Date.now() + lifetime * 1000;
      this.timer = setTimeout(() => { this.clear(); this.onExpire(); }, lifetime * 1000);
      this.timer.unref?.();
    } catch (error) {
      if (epoch === this.epoch) this.clear();
      throw error;
    }
  }
  async sendEmail(email, redirectURL) {
    const url = new URL(redirectURL);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname))) throw new Error('HTTPS 설정 화면을 사용해 주세요.');
    if (url.username || url.password || url.hash || url.search) throw new Error('설정 화면 주소를 확인해 주세요.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('등록한 이메일 주소를 입력해 주세요.');
    await this.api.fetchJSON('/auth/v1/recover?redirect_to=' + encodeURIComponent(url.href), { method: 'POST', body: { email } });
  }
  async setPassword(password) {
    if (!this.token || Date.now() >= this.expiresAt) { this.clear(); throw new Error(invalidLink); }
    if (typeof password !== 'string' || password.length < 12 || password.length > 128) throw new Error('비밀번호는 12~128자로 설정해 주세요.');
    const token = this.token, epoch = this.epoch;
    await this.api.fetchJSON('/auth/v1/user', { token, method: 'PUT', body: { password } });
    if (epoch !== this.epoch) throw new Error(invalidLink);
    this.clear();
    try { await this.api.fetchJSON('/auth/v1/logout', { token, method: 'POST', body: {} }); } catch { /* Password is saved; local credentials are already cleared. */ }
  }
}

export function mountPasswordSetup(root, { config = defaultConfig, win = globalThis.window, fetcher = globalThis.fetch } = {}) {
  let client, state = 'request', message = '', busy = false, active = true, revision = 0;
  let credentials;
  try { credentials = consumeRecoveryURL(win); } catch (error) { message = error.message; }
  try { client = new PasswordSetupClient(config, fetcher, () => { revision++; state = 'request'; busy = false; message = invalidLink; render(); }); }
  catch { state = 'unconfigured'; message = 'Supabase 공개 연결 설정을 먼저 완료해 주세요.'; }

  function render() {
    if (!active) return;
    root.replaceChildren();
    const status = win.document.createElement('p'); status.className = 'message'; status.setAttribute('role', 'status');
    status.textContent = message || (busy ? '처리 중입니다…' : ''); root.append(status);
    if (state === 'done') { status.textContent = '비밀번호를 저장했습니다. 자산관리로 돌아가 이메일과 새 비밀번호로 로그인하세요.'; return; }
    if (state === 'sent') { status.textContent = '등록된 이메일이면 설정 메일이 발송됩니다. 받은편지함과 스팸함을 확인하고 메일의 링크를 열어 주세요. 메일이 없으면 잠시 후 다시 시도하거나 Supabase 메일 설정을 확인하세요.'; return; }
    if (state === 'verifying' || state === 'unconfigured') return;
    const form = win.document.createElement('form'); form.dataset.passwordForm = state;
    form.innerHTML = state === 'new'
      ? '<label>새 비밀번호<input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></label><label>새 비밀번호 확인<input name="confirmation" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></label><button type="submit">비밀번호 저장</button>'
      : '<label>등록한 이메일<input name="email" type="email" autocomplete="username" maxlength="254" required></label><button type="submit">비밀번호 설정 메일 받기</button>';
    form.querySelector('button').disabled = busy; root.append(form);
  }
  async function initialize(recovery) {
    if (!recovery || !client) { render(); return; }
    state = 'verifying'; busy = true; render(); const current = ++revision;
    try { await client.verify(recovery); if (current === revision) state = 'new'; }
    catch (error) { if (current === revision) { state = 'request'; message = error.name === 'AbortError' ? invalidLink : error.message; } }
    finally { recovery = null; if (current === revision) { busy = false; render(); } }
  }
  const ready = initialize(credentials); credentials = null;
  async function submit(event) {
    const form = event.target;
    if (!form.matches('[data-password-form]')) return;
    event.preventDefault(); if (busy || !client) return;
    const values = Object.fromEntries(new win.FormData(form)); form.reset();
    const current = ++revision; const operation = state; busy = true; message = ''; render();
    try {
      if (operation === 'new') {
        if (values.password !== values.confirmation) throw new Error('두 비밀번호가 일치하지 않습니다. 다시 입력해 주세요.');
        await client.setPassword(values.password);
        if (current === revision) state = 'done';
      } else {
        const redirect = new URL(win.location.href); redirect.search = ''; redirect.hash = '';
        await client.sendEmail(values.email, redirect.href);
        if (current === revision) state = 'sent';
      }
    } catch (error) { if (current === revision) message = error.name === 'AbortError' ? invalidLink : error.message; }
    finally { values.password = ''; values.confirmation = ''; if (current === revision) { busy = false; render(); } }
  }
  function clearPage() { revision++; credentials = null; client?.clear(); state = 'request'; busy = false; message = '화면을 다시 열었습니다. 새 설정 메일을 요청해 주세요.'; render(); }
  function onHashChange() {
    revision++; client?.clear(); busy = false; state = client ? 'request' : 'unconfigured'; message = '';
    let incoming;
    try { incoming = consumeRecoveryURL(win); } catch (error) { message = error.message; }
    void initialize(incoming); incoming = null;
  }
  root.addEventListener('submit', submit); win.addEventListener('pagehide', clearPage); win.addEventListener('hashchange', onHashChange);
  return { ready, destroy() { active = false; clearPage(); root.removeEventListener('submit', submit); win.removeEventListener('pagehide', clearPage); win.removeEventListener('hashchange', onHashChange); root.replaceChildren(); } };
}

if (typeof document !== 'undefined') {
  const root = document.querySelector('#password-setup');
  if (root) mountPasswordSetup(root);
}
