const empty = () => ({ accounts: [], holdings: [], snapshots: [], payments: [] });

export function validateConfig(config) {
  const url = new URL(config.url);
  if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) throw new Error('Supabase 프로젝트 HTTPS URL을 입력하세요.');
  const key = String(config.publishableKey).trim();
  if (!key.startsWith('sb_publishable_')) {
    try {
      const claims = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (claims.role !== 'anon' || key.split('.').length !== 3) throw new Error();
    } catch { throw new Error('공개 publishable/anon 키만 사용할 수 있습니다. 비밀 키를 입력하지 마세요.'); }
  }
  if (key.length < 20 || key.length > 3000 || /\s/.test(key)) throw new Error('공개 키 형식을 확인하세요.');
  return { url: url.origin, publishableKey: key };
}

export class AssetClient {
  constructor(config, fetcher = globalThis.fetch) {
    this.config = validateConfig(config); this.fetcher = fetcher.bind(globalThis);
    this.session = null; this.state = 'locked'; this.epoch = 0;
    this.listeners = new Set(); this.pending = new AbortController(); this.timer = null;
  }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  emit() { for (const fn of this.listeners) fn(this.state); }
  lock() {
    this.epoch++; this.pending.abort(); this.pending = new AbortController();
    clearTimeout(this.timer); this.session = null; this.state = 'locked'; this.emit();
  }
  async fetchJSON(path, { token, method = 'GET', body, signal = this.pending.signal, withCount = false } = {}) {
    const response = await this.fetcher(this.config.url + path, {
      method, signal, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer',
      headers: { apikey: this.config.publishableKey, ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json', Prefer: withCount ? 'return=representation,count=exact' : 'return=representation' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    if (!response.ok) {
      let code; try { code = (await response.json()).code; } catch { /* Never log raw server responses. */ }
      if (response.status === 401) { if (!token || token === this.session?.accessToken) this.lock(); throw new Error('로그인이 만료되었습니다. 다시 로그인해 주세요.'); }
      if (code === '23505') throw new Error('이미 등록된 데이터입니다. 중복 업로드 또는 계좌 별칭을 확인하세요.');
      if (code === 'PGRST202') throw new Error('자산관리 DB 초기 설정이 필요합니다. Supabase SQL 설정을 먼저 완료해 주세요.');
      if (code === '22023' || code === '23514') throw new Error('입력 데이터 또는 기준일을 확인하세요. 이전 기준일로 현재 잔액을 덮어쓸 수 없습니다.');
      if (response.status === 403) throw new Error('접근 권한이 없습니다. 본인 계정 등록과 RLS 설정을 확인하세요.');
      throw new Error('요청을 완료하지 못했습니다. 연결과 입력 내용을 확인해 주세요.');
    }
    const value = response.status === 204 ? null : await response.json();
    if (!withCount) return value;
    const count = /\/(\d+)$/.exec(response.headers.get('content-range') || '');
    return { rows: value, total: count ? Number(count[1]) : null };
  }
  async login(email, password) {
    this.lock(); const epoch = this.epoch; this.state = 'authenticating'; this.emit();
    try {
      const token = await this.fetchJSON('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
      if (epoch !== this.epoch || !token.access_token) throw new Error('로그인이 취소되었습니다.');
      const user = await this.fetchJSON('/auth/v1/user', { token: token.access_token });
      if (!user.id) throw new Error('로그인 정보를 확인할 수 없습니다.');
      const allowed = await this.fetchJSON('/rest/v1/rpc/asset_access_allowed', { token: token.access_token, method: 'POST', body: {} });
      if (epoch !== this.epoch) throw new Error('로그인이 취소되었습니다.');
      if (allowed !== true) throw new Error('등록된 본인 계정만 자산관리를 사용할 수 있습니다.');
      const lifetime = Math.max(1, Math.min(Number(token.expires_in) || 3600, 20 * 60));
      // Access token only, held in memory. Refresh token/password are never persisted.
      this.session = { accessToken: token.access_token, userId: user.id, expiresAt: Date.now() + lifetime * 1000 };
      this.state = 'authorized'; this.timer = setTimeout(() => this.lock(), lifetime * 1000); this.timer.unref?.(); this.emit();
    } catch (error) {
      if (epoch === this.epoch) this.lock();
      if (error.name === 'AbortError') throw new Error('로그인이 취소되었습니다.');
      throw error;
    }
  }
  async request(path, options = {}) {
    if (this.state !== 'authorized' || !this.session || Date.now() >= this.session.expiresAt) {
      if (this.session) this.lock();
      throw new Error('먼저 본인 계정으로 로그인해 주세요.');
    }
    const epoch = this.epoch;
    const result = await this.fetchJSON('/rest/v1/' + path, { ...options, token: this.session.accessToken });
    if (epoch !== this.epoch) throw new Error('요청이 취소되었습니다.');
    return result;
  }
  async loadData() {
    const paths = [
      'asset_accounts?select=id,label,kind,balance,debt,valuation_date&order=created_at.asc,id.asc',
      'asset_holdings?select=id,account_id,name,symbol,quantity,market_value,cost_basis&order=name.asc,id.asc',
      'asset_snapshots?select=snapshot_date,total_assets,total_liabilities&order=snapshot_date.desc&limit=366',
      'asset_payments?select=id,label,due_date,amount,status&order=due_date.asc,id.asc'
    ];
    const results = await Promise.all(paths.map((path, i) => i === 2 ? this.request(path) : this.readAll(path)));
    const data = empty(); Object.keys(data).forEach((key, i) => { data[key] = results[i]; }); return data;
  }
  async readAll(path) {
    const epoch = this.epoch, rows = [], batchSize = 1000;
    while (true) {
      if (epoch !== this.epoch) throw new Error('요청이 취소되었습니다.');
      const page = await this.request(`${path}&offset=${rows.length}&limit=${batchSize}`, { withCount: true });
      if (!Array.isArray(page.rows)) throw new Error('계좌 데이터 응답 형식을 확인하세요.');
      rows.push(...page.rows);
      if (page.rows.length === 0 || (page.total !== null ? rows.length >= page.total : page.rows.length < batchSize)) return rows;
      if (rows.length >= 100000) throw new Error('한 번에 표시할 수 있는 자산 데이터 범위를 초과했습니다.');
    }
  }
  saveAccount(account) { return this.request('rpc/save_asset_account', { method: 'POST', body: { p_label: account.label, p_kind: account.kind, p_balance: account.balance, p_debt: account.debt } }); }
  savePayment(payment) { return this.request('asset_payments', { method: 'POST', body: payment }); }
  importHoldings({ accountId, asOf, positions, cash }) {
    // Explicit projection ensures no filename, raw cell, metadata, account number or File can leave the browser.
    const clean = positions.map(({ name, symbol, quantity, market_value, cost_basis }) => ({ name, symbol, quantity, market_value, cost_basis }));
    return this.request('rpc/import_asset_holdings', { method: 'POST', body: { p_account_id: accountId, p_as_of: asOf, p_positions: clean, p_cash: cash } });
  }
  markPayment(id, status) {
    if (!/^[0-9a-f-]{36}$/i.test(id) || !['paid', 'scheduled'].includes(status)) throw new Error('납부 일정을 확인하세요.');
    return this.request(`asset_payments?id=eq.${id}`, { method: 'PATCH', body: { status } });
  }
  async logout() {
    const token = this.session?.accessToken; this.lock();
    if (token) { try { await this.fetchJSON('/auth/v1/logout', { method: 'POST', token, body: {} }); } catch { /* Local state is already cleared, even if offline. */ } }
  }
}
