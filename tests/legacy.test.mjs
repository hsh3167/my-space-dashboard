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
    assert.equal(d.querySelectorAll('#dashboard-grid .section-card').length, 7);
    const search = d.querySelector('#site-search'); search.value = 'ChatGPT'; search.dispatchEvent(new Event('input'));
    assert.equal(d.querySelectorAll('#dashboard-grid .site-link').length, 1);
    d.querySelector('[data-tab="work"]').click();
    assert.equal(d.querySelector('#link-counter').textContent, '6 LINKS');
    assert.equal(d.querySelectorAll('#dashboard-grid .section-card').length, 3);
    d.querySelector('[data-tab="projects"]').click();
    assert.equal(d.querySelector('#grid-heading').textContent, '개인 프로젝트');
    assert.equal(d.querySelectorAll('#dashboard-grid .lab-card').length, 8);
    assert.ok(d.querySelector('a[href="https://hsh3167.github.io/my-space-dashboard/"]'));
    d.querySelector('[data-tab="assets"]').click();
    assert.equal(d.querySelector('#asset-workspace').hidden, false);
    assert.equal(d.querySelector('#breadcrumb-active').textContent, 'Assets');
    d.querySelector('[data-tab="personal"]').click();
    assert.equal(d.querySelector('#asset-workspace').hidden, true);
    assert.equal(d.querySelector('#link-counter').textContent, '16 LINKS');
  } finally { dom.window.close(); }
});
test('personal websites section is removed; shortcut editing stays local and project catalog is public', async () => {
  const dom = await app(); const { document:d, Event } = dom.window;
  try {
    assert.equal(d.querySelectorAll('#dashboard-grid .section-card.projects').length, 0);
    assert.doesNotMatch(d.querySelector('#dashboard-grid').textContent, /개인 제작 사이트/);
    d.querySelector('#add-site-global').click();
    assert.equal(d.querySelector('#site-dialog').open,true);
    assert.equal(d.querySelector('#edit-category').value,'dev');
    assert.equal(d.querySelector('#lab-auth').open,false);
    d.querySelector('#edit-name').value='Synthetic tool';
    d.querySelector('#edit-url').value='https://example.com';
    d.querySelector('#site-form').dispatchEvent(new Event('submit',{cancelable:true}));
    await new Promise(resolve=>setTimeout(resolve,0));
    assert.ok(d.querySelector('a[href="https://example.com"]'));
    const saved=JSON.parse(dom.window.localStorage.getItem('myspace.dashboard.v1'));
    assert.ok(saved.dev.some(x=>x.name==='Synthetic tool'));
    let backup;
    dom.window.Blob=class{constructor(parts){this.parts=parts;}};
    dom.window.URL.createObjectURL=blob=>{backup=JSON.parse(blob.parts[0]);return 'blob:synthetic';};
    dom.window.URL.revokeObjectURL=()=>{};
    dom.window.HTMLAnchorElement.prototype.click=()=>{};
    d.querySelector('#export-json').click();
    assert.equal(backup.app,'myspace');
    assert.equal(backup.links.workapps.length,4);
    assert.equal(backup.projects.length,8);
    assert.equal(Object.keys(backup.links).includes('assets'),false);
  } finally { dom.window.close(); }
});
test('asset deep link opens only its workspace, leaving default link tabs public', async () => {
  const dom = await app('https://example.test/?view=assets');
  try { assert.equal(dom.window.document.querySelector('#asset-workspace').hidden, false); }
  finally { dom.window.close(); }
});
