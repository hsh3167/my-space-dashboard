import { AssetClient } from './client.mjs';

// Separate project session, with the same verified single-owner login and 20-minute
// expiration used by the private financial workspace. Credentials never persist.
export class ProjectCloud {
  constructor(config, fetcher) {
    this.client = new AssetClient(config, fetcher);
  }
  subscribe(fn) { return this.client.subscribe(fn); }
  get state() { return this.client.state; }
  get session() { return this.client.session; }
  async login(email, password) { await this.client.login(email, password); }
  async list() {
    return await this.client.readAll('project_hub_projects?select=id,name,category,summary,notes,links&order=created_at.asc,id.asc');
  }
  async create(record) {
    const {id,name,category,summary,notes,links} = record;
    return await this.client.request('project_hub_projects', { method:'POST', body:{ id,name,category,summary,notes,links } });
  }
  async update(record) {
    const {id,name,category,summary,notes,links} = record;
    return await this.client.request('project_hub_projects?id=eq.' + encodeURIComponent(id),
      {method:'PATCH',body:{name,category,summary,notes,links,updated_at:new Date().toISOString()}});
  }
  async remove(id) {
    return await this.client.request('project_hub_projects?id=eq.' + encodeURIComponent(id),{method:'DELETE'});
  }
  async listPersonalSites() {
    const rows = await this.client.request('dashboard_personal_sites?select=sites');
    if (!Array.isArray(rows)) throw new Error('개인 제작 사이트 응답을 확인할 수 없습니다.');
    return rows.length ? rows[0].sites : null;
  }
  async savePersonalSites(sites) {
    if (!Array.isArray(sites) || sites.length > 100) throw new Error('사이트는 최대 100개까지 등록할 수 있습니다.');
    const existing = await this.client.request('dashboard_personal_sites?select=owner_id');
    const owner = this.client.session?.userId;
    if (!owner || !Array.isArray(existing)) throw new Error('로그인 정보를 확인할 수 없습니다.');
    const rows = existing.length
      ? await this.client.request('dashboard_personal_sites?owner_id=eq.' + encodeURIComponent(owner), {method:'PATCH',body:{sites,updated_at:new Date().toISOString()}})
      : await this.client.request('dashboard_personal_sites', {method:'POST',body:{sites}});
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error('클라우드 저장을 확인하지 못했습니다.');
    return rows[0].sites;
  }
  lock() { this.client.lock(); }
  async logout() { return await this.client.logout(); }
}
