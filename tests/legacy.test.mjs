import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

async function app(url = 'https://example.test/') {
  const dom = new JSDOM(await readFile(new URL('../index.html', import.meta.url), 'utf8'), { url, runScripts: 'outside-only' });
  dom.window.scrollTo = () => {};
  dom.window.confirm = () => true;
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  dom.window.eval(await readFile(new URL('../projects.js', import.meta.url), 'utf8'));
  dom.window.eval(await readFile(new URL('../app.js', import.meta.url), 'utf8'));
  return dom;
}
test('existing personal/work/project navigation, search and assets boundary', async () => {
  const dom = await app(); const { document: d, Event } = dom.window;
  try {
    assert.equal(d.querySelector('#link-counter').textContent, '16 LINKS');
    assert.equal(d.querySelectorAll('#dashboard-grid .section-card').length, 8);
    const search = d.querySelector('#site-search'); search.value = 'ChatGPT'; search.dispatchEvent(new Event('input'));
    assert.equal(d.querySelectorAll('#dashboard-grid .site-link').length, 1);
    d.querySelector('[data-tab="work"]').click();
    assert.equal(d.querySelector('#link-counter').textContent, '6 LINKS');
    assert.equal(d.querySelectorAll('#dashboard-grid .section-card').length, 3);
    d.querySelector('[data-tab="projects"]').click();
    assert.equal(d.querySelector('#grid-heading').textContent, '개인 프로젝트');
    assert.equal(d.querySelectorAll('#dashboard-grid .lab-card').length, 6);
    assert.ok(d.querySelector('a[href="https://hsh3167.github.io/my-space-dashboard/"]'));
    d.querySelector('[data-tab="assets"]').click();
    assert.equal(d.querySelector('#asset-workspace').hidden, false);
    assert.equal(d.querySelector('#breadcrumb-active').textContent, 'Assets');
    d.querySelector('[data-tab="personal"]').click();
    assert.equal(d.querySelector('#asset-workspace').hidden, true);
    assert.equal(d.querySelector('#link-counter').textContent, '16 LINKS');
  } finally { dom.window.close(); }
});
test('personal site links require login, save to cloud and stay out of browser storage', async () => {
  const dom = await app(); const { document:d, Event } = dom.window;
  try {
    // An unauthenticated click must not silently write to the old localStorage key.
    d.querySelector('#add-site-global').click();
    assert.equal(d.querySelector('#lab-auth').open,true);
    assert.equal(dom.window.localStorage.getItem('myspace.dashboard.v1'),null);
    d.querySelector('#lab-auth').close();

    const slots=Array.from({length:5},(_,i)=>({id:'slot-'+(i+1),name:'사이트 '+String(i+1).padStart(2,'0'),url:'',initial:'+',color:'#a7a6cb',bg:'#252b3a'}));
    let cloudSites=slots;
    dom.window.ProjectHub.signedIn=()=>true;
    dom.window.ProjectHub.personalSites=()=>cloudSites;
    dom.window.ProjectHub.savePersonalSites=async sites=>{cloudSites=sites;};

    d.querySelector('#add-site-global').click();
    d.querySelector('#edit-name').value='Synthetic project';d.querySelector('#edit-url').value='example.com';
    d.querySelector('#site-form').dispatchEvent(new Event('submit',{cancelable:true}));
    await new Promise(resolve=>setTimeout(resolve,0));
    assert.equal(cloudSites.at(-1).url,'https://example.com');
    let saved=JSON.parse(dom.window.localStorage.getItem('myspace.dashboard.v1'));
    assert.ok(!Object.hasOwn(saved,'projects'),'cloud links must not be copied to localStorage');
    const id=cloudSites.at(-1).id;

    d.querySelector(`button[data-id="${id}"]`).click();
    d.querySelector('#edit-name').value='Edited project';
    d.querySelector('#site-form').dispatchEvent(new Event('submit',{cancelable:true}));
    await new Promise(resolve=>setTimeout(resolve,0));
    assert.equal(cloudSites.at(-1).name,'Edited project');
    d.querySelector(`button[data-id="${id}"]`).click();d.querySelector('#delete-site').click();
    await new Promise(resolve=>setTimeout(resolve,0));
    assert.equal(cloudSites.length,5);

    let backup;
    dom.window.Blob=class{constructor(parts){this.parts=parts;}};
    dom.window.URL.createObjectURL=blob=>{backup=JSON.parse(blob.parts[0]);return 'blob:synthetic';};
    dom.window.URL.revokeObjectURL=()=>{};
    dom.window.HTMLAnchorElement.prototype.click=()=>{};
    d.querySelector('#export-json').click();
    assert.equal(backup.app,'myspace');assert.equal(backup.links.workapps.length,4);
    assert.equal(backup.links.projects.length,5);assert.equal(backup.projects.length,6);
    assert.equal(Object.keys(backup.links).includes('assets'),false);
  } finally { dom.window.close(); }
});
test('asset deep link opens only its workspace, leaving default link tabs public', async () => {
  const dom = await app('https://example.test/?view=assets');
  try { assert.equal(dom.window.document.querySelector('#asset-workspace').hidden, false); }
  finally { dom.window.close(); }
});
