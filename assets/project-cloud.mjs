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
  lock() { this.client.lock(); }
  async logout() { return await this.client.logout(); }
}
