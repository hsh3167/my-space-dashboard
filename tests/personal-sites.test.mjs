import test from 'node:test';
import assert from 'node:assert/strict';
import { ProjectCloud } from '../assets/project-cloud.mjs';

const config = {url:'https://synthetic.supabase.co',publishableKey:'sb_publishable_synthetic_test_key'};
const result = (value,status=200) => new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
function fakeService() {
  const calls=[];let stored=null;
  const fetcher=async(url,options)=>{
    const parsed=new URL(url), path=parsed.pathname+parsed.search;
    calls.push({path,method:options.method,auth:options.headers.Authorization,body:options.body&&JSON.parse(options.body)});
    if(path.includes('/token?'))return result({access_token:'test-access',refresh_token:'must-not-persist',expires_in:3600});
    if(path==='/auth/v1/user')return result({id:'synthetic-owner'});
    if(path.endsWith('/asset_access_allowed'))return result(true);
    if(path.includes('dashboard_personal_sites')){
      if(options.method==='GET' && path.includes('select=owner_id'))return result(stored===null?[]:[{owner_id:'synthetic-owner'}]);
      if(options.method==='GET')return result(stored===null?[]:[{sites:stored}]);
      if(options.method==='POST'||options.method==='PATCH'){stored=JSON.parse(options.body).sites;return result([{sites:stored}]);}
    }
    return result([]);
  };
  return {calls,fetcher};
}
test('personal websites require owner auth for reads and writes and support repeat updates',async()=>{
  const {calls,fetcher}=fakeService();
  const cloud=new ProjectCloud(config,fetcher);
  await assert.rejects(cloud.listPersonalSites(),/로그인/);
  await assert.rejects(cloud.savePersonalSites([]),/로그인/);
  await cloud.login('owner@example.test','password-for-test');
  assert.equal(await cloud.listPersonalSites(),null);
  const list=[{id:'slot-1',name:'My Lab',url:'https://example.com',initial:'ML',color:'#ffffff',bg:'#333333'}];
  assert.deepEqual(await cloud.savePersonalSites(list),list);
  assert.deepEqual(await cloud.listPersonalSites(),list);
  const next=[...list,{...list[0],id:'slot-2',name:'Robot Lab'}];
  await cloud.savePersonalSites(next);
  assert.deepEqual(await cloud.listPersonalSites(),next);
  assert.ok(calls.some(x=>x.method==='POST'&&x.path.includes('dashboard_personal_sites')));
  assert.ok(calls.some(x=>x.method==='PATCH'&&x.path.includes('owner_id=eq.')));
  assert.ok(calls.filter(x=>x.path.includes('dashboard_personal_sites')).every(x=>x.auth==='Bearer test-access'));
  await cloud.logout();
  await assert.rejects(cloud.listPersonalSites(),/로그인/);
});
